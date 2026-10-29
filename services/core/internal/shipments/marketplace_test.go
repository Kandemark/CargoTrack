package shipments_test

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/cargotrack/core/internal/platform/auth"
	"github.com/cargotrack/core/internal/platform/testkit"
)

// market sets up a shipper with one booked shipment and two carriers.
type market struct {
	*env
	shipper, carrierA, carrierB testkit.User
	shipmentID, number          string
}

func newMarket(t *testing.T) *market {
	e := setup(t)
	m := &market{env: e,
		shipper:  testkit.NewUser(auth.RoleOperations),
		carrierA: testkit.NewUser(auth.RoleOperations),
		carrierB: testkit.NewUser(auth.RoleOperations),
	}
	m.shipper.OrgName, m.carrierA.OrgName, m.carrierB.OrgName = "Nairobi Importers Ltd", "Alpha Haulage", "Beta Transporters"
	e.fund(m.shipper, 15000) // booking 5000 + listing 10000
	sh := e.book(m.shipper, "SECRET-PO-77")
	m.shipmentID, m.number = sh["id"].(string), sh["tracking_number"].(string)
	return m
}

func (m *market) list() string {
	m.t.Helper()
	r := m.do("POST", "/v1/marketplace/listings", &m.shipper, map[string]any{"shipment_id": m.shipmentID, "notes": "Tail-lift needed"})
	if r.code != 201 {
		m.t.Fatalf("list: %d %v", r.code, r.body)
	}
	return r.body["id"].(string)
}

func (m *market) bid(u testkit.User, listing string, price int) response {
	m.t.Helper()
	return m.do("POST", "/v1/marketplace/listings/"+listing+"/bids", &u, map[string]any{"price_cents": price, "note": "Can load Tuesday"})
}

func TestListingIsPaidAndRevealsNothingPrivate(t *testing.T) {
	m := newMarket(t)
	listing := m.list()
	if b := m.balance(m.shipper); b != 0 {
		t.Fatalf("balance after booking and listing = %v, want 0", b)
	}
	if r := m.do("POST", "/v1/marketplace/listings", &m.shipper, map[string]any{"shipment_id": m.shipmentID}); r.code != 409 {
		t.Fatalf("listing twice: %d %v", r.code, r.body)
	}

	board := m.do("GET", "/v1/marketplace/listings", &m.carrierA, nil)
	listings := board.body["listings"].([]any)
	if len(listings) != 1 {
		t.Fatalf("carrier board = %v", board.body)
	}
	raw, _ := json.Marshal(listings[0])
	for _, secret := range []string{"SECRET-PO-77", m.number, m.shipmentID, "Nairobi Importers", "bid_count"} {
		if strings.Contains(string(raw), secret) {
			t.Errorf("load board leaks %q: %s", secret, raw)
		}
	}
	if !strings.Contains(string(raw), "Tail-lift needed") || !strings.Contains(string(raw), `"bidding_open":true`) {
		t.Errorf("load board lacks the load's details: %s", raw)
	}

	if own := m.do("GET", "/v1/marketplace/listings", &m.shipper, nil).body["listings"].([]any); len(own) != 0 {
		t.Fatalf("shipper's own load on its board: %v", own)
	}
	mine := m.do("GET", "/v1/marketplace/listings?scope=mine", &m.shipper, nil).body["listings"].([]any)
	if len(mine) != 1 || mine[0].(map[string]any)["shipment_id"] != m.shipmentID || mine[0].(map[string]any)["id"] != listing {
		t.Fatalf("shipper's own listings = %v", mine)
	}
}

func TestBidsAreSealed(t *testing.T) {
	m := newMarket(t)
	listing := m.list()
	if r := m.bid(m.carrierA, listing, 9000000); r.code != 201 || r.body["carrier_name"] != "Alpha Haulage" {
		t.Fatalf("bid A: %d %v", r.code, r.body)
	}
	if r := m.bid(m.carrierB, listing, 8500000); r.code != 201 {
		t.Fatalf("bid B: %d %v", r.code, r.body)
	}

	for _, carrier := range []testkit.User{m.carrierA, m.carrierB} {
		bids := m.do("GET", "/v1/marketplace/listings/"+listing+"/bids", &carrier, nil).body["bids"].([]any)
		if len(bids) != 1 || bids[0].(map[string]any)["mine"] != true {
			t.Fatalf("%s sees %v, want only its own bid", carrier.OrgName, bids)
		}
	}
	all := m.do("GET", "/v1/marketplace/listings/"+listing+"/bids", &m.shipper, nil).body["bids"].([]any)
	if len(all) != 2 || all[0].(map[string]any)["carrier_name"] != "Beta Transporters" {
		t.Fatalf("shipper sees %v, want both, cheapest first", all)
	}

	if r := m.bid(m.carrierA, listing, 8000000); r.code != 409 || r.body["error"] != "already_bid" {
		t.Fatalf("second pending bid: %d %v", r.code, r.body)
	}
	if r := m.bid(m.shipper, listing, 1000); r.code != 409 || r.body["error"] != "own_listing" {
		t.Fatalf("bidding on own load: %d %v", r.code, r.body)
	}
	finance := testkit.Colleague(m.carrierA, auth.RoleFinance)
	if r := m.bid(finance, listing, 1000); r.code != 403 {
		t.Fatalf("finance bidding: %d", r.code)
	}

	mine := m.do("GET", "/v1/marketplace/bids", &m.carrierA, nil).body["bids"].([]any)
	bidID := mine[0].(map[string]any)["id"].(string)
	if r := m.do("POST", "/v1/marketplace/bids/"+bidID+"/withdraw", &m.carrierB, nil); r.code != 404 {
		t.Fatalf("competitor withdrawing A's bid: %d", r.code)
	}
	if r := m.do("POST", "/v1/marketplace/bids/"+bidID+"/withdraw", &m.carrierA, nil); r.code != 200 {
		t.Fatalf("withdraw: %d %v", r.code, r.body)
	}
	if r := m.bid(m.carrierA, listing, 8000000); r.code != 201 {
		t.Fatalf("rebid after withdrawing: %d %v", r.code, r.body)
	}
}

