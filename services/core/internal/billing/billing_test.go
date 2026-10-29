package billing

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cargotrack/core/internal/orgs"
	"github.com/cargotrack/core/internal/payments"
	"github.com/cargotrack/core/internal/platform/auth"
	"github.com/cargotrack/core/internal/platform/database"
	"github.com/cargotrack/core/internal/platform/httpx"
	"github.com/cargotrack/core/internal/platform/testkit"
)

// fakeProvider stands in for M-Pesa. Tests set what Initiate and Check
// return; checks counts how often the provider was asked.
type fakeProvider struct {
	mu          sync.Mutex
	initErr     error
	checkResult payments.Check
	checkErr    error
	checks      atomic.Int32
	nextRef     atomic.Int32
}

func (f *fakeProvider) Name() string { return "fakepay" }

func (f *fakeProvider) NormalizePhone(phone string) (string, error) {
	if phone == "bad" {
		return "", &payments.RejectedError{Reason: "Enter a valid number."}
	}
	return "254700000000", nil
}

func (f *fakeProvider) Initiate(ctx context.Context, req payments.Request) (payments.Initiation, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.initErr != nil {
		return payments.Initiation{}, f.initErr
	}
	return payments.Initiation{
		ProviderRef:     "ref-" + strconv.Itoa(int(f.nextRef.Add(1))),
		CustomerMessage: "Enter your PIN",
	}, nil
}

func (f *fakeProvider) Check(ctx context.Context, ref string) (payments.Check, error) {
	f.checks.Add(1)
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.checkResult, f.checkErr
}

func (f *fakeProvider) ParseCallback(r *http.Request) (payments.Callback, error) {
	if r.URL.Query().Get("token") != "cb-secret" {
		return payments.Callback{}, payments.ErrUnauthenticatedCallback
	}
	var body struct{ Ref string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return payments.Callback{}, err
	}
	return payments.Callback{ProviderRef: body.Ref}, nil
}

func (f *fakeProvider) set(fn func(f *fakeProvider)) {
	f.mu.Lock()
	defer f.mu.Unlock()
	fn(f)
}

type env struct {
	t    *testing.T
	db   *database.DB
	iss  *testkit.Issuer
	srv  *httptest.Server
	svc  *Service
	orgs *orgs.Service
	prov *fakeProvider
}

func setup(t *testing.T) *env {
	t.Helper()
	e := &env{t: t, db: testkit.DB(t), iss: testkit.NewIssuer(t), prov: &fakeProvider{}}
	e.orgs = orgs.NewService(e.db)
	e.svc = NewService(e.db, payments.NewRegistry(e.prov), Options{
		MinTopUpCents: 10000, LowBalanceCents: 50000, CheckInterval: time.Hour,
	})
	mux := http.NewServeMux()
	authn := auth.Middleware(auth.NewOIDCVerifier(e.iss.URL, testkit.Audience), e.orgs)
	e.orgs.Routes(mux, authn)
	e.svc.Routes(mux, authn)
	e.srv = httptest.NewServer(mux)
	t.Cleanup(e.srv.Close)
	return e
}

