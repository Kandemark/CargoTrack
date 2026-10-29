package shipments_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/cargotrack/core/internal/billing"
	"github.com/cargotrack/core/internal/orgs"
	"github.com/cargotrack/core/internal/payments"
	"github.com/cargotrack/core/internal/platform/auth"
	"github.com/cargotrack/core/internal/platform/testkit"
	"github.com/cargotrack/core/internal/shipments"
)

type env struct {
	t     *testing.T
	iss   *testkit.Issuer
	srv   *httptest.Server
	owner testkit.User // platform owner, funds wallets through the admin API
}

func setup(t *testing.T) *env {
	t.Helper()
	db := testkit.DB(t)
	e := &env{t: t, iss: testkit.NewIssuer(t), owner: testkit.NewUser(auth.RolePlatformOwner)}
	orgService := orgs.NewService(db)
	billingService := billing.NewService(db, payments.NewRegistry(), billing.Options{MinTopUpCents: 10000})
	mux := http.NewServeMux()
	authn := auth.Middleware(auth.NewOIDCVerifier(e.iss.URL, testkit.Audience), orgService)
	orgService.Routes(mux, authn)
	billingService.Routes(mux, authn)
	shipments.NewService(db, billingService).Routes(mux, authn)
	e.srv = httptest.NewServer(mux)
	t.Cleanup(e.srv.Close)
	return e
}

type response struct {
	code   int
	header http.Header
	body   map[string]any
}

func (e *env) do(method, path string, u *testkit.User, body any, headers ...string) response {
	e.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, e.srv.URL+path, &buf)
	if u != nil {
		req.Header.Set("Authorization", "Bearer "+e.iss.Token(e.t, *u, nil))
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	out := map[string]any{}
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return response{resp.StatusCode, resp.Header, out}
}

func (e *env) orgID(u testkit.User) string {
	e.t.Helper()
	r := e.do("GET", "/v1/me", &u, nil)
	return r.body["organization"].(map[string]any)["id"].(string)
}

func (e *env) fund(u testkit.User, cents int) {
	e.t.Helper()
	r := e.do("POST", "/v1/admin/organizations/"+e.orgID(u)+"/adjustments", &e.owner,
		map[string]any{"amount_cents": cents, "note": "test credit"})
	if r.code != 201 {
		e.t.Fatalf("fund: %d %v", r.code, r.body)
	}
}

func (e *env) balance(u testkit.User) float64 {
	e.t.Helper()
	admin := testkit.Colleague(u, auth.RoleOrgAdmin)
	return e.do("GET", "/v1/billing/wallet", &admin, nil).body["balance_cents"].(float64)
}

func booking(ref string) map[string]any {
	pickup := time.Now().Add(24 * time.Hour).UTC().Truncate(time.Second)
	return map[string]any{
		"reference": ref, "origin_name": "Mombasa Port", "origin_country": "ke",
		"destination_name": "Kampala ICD", "destination_country": "UG",
		"cargo_description": "40ft container, machine parts", "weight_kg": 18500.5, "pieces": 1,
		"pickup_at": pickup, "deliver_by": pickup.Add(72 * time.Hour),
	}
}

func (e *env) book(u testkit.User, ref string) map[string]any {
	e.t.Helper()
	r := e.do("POST", "/v1/shipments", &u, booking(ref), "Idempotency-Key", "key-"+ref)
	if r.code != 201 {
		e.t.Fatalf("book %s: %d %v", ref, r.code, r.body)
	}
	return r.body
}

func (e *env) move(u testkit.User, id, status string) response {
	e.t.Helper()
	return e.do("POST", "/v1/shipments/"+id+"/status", &u, map[string]any{"status": status, "location": "somewhere"})
}

// ── Booking and billing ──────────────────────────────────────────────────────