func TestAwardHandsTheShipmentToOneCarrier(t *testing.T) {
	m := newMarket(t)
	listing := m.list()
	winning := m.bid(m.carrierA, listing, 9000000).body["id"].(string)
	losing := m.bid(m.carrierB, listing, 9500000).body["id"].(string)

	if r := m.do("GET", "/v1/shipments/"+m.shipmentID, &m.carrierA, nil); r.code != 404 {
		t.Fatalf("carrier sees the shipment before the award: %d", r.code)
	}
	if r := m.do("POST", "/v1/marketplace/bids/"+winning+"/accept", &m.carrierA, nil); r.code != 404 {
		t.Fatalf("carrier accepting its own bid: %d", r.code)
	}
	r := m.do("POST", "/v1/marketplace/bids/"+winning+"/accept", &m.shipper, nil)
	if r.code != 200 || r.body["listing"].(map[string]any)["status"] != "awarded" || r.body["bid"].(map[string]any)["shipment_id"] != m.shipmentID {
		t.Fatalf("accept: %d %v", r.code, r.body)
	}

	if b := m.do("GET", "/v1/marketplace/bids", &m.carrierB, nil).body["bids"].([]any)[0].(map[string]any); b["id"] != losing || b["status"] != "rejected" {
		t.Fatalf("losing bid = %v", b)
	}
	if r := m.do("GET", "/v1/shipments/"+m.shipmentID, &m.carrierB, nil); r.code != 404 {
		t.Fatalf("losing carrier sees the shipment: %d", r.code)
	}
	sh := m.do("GET", "/v1/shipments/"+m.shipmentID, &m.carrierA, nil)
	if sh.code != 200 || sh.body["carrier_org_id"] != m.orgID(m.carrierA) {
		t.Fatalf("winning carrier's view: %d %v", sh.code, sh.body)
	}

	// The carrier runs the job with its own fleet; the shipper keeps the booking.
	truck := m.addVehicle(m.carrierA, map[string]any{"registration": "KDF 6F"})
	carrierDriver := testkit.Colleague(m.carrierA, auth.RoleDriver)
	if r := m.assignTo(m.carrierA, m.shipmentID, truck, m.addDriver(m.carrierA, carrierDriver.Email)); r.code != 200 {
		t.Fatalf("carrier assigning its fleet: %d %v", r.code, r.body)
	}
	shipperTruck := m.addVehicle(m.shipper, map[string]any{"registration": "KDG 7G"})
	if r := m.assignTo(m.shipper, m.shipmentID, shipperTruck, nil); r.code != 403 || r.body["error"] != "not_your_fleet" {
		t.Fatalf("shipper assigning after award: %d %v", r.code, r.body)
	}
	if r := m.do("PATCH", "/v1/shipments/"+m.shipmentID, &m.carrierA, map[string]any{"reference": "mine now"}); r.code != 403 {
		t.Fatalf("carrier editing the booking: %d", r.code)
	}
	if r := m.move(m.carrierA, m.shipmentID, "cancelled"); r.code != 403 {
		t.Fatalf("carrier cancelling the booking: %d", r.code)
	}
	if r := m.move(carrierDriver, m.shipmentID, "picked_up"); r.code != 200 {
		t.Fatalf("carrier's driver picking up: %d %v", r.code, r.body)
	}

	// The shipper follows what the carrier records.
	events := m.do("GET", "/v1/shipments/"+m.shipmentID+"/events", &m.shipper, nil).body["events"].([]any)
	last := events[len(events)-1].(map[string]any)
	if last["to_status"] != "picked_up" {
		t.Fatalf("shipper does not see the carrier's events: %v", events)
	}
	if pub := m.do("GET", "/v1/track/"+m.number, nil, nil); pub.body["status"] != "picked_up" {
		t.Fatalf("public tracking after award: %v", pub.body)
	}
}