// call sends a request as u (or anonymously when u is nil) and decodes the
// JSON reply.
func (e *env) call(method, path string, u *testkit.User, body any) (int, map[string]any) {
	e.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, e.srv.URL+path, &buf)
	if u != nil {
		req.Header.Set("Authorization", "Bearer "+e.iss.Token(e.t, *u, nil))
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	out := map[string]any{}
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

func (e *env) principal(u testkit.User) auth.Principal {
	e.t.Helper()
	p, err := e.orgs.Resolve(context.Background(), auth.Identity{
		IdPUserID: u.ID, IdPOrgID: u.OrgID, OrgName: u.OrgName, Email: u.Email, Roles: u.Roles,
	})
	if err != nil {
		e.t.Fatal(err)
	}
	return p
}

func (e *env) fund(p auth.Principal, cents int64) {
	e.t.Helper()
	if err := e.db.AsSystem(context.Background(), func(tx pgx.Tx) error {
		_, err := credit(context.Background(), tx, p.OrgID, cents, "adjustment", "", "test credit", "")
		return err
	}); err != nil {
		e.t.Fatal(err)
	}
}

func (e *env) balanceOf(p auth.Principal) (cents int64) {
	e.t.Helper()
	if err := e.db.InOrg(context.Background(), p.OrgID, func(tx pgx.Tx) error {
		var err error
		cents, err = balance(context.Background(), tx, p.OrgID)
		return err
	}); err != nil {
		e.t.Fatal(err)
	}
	return cents
}

func (e *env) setPrice(code string, cents int64, active bool) {
	e.t.Helper()
	if err := e.db.AsSystem(context.Background(), func(tx pgx.Tx) error {
		_, err := tx.Exec(context.Background(), `UPDATE meters SET unit_price_cents = $2, active = $3 WHERE code = $1`, code, cents, active)
		return err
	}); err != nil {
		e.t.Fatal(err)
	}
}

func statusOf(err error) int {
	var he *httpx.Error
	if errors.As(err, &he) {
		return he.Status
	}
	return 0
}

// ── Charging ─────────────────────────────────────────────────────────────────

// A module's action and its charge share one transaction: with no credit,
// neither happens; with credit, both do.
func TestChargeCommitsOrRollsBackWithTheAction(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	p := e.principal(testkit.NewUser(auth.RoleOperations))
	if err := e.db.AsSystem(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `CREATE TABLE test_actions (org_id uuid, note text)`)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	act := func() error {
		return e.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, `INSERT INTO test_actions VALUES ($1, 'shipment')`, p.OrgID); err != nil {
				return err
			}
			return e.svc.Charge(ctx, tx, p, "shipment.create", 1, "test shipment")
		})
	}
	actions := func() (n int) {
		_ = e.db.AsSystem(ctx, func(tx pgx.Tx) error {
			return tx.QueryRow(ctx, `SELECT count(*) FROM test_actions`).Scan(&n)
		})
		return n
	}

	err := act()
	if statusOf(err) != http.StatusPaymentRequired {
		t.Fatalf("empty wallet: err = %v, want 402", err)
	}
	var he *httpx.Error
	errors.As(err, &he)
	if he.Details["price_cents"] != int64(5000) || he.Details["balance_cents"] != int64(0) {
		t.Fatalf("402 details = %v", he.Details)
	}
	if n := actions(); n != 0 {
		t.Fatalf("action persisted without payment (%d rows)", n)
	}

	e.fund(p, 12000)
	if err := act(); err != nil {
		t.Fatal(err)
	}
	if n := actions(); n != 1 {
		t.Fatalf("paid action not persisted (%d rows)", n)
	}
	if b := e.balanceOf(p); b != 7000 {
		t.Fatalf("balance = %d, want 7000", b)
	}
}

func TestConcurrentChargesNeverOverspend(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	p := e.principal(testkit.NewUser(auth.RoleOperations))
	e.fund(p, 10*5000)

	var ok, refused atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 25; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := e.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
				return e.svc.Charge(ctx, tx, p, "shipment.create", 1, "")
			})
			switch statusOf(err) {
			case 0:
				if err != nil {
					t.Error(err)
				}
				ok.Add(1)
			case http.StatusPaymentRequired:
				refused.Add(1)
			default:
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if ok.Load() != 10 || refused.Load() != 15 {
		t.Fatalf("%d charges succeeded and %d were refused; want exactly 10 and 15", ok.Load(), refused.Load())
	}
	if b := e.balanceOf(p); b != 0 {
		t.Fatalf("balance = %d, want 0", b)
	}
}

func TestPlatformOwnerIsNotBilled(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	p := e.principal(testkit.NewUser(auth.RolePlatformOwner))
	if err := e.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		return e.svc.Charge(ctx, tx, p, "shipment.create", 1, "")
	}); err != nil {
		t.Fatalf("platform owner charged: %v", err)
	}
}

func TestInactiveMeterIsFreeAndUnknownMeterIsAnError(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	p := e.principal(testkit.NewUser(auth.RoleOperations))
	e.setPrice("prediction.run", 500, false)
	if err := e.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		return e.svc.Charge(ctx, tx, p, "prediction.run", 1, "")
	}); err != nil {
		t.Fatalf("inactive meter charged: %v", err)
	}
	err := e.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		return e.svc.Charge(ctx, tx, p, "no.such.meter", 1, "")
	})
	if err == nil || statusOf(err) != 0 {
		t.Fatalf("unknown meter: err = %v, want an internal error, never free", err)
	}
}

// ── Wallet endpoints ─────────────────────────────────────────────────────────