func TestBookingIsPaidAndIdempotent(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)

	r := e.do("POST", "/v1/shipments", &ops, booking("PO-1"), "Idempotency-Key", "k1")
	if r.code != 402 || r.body["error"] != "insufficient_credit" {
		t.Fatalf("empty wallet: %d %v", r.code, r.body)
	}
	if list := e.do("GET", "/v1/shipments", &ops, nil).body["shipments"].([]any); len(list) != 0 {
		t.Fatalf("unpaid booking was saved: %v", list)
	}

	e.fund(ops, 10000)
	r = e.do("POST", "/v1/shipments", &ops, booking("PO-1"), "Idempotency-Key", "k1")
	if r.code != 201 || r.body["status"] != "booked" || r.body["origin_country"] != "KE" {
		t.Fatalf("book: %d %v", r.code, r.body)
	}
	id := r.body["id"]
	if tn := r.body["tracking_number"].(string); len(tn) != 12 || !strings.HasPrefix(tn, "CT") {
		t.Fatalf("tracking number %q", tn)
	}
	if b := e.balance(ops); b != 5000 {
		t.Fatalf("balance after booking = %v, want 5000", b)
	}

	// A retry of the same request returns the same shipment and costs nothing.
	r = e.do("POST", "/v1/shipments", &ops, booking("PO-1"), "Idempotency-Key", "k1")
	if r.code != 200 || r.body["id"] != id || r.header.Get("Idempotent-Replayed") != "true" {
		t.Fatalf("retry: %d %v", r.code, r.body)
	}
	if b := e.balance(ops); b != 5000 {
		t.Fatalf("retry was charged: balance %v", b)
	}

	// The same key for different contents is a client bug, refused loudly.
	r = e.do("POST", "/v1/shipments", &ops, booking("PO-2"), "Idempotency-Key", "k1")
	if r.code != 422 || r.body["error"] != "idempotency_key_reused" {
		t.Fatalf("reused key: %d %v", r.code, r.body)
	}

	if r := e.do("POST", "/v1/shipments", &ops, booking("PO-3")); r.code != 400 || r.body["error"] != "idempotency_key_required" {
		t.Fatalf("no key: %d %v", r.code, r.body)
	}
}

func TestConcurrentRetriesBookAndChargeOnce(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	e.fund(ops, 100000)

	var wg sync.WaitGroup
	codes := make([]int, 10)
	for i := range codes {
		wg.Add(1)
		go func() {
			defer wg.Done()
			codes[i] = e.do("POST", "/v1/shipments", &ops, booking("PO-9"), "Idempotency-Key", "same").code
		}()
	}
	wg.Wait()
	created := 0
	for _, c := range codes {
		switch c {
		case 201:
			created++
		case 200:
		default:
			t.Fatalf("unexpected status %d in %v", c, codes)
		}
	}
	if created != 1 {
		t.Fatalf("%d bookings created, want 1 (%v)", created, codes)
	}
	if b := e.balance(ops); b != 95000 {
		t.Fatalf("balance = %v, want one charge of 5000", b)
	}
}

func TestBookingValidation(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	e.fund(ops, 100000)
	bad := []func(m map[string]any){
		func(m map[string]any) { m["origin_name"] = "  " },
		func(m map[string]any) { m["destination_country"] = "Uganda" },
		func(m map[string]any) { m["weight_kg"] = 0 },
		func(m map[string]any) { m["weight_kg"] = 250000 },
		func(m map[string]any) { m["deliver_by"] = m["pickup_at"] },
		func(m map[string]any) { delete(m, "pickup_at") },
		func(m map[string]any) { m["unknown_field"] = true },
	}
	for i, mutate := range bad {
		m := booking("V")
		mutate(m)
		if r := e.do("POST", "/v1/shipments", &ops, m, "Idempotency-Key", fmt.Sprint("v", i)); r.code != 400 {
			t.Errorf("case %d: %d %v", i, r.code, r.body)
		}
	}
	if b := e.balance(ops); b != 100000 {
		t.Fatalf("invalid bookings were charged: balance %v", b)
	}
}

// ── Status, events, editing ──────────────────────────────────────────────────