func TestConcurrentAcceptsAwardOnce(t *testing.T) {
	m := newMarket(t)
	listing := m.list()
	bids := []string{
		m.bid(m.carrierA, listing, 9000000).body["id"].(string),
		m.bid(m.carrierB, listing, 9100000).body["id"].(string),
	}
	codes := make([]int, 2)
	var wg sync.WaitGroup
	for i, id := range bids {
		wg.Add(1)
		go func() {
			defer wg.Done()
			codes[i] = m.do("POST", "/v1/marketplace/bids/"+id+"/accept", &m.shipper, nil).code
		}()
	}
	wg.Wait()
	won, refused := 0, 0
	for _, c := range codes {
		switch c {
		case 200:
			won++
		case 409:
			refused++
		}
	}
	if won != 1 || refused != 1 {
		t.Fatalf("accept codes = %v, want one 200 and one 409", codes)
	}
}

func TestListedShipmentsAreFrozenAndCancellingWithdraws(t *testing.T) {
	m := newMarket(t)
	listing := m.list()
	bid := m.bid(m.carrierA, listing, 9000000).body["id"].(string)

	if r := m.do("PATCH", "/v1/shipments/"+m.shipmentID, &m.shipper, map[string]any{"weight_kg": 30000}); r.code != 409 || r.body["error"] != "listed" {
		t.Fatalf("editing a listed shipment: %d %v", r.code, r.body)
	}
	if r := m.do("POST", "/v1/marketplace/listings/"+listing+"/withdraw", &m.carrierA, nil); r.code != 403 && r.code != 404 {
		t.Fatalf("carrier withdrawing the shipper's listing: %d", r.code)
	}
	if r := m.move(m.shipper, m.shipmentID, "cancelled"); r.code != 200 {
		t.Fatalf("cancel: %d %v", r.code, r.body)
	}
	got := m.do("GET", "/v1/marketplace/listings/"+listing, &m.shipper, nil).body
	if got["status"] != "withdrawn" {
		t.Fatalf("listing after cancelling the shipment: %v", got)
	}
	if b := m.do("GET", "/v1/marketplace/bids", &m.carrierA, nil).body["bids"].([]any)[0].(map[string]any); b["id"] != bid || b["status"] != "rejected" {
		t.Fatalf("bid after cancellation = %v", b)
	}
}

func TestWithdrawThenEdit(t *testing.T) {
	m := newMarket(t)
	listing := m.list()
	if r := m.do("POST", "/v1/marketplace/listings/"+listing+"/withdraw", &m.shipper, nil); r.code != 200 || r.body["status"] != "withdrawn" {
		t.Fatalf("withdraw: %d %v", r.code, r.body)
	}
	if r := m.do("PATCH", "/v1/shipments/"+m.shipmentID, &m.shipper, map[string]any{"weight_kg": 30000}); r.code != 200 {
		t.Fatalf("edit after withdrawing: %d %v", r.code, r.body)
	}
	if board := m.do("GET", "/v1/marketplace/listings", &m.carrierA, nil).body["listings"].([]any); len(board) != 0 {
		t.Fatalf("withdrawn listing on the board: %v", board)
	}
}

func TestBiddingClosesAtTheDeadline(t *testing.T) {
	m := newMarket(t)
	listing := m.list()
	early := m.bid(m.carrierA, listing, 9000000).body["id"].(string)
	ctx := context.Background()
	if err := m.db.AsSystem(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE listings SET closes_at = now() - interval '1 minute' WHERE id = $1`, listing)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if r := m.bid(m.carrierB, listing, 8000000); r.code != 409 || r.body["error"] != "bidding_closed" {
		t.Fatalf("bid after deadline: %d %v", r.code, r.body)
	}
	if board := m.do("GET", "/v1/marketplace/listings", &m.carrierB, nil).body["listings"].([]any); len(board) != 0 {
		t.Fatalf("closed load still on the board: %v", board)
	}
	// Closing stops new bids; the shipper can still choose among the ones in.
	if r := m.do("POST", "/v1/marketplace/bids/"+early+"/accept", &m.shipper, nil); r.code != 200 {
		t.Fatalf("accept after deadline: %d %v", r.code, r.body)
	}
}

func TestOnlyUnassignedBookedShipmentsCanBeListed(t *testing.T) {
	m := newMarket(t)
	m.fund(m.shipper, 20000)
	before := m.balance(m.shipper)
	own := m.addVehicle(m.shipper, map[string]any{"registration": "KDH 8H"})
	m.assignTo(m.shipper, m.shipmentID, own, nil)
	if r := m.do("POST", "/v1/marketplace/listings", &m.shipper, map[string]any{"shipment_id": m.shipmentID}); r.code != 409 {
		t.Fatalf("listing an assigned shipment: %d %v", r.code, r.body)
	}
	if r := m.do("POST", "/v1/marketplace/listings", &m.carrierA, map[string]any{"shipment_id": m.shipmentID}); r.code != 404 {
		t.Fatalf("listing someone else's shipment: %d", r.code)
	}
	if b := m.balance(m.shipper); b != before {
		t.Fatalf("refused listings were charged: balance %v, was %v", b, before)
	}
}