func TestWalletAccess(t *testing.T) {
	e := setup(t)
	finance := testkit.NewUser(auth.RoleFinance)
	driver := testkit.Colleague(finance, auth.RoleDriver)

	if code, _ := e.call("GET", "/v1/billing/wallet", nil, nil); code != 401 {
		t.Fatalf("anonymous: %d", code)
	}
	if code, _ := e.call("GET", "/v1/billing/wallet", &driver, nil); code != 403 {
		t.Fatalf("driver: %d", code)
	}
	code, body := e.call("GET", "/v1/billing/wallet", &finance, nil)
	if code != 200 || body["balance_cents"] != float64(0) || body["low_balance"] != true {
		t.Fatalf("finance: %d %v", code, body)
	}
	if prices, _ := body["prices"].([]any); len(prices) != 3 {
		t.Fatalf("prices = %v", body["prices"])
	}
}

func TestLedgerIsPaginatedAndPrivate(t *testing.T) {
	e := setup(t)
	a := testkit.NewUser(auth.RoleFinance)
	b := testkit.NewUser(auth.RoleFinance)
	pa := e.principal(a)
	e.principal(b)
	for i := 0; i < 3; i++ {
		e.fund(pa, 100)
	}

	code, body := e.call("GET", "/v1/billing/ledger?limit=2", &a, nil)
	entries, _ := body["entries"].([]any)
	if code != 200 || len(entries) != 2 || body["next_before"] == nil {
		t.Fatalf("page 1: %d %v", code, body)
	}
	before := int64(body["next_before"].(float64))
	_, body = e.call("GET", "/v1/billing/ledger?limit=2&before="+strconv.FormatInt(before, 10), &a, nil)
	if entries, _ := body["entries"].([]any); len(entries) != 1 || body["next_before"] != nil {
		t.Fatalf("page 2: %v", body)
	}

	_, body = e.call("GET", "/v1/billing/ledger", &b, nil)
	if entries, _ := body["entries"].([]any); len(entries) != 0 {
		t.Fatalf("org B sees org A's ledger: %v", body)
	}
}

// ── Top-ups ──────────────────────────────────────────────────────────────────

func (e *env) startTopUp(u testkit.User) map[string]any {
	e.t.Helper()
	code, body := e.call("POST", "/v1/billing/topups", &u, map[string]any{
		"provider": "fakepay", "amount_cents": 100000, "phone": "0712345678",
	})
	if code != 201 {
		e.t.Fatalf("start top-up: %d %v", code, body)
	}
	return body["topup"].(map[string]any)
}

func (e *env) callback(token, ref string) int {
	e.t.Helper()
	resp, err := http.Post(e.srv.URL+"/v1/payments/fakepay/callback?token="+token, "application/json",
		bytes.NewBufferString(`{"Ref":"`+ref+`"}`))
	if err != nil {
		e.t.Fatal(err)
	}
	resp.Body.Close()
	return resp.StatusCode
}

func (e *env) providerRef(topUpID string) (ref string) {
	e.t.Helper()
	_ = e.db.AsSystem(context.Background(), func(tx pgx.Tx) error {
		return tx.QueryRow(context.Background(), `SELECT provider_ref FROM topups WHERE id = $1`, topUpID).Scan(&ref)
	})
	return ref
}

func TestTopUpIsCreditedOnlyWhenTheProviderConfirms(t *testing.T) {
	e := setup(t)
	u := testkit.NewUser(auth.RoleFinance)
	p := e.principal(u)
	topup := e.startTopUp(u)
	if topup["status"] != "pending" || topup["phone_masked"] != "2547*****000" {
		t.Fatalf("new top-up = %v", topup)
	}
	ref := e.providerRef(topup["id"].(string))

	// The callback arrives, but the provider still says pending.
	e.prov.set(func(f *fakeProvider) { f.checkResult = payments.Check{Status: payments.StatusPending} })
	if code := e.callback("cb-secret", ref); code != 200 {
		t.Fatalf("callback: %d", code)
	}
	if b := e.balanceOf(p); b != 0 {
		t.Fatalf("credited on a pending check: %d", b)
	}

	// Now the provider confirms. Repeated callbacks credit once.
	e.prov.set(func(f *fakeProvider) { f.checkResult = payments.Check{Status: payments.StatusPaid} })
	for i := 0; i < 3; i++ {
		e.callback("cb-secret", ref)
	}
	if b := e.balanceOf(p); b != 100000 {
		t.Fatalf("balance = %d, want 100000", b)
	}
	_, got := e.call("GET", "/v1/billing/topups/"+topup["id"].(string), &u, nil)
	if got["status"] != "succeeded" || got["credited_at"] == nil {
		t.Fatalf("top-up after payment = %v", got)
	}
	var topupEntries int
	_ = e.db.AsSystem(context.Background(), func(tx pgx.Tx) error {
		return tx.QueryRow(context.Background(), `SELECT count(*) FROM ledger_entries WHERE kind = 'topup'`).Scan(&topupEntries)
	})
	if topupEntries != 1 {
		t.Fatalf("%d top-up ledger entries, want 1", topupEntries)
	}
}