func TestStatusRules(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	e.fund(ops, 10000)
	id := e.book(ops, "S1")["id"].(string)

	if r := e.move(ops, id, "delivered"); r.code != 409 || r.body["error"] != "invalid_transition" {
		t.Fatalf("booked -> delivered: %d %v", r.code, r.body)
	}
	for _, st := range []string{"picked_up", "in_transit", "customs", "in_transit", "delivered"} {
		if r := e.move(ops, id, st); r.code != 200 {
			t.Fatalf("-> %s: %d %v", st, r.code, r.body)
		}
	}
	sh := e.do("GET", "/v1/shipments/"+id, &ops, nil).body
	if sh["status"] != "delivered" || sh["picked_up_at"] == nil || sh["delivered_at"] == nil {
		t.Fatalf("after delivery: %v", sh)
	}
	if r := e.move(ops, id, "in_transit"); r.code != 409 {
		t.Fatalf("delivered -> in_transit: %d", r.code)
	}
	if r := e.do("POST", "/v1/shipments/"+id+"/events", &ops, map[string]any{"kind": "checkpoint", "location": "Malaba"}); r.code != 409 {
		t.Fatalf("checkpoint after delivery: %d", r.code)
	}
	if r := e.do("POST", "/v1/shipments/"+id+"/events", &ops, map[string]any{"kind": "note", "note": "POD signed by J. Okello"}); r.code != 201 {
		t.Fatalf("note after delivery: %d %v", r.code, r.body)
	}
	events := e.do("GET", "/v1/shipments/"+id+"/events", &ops, nil).body["events"].([]any)
	if len(events) != 7 { // booked + 5 moves + note
		t.Fatalf("%d events, want 7", len(events))
	}
	if b := e.balance(ops); b != 5000 {
		t.Fatalf("tracking was charged: balance %v, want only the booking", b)
	}
}

func TestFutureEventTimesAreRefused(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	e.fund(ops, 10000)
	id := e.book(ops, "F1")["id"].(string)
	r := e.do("POST", "/v1/shipments/"+id+"/status", &ops, map[string]any{
		"status": "picked_up", "occurred_at": time.Now().Add(time.Hour),
	})
	if r.code != 400 {
		t.Fatalf("future pickup: %d %v", r.code, r.body)
	}
}

func TestRolePermissions(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	driver := testkit.Colleague(ops, auth.RoleDriver)
	finance := testkit.Colleague(ops, auth.RoleFinance)
	e.fund(ops, 20000)
	id := e.book(ops, "R1")["id"].(string)

	if r := e.do("POST", "/v1/shipments", &driver, booking("R2"), "Idempotency-Key", "d1"); r.code != 403 {
		t.Fatalf("driver booking (costs money): %d", r.code)
	}
	if r := e.move(driver, id, "cancelled"); r.code != 403 {
		t.Fatalf("driver cancelling: %d", r.code)
	}
	if r := e.move(driver, id, "picked_up"); r.code != 200 {
		t.Fatalf("driver pickup: %d %v", r.code, r.body)
	}
	if r := e.do("POST", "/v1/shipments/"+id+"/events", &driver, map[string]any{"kind": "checkpoint", "location": "Mariakani weighbridge"}); r.code != 201 {
		t.Fatalf("driver checkpoint: %d %v", r.code, r.body)
	}
	if r := e.do("GET", "/v1/shipments/"+id, &finance, nil); r.code != 200 {
		t.Fatalf("finance view: %d", r.code)
	}
	if r := e.move(finance, id, "in_transit"); r.code != 403 {
		t.Fatalf("finance moving a shipment: %d", r.code)
	}
}

func TestEditingIsFreeAndOnlyBeforePickup(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	e.fund(ops, 10000)
	id := e.book(ops, "E1")["id"].(string)

	r := e.do("PATCH", "/v1/shipments/"+id, &ops, map[string]any{"destination_name": "Kigali", "destination_country": "rw"})
	if r.code != 200 || r.body["destination_name"] != "Kigali" || r.body["destination_country"] != "RW" || r.body["reference"] != "E1" {
		t.Fatalf("edit: %d %v", r.code, r.body)
	}
	if r := e.do("PATCH", "/v1/shipments/"+id, &ops, map[string]any{"weight_kg": -1}); r.code != 400 {
		t.Fatalf("invalid edit: %d", r.code)
	}
	if b := e.balance(ops); b != 5000 {
		t.Fatalf("editing was charged: %v", b)
	}
	e.move(ops, id, "picked_up")
	if r := e.do("PATCH", "/v1/shipments/"+id, &ops, map[string]any{"reference": "late"}); r.code != 409 {
		t.Fatalf("edit after pickup: %d", r.code)
	}
}

// ── Isolation and listing ────────────────────────────────────────────────────