func TestCallbackWithoutTokenIsIgnored(t *testing.T) {
	e := setup(t)
	u := testkit.NewUser(auth.RoleFinance)
	topup := e.startTopUp(u)
	e.prov.set(func(f *fakeProvider) { f.checkResult = payments.Check{Status: payments.StatusPaid} })
	if code := e.callback("guess", e.providerRef(topup["id"].(string))); code != 401 {
		t.Fatalf("callback with wrong token: %d", code)
	}
	if n := e.prov.checks.Load(); n != 0 {
		t.Fatalf("unauthenticated callback triggered %d provider checks", n)
	}
}

// After the provider reports failure, a later authenticated callback still
// triggers a fresh check, so a real payment is never lost to an earlier answer.
func TestLaterCallbackRescuesFailedTopUp(t *testing.T) {
	e := setup(t)
	u := testkit.NewUser(auth.RoleFinance)
	p := e.principal(u)
	topup := e.startTopUp(u)
	ref := e.providerRef(topup["id"].(string))

	e.prov.set(func(f *fakeProvider) {
		f.checkResult = payments.Check{Status: payments.StatusFailed, Reason: "Request cancelled by user"}
	})
	e.callback("cb-secret", ref)
	_, got := e.call("GET", "/v1/billing/topups/"+topup["id"].(string), &u, nil)
	if got["status"] != "failed" || got["failure_reason"] != "Request cancelled by user" {
		t.Fatalf("after failed check: %v", got)
	}

	e.prov.set(func(f *fakeProvider) { f.checkResult = payments.Check{Status: payments.StatusPaid} })
	e.callback("cb-secret", ref)
	if b := e.balanceOf(p); b != 100000 {
		t.Fatalf("balance = %d, want 100000", b)
	}
}

func TestTopUpStartFailures(t *testing.T) {
	e := setup(t)
	u := testkit.NewUser(auth.RoleFinance)
	start := func() (int, map[string]any) {
		return e.call("POST", "/v1/billing/topups", &u, map[string]any{
			"provider": "fakepay", "amount_cents": 100000, "phone": "0712345678",
		})
	}

	e.prov.set(func(f *fakeProvider) { f.initErr = &payments.RejectedError{Reason: "Invalid PhoneNumber"} })
	code, body := start()
	if code != 422 || body["error"] != "payment_rejected" {
		t.Fatalf("rejected: %d %v", code, body)
	}

	e.prov.set(func(f *fakeProvider) { f.initErr = errors.New("connection reset") })
	code, body = start()
	details, _ := body["details"].(map[string]any)
	topup, _ := details["topup"].(map[string]any)
	if code != 502 || topup["status"] != "failed" {
		t.Fatalf("provider down: %d %v", code, body)
	}
}

func TestTopUpValidation(t *testing.T) {
	e := setup(t)
	finance := testkit.NewUser(auth.RoleFinance)
	ops := testkit.Colleague(finance, auth.RoleOperations)
	cases := []struct {
		user *testkit.User
		body map[string]any
		code int
		err  string
	}{
		{&finance, map[string]any{"provider": "fakepay", "amount_cents": 5000, "phone": "0712345678"}, 400, "invalid_request"},
		{&finance, map[string]any{"provider": "stripe", "amount_cents": 100000, "phone": "0712345678"}, 400, "invalid_request"},
		{&finance, map[string]any{"provider": "fakepay", "amount_cents": 100000, "phone": "bad"}, 400, "invalid_phone"},
		{&finance, map[string]any{"provider": "fakepay", "amount_cents": 100000, "phone": "0712345678", "extra": 1}, 400, "invalid_request"},
		{&ops, map[string]any{"provider": "fakepay", "amount_cents": 100000, "phone": "0712345678"}, 403, "forbidden"},
	}
	for i, c := range cases {
		code, body := e.call("POST", "/v1/billing/topups", c.user, c.body)
		if code != c.code || body["error"] != c.err {
			t.Errorf("case %d: %d %v, want %d %s", i, code, body, c.code, c.err)
		}
	}
}