func TestShipmentsAreInvisibleToOtherOrganisations(t *testing.T) {
	e := setup(t)
	a := testkit.NewUser(auth.RoleOrgAdmin)
	b := testkit.NewUser(auth.RoleOrgAdmin)
	e.fund(a, 10000)
	id := e.book(a, "ISO")["id"].(string)

	if r := e.do("GET", "/v1/shipments/"+id, &b, nil); r.code != 404 {
		t.Fatalf("other org GET: %d", r.code)
	}
	if r := e.move(b, id, "picked_up"); r.code != 404 {
		t.Fatalf("other org status change: %d", r.code)
	}
	if r := e.do("PATCH", "/v1/shipments/"+id, &b, map[string]any{"reference": "x"}); r.code != 404 {
		t.Fatalf("other org edit: %d", r.code)
	}
	if list := e.do("GET", "/v1/shipments", &b, nil).body["shipments"].([]any); len(list) != 0 {
		t.Fatalf("other org lists %d shipments", len(list))
	}
}

func TestListFiltersAndPages(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	e.fund(ops, 50000)
	first := e.book(ops, "PO-100%")["id"].(string)
	e.book(ops, "PO-200")
	e.book(ops, "PO-300")
	e.move(ops, first, "picked_up")

	page := e.do("GET", "/v1/shipments?limit=2", &ops, nil).body
	if len(page["shipments"].([]any)) != 2 || page["next_cursor"] == nil {
		t.Fatalf("page 1: %v", page)
	}
	page2 := e.do("GET", "/v1/shipments?limit=2&cursor="+page["next_cursor"].(string), &ops, nil).body
	rest := page2["shipments"].([]any)
	if len(rest) != 1 || rest[0].(map[string]any)["id"] != first || page2["next_cursor"] != nil {
		t.Fatalf("page 2: %v", page2)
	}

	picked := e.do("GET", "/v1/shipments?status=picked_up", &ops, nil).body["shipments"].([]any)
	if len(picked) != 1 {
		t.Fatalf("status filter: %v", picked)
	}
	// "%" is literal, so this matches PO-100% only, not every reference.
	hits := e.do("GET", "/v1/shipments?q=0%25", &ops, nil).body["shipments"].([]any)
	if len(hits) != 1 {
		t.Fatalf("search with %%: %d hits", len(hits))
	}
	if r := e.do("GET", "/v1/shipments?status=lost", &ops, nil); r.code != 400 {
		t.Fatalf("unknown status filter: %d", r.code)
	}
}

// ── Public tracking ──────────────────────────────────────────────────────────

func TestPublicTrackingShowsOnlyPublicFacts(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	e.fund(ops, 10000)
	sh := e.book(ops, "SECRET-PO")
	id, number := sh["id"].(string), sh["tracking_number"].(string)
	e.move(ops, id, "picked_up")
	e.do("POST", "/v1/shipments/"+id+"/events", &ops, map[string]any{"kind": "checkpoint", "location": "Malaba border"})
	e.do("POST", "/v1/shipments/"+id+"/events", &ops, map[string]any{"kind": "checkpoint", "location": "Driver's home", "internal": true})
	e.do("POST", "/v1/shipments/"+id+"/events", &ops, map[string]any{"kind": "note", "note": "Client owes 2 invoices"})

	// No token; typed in lower case with dashes, as people do.
	typed := strings.ToLower(number[:6] + "-" + number[6:])
	r := e.do("GET", "/v1/track/"+typed, nil, nil)
	if r.code != 200 || r.body["tracking_number"] != number || r.body["status"] != "picked_up" {
		t.Fatalf("track: %d %v", r.code, r.body)
	}
	raw, _ := json.Marshal(r.body)
	for _, secret := range []string{"SECRET-PO", "machine parts", "Driver's home", "invoices", "recorded_by", "18500"} {
		if strings.Contains(string(raw), secret) {
			t.Errorf("public tracking leaks %q: %s", secret, raw)
		}
	}
	if events := r.body["events"].([]any); len(events) != 3 { // booked, picked_up, Malaba
		t.Fatalf("public events = %v", events)
	}
	if r := e.do("GET", "/v1/track/CT2222222222", nil, nil); r.code != 404 {
		t.Fatalf("unknown number: %d", r.code)
	}
}