func TestTopUpsAreInvisibleToOtherOrganisations(t *testing.T) {
	e := setup(t)
	owner := testkit.NewUser(auth.RoleFinance)
	outsider := testkit.NewUser(auth.RoleFinance)
	id := e.startTopUp(owner)["id"].(string)

	if code, _ := e.call("GET", "/v1/billing/topups/"+id, &outsider, nil); code != 404 {
		t.Fatalf("outsider GET: %d", code)
	}
	if code, _ := e.call("POST", "/v1/billing/topups/"+id+"/check", &outsider, nil); code != 404 {
		t.Fatalf("outsider check: %d", code)
	}
	_, body := e.call("GET", "/v1/billing/topups", &outsider, nil)
	if list, _ := body["topups"].([]any); len(list) != 0 {
		t.Fatalf("outsider lists %v", list)
	}
	if code, _ := e.call("GET", "/v1/billing/topups/not-a-uuid", &owner, nil); code != 404 {
		t.Fatalf("malformed id: %d", code)
	}
}

func TestPollingIsRateLimited(t *testing.T) {
	e := setup(t)
	u := testkit.NewUser(auth.RoleFinance)
	id := e.startTopUp(u)["id"].(string)
	e.prov.set(func(f *fakeProvider) { f.checkResult = payments.Check{Status: payments.StatusPending} })
	for i := 0; i < 5; i++ {
		if code, _ := e.call("POST", "/v1/billing/topups/"+id+"/check", &u, nil); code != 200 {
			t.Fatalf("check: %d", code)
		}
	}
	if n := e.prov.checks.Load(); n != 1 {
		t.Fatalf("5 polls asked the provider %d times, want 1", n)
	}
}

func TestReconcilerRecoversLostCallbacks(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	u := testkit.NewUser(auth.RoleFinance)
	p := e.principal(u)
	paid := e.startTopUp(u)["id"].(string)
	stale := e.startTopUp(u)["id"].(string)
	_ = e.db.AsSystem(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE topups SET created_at = now() - interval '2 minutes' WHERE id = $1;`, paid)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE topups SET created_at = now() - interval '25 hours' WHERE id = $1`, stale)
		return err
	})

	e.prov.set(func(f *fakeProvider) { f.checkResult = payments.Check{Status: payments.StatusPaid} })
	if err := e.svc.reconcileOnce(ctx); err != nil {
		t.Fatal(err)
	}
	if b := e.balanceOf(p); b != 100000 {
		t.Fatalf("balance = %d, want only the recent top-up credited", b)
	}
	_, got := e.call("GET", "/v1/billing/topups/"+stale, &u, nil)
	if got["status"] != "failed" {
		t.Fatalf("day-old pending top-up = %v, want failed", got)
	}
}

// ── Platform administration ──────────────────────────────────────────────────

func TestAdminAdjustmentsAndPrices(t *testing.T) {
	e := setup(t)
	admin := testkit.NewUser(auth.RolePlatformOwner)
	client := testkit.NewUser(auth.RoleOrgAdmin)
	pc := e.principal(client)
	path := "/v1/admin/organizations/" + pc.OrgID + "/adjustments"

	if code, _ := e.call("POST", path, &client, map[string]any{"amount_cents": 1, "note": "x"}); code != 403 {
		t.Fatalf("client adjusting own wallet: %d", code)
	}
	credit := map[string]any{"amount_cents": 500000, "note": "Bank transfer", "reference": "FT26301ABC"}
	if code, body := e.call("POST", path, &admin, credit); code != 201 || body["balance_after_cents"] != float64(500000) {
		t.Fatalf("credit: %d %v", code, body)
	}
	if code, _ := e.call("POST", path, &admin, credit); code != 409 {
		t.Fatalf("same bank reference twice: %d", code)
	}
	if code, _ := e.call("POST", path, &admin, map[string]any{"amount_cents": -600000, "note": "too much"}); code != 422 {
		t.Fatalf("debit below zero: %d", code)
	}
	if code, _ := e.call("POST", "/v1/admin/organizations/00000000-0000-0000-0000-000000000000/adjustments", &admin, credit); code != 404 {
		t.Fatalf("unknown org: %d", code)
	}

	if code, body := e.call("PUT", "/v1/admin/meters/shipment.create", &admin, map[string]any{"unit_price_cents": 7500}); code != 200 || body["unit_price_cents"] != float64(7500) {
		t.Fatalf("set price: %d %v", code, body)
	}
	ctx := context.Background()
	if err := e.db.InOrg(ctx, pc.OrgID, func(tx pgx.Tx) error {
		return e.svc.Charge(ctx, tx, pc, "shipment.create", 1, "")
	}); err != nil {
		t.Fatal(err)
	}
	if b := e.balanceOf(pc); b != 500000-7500 {
		t.Fatalf("balance = %d, want the new price charged", b)
	}
}
