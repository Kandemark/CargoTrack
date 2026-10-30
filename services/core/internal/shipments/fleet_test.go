package shipments_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cargotrack/core/internal/platform/auth"
	"github.com/cargotrack/core/internal/platform/testkit"
)

var eat = time.FixedZone("EAT", 3*60*60)

func day(offset int) string { return time.Now().In(eat).AddDate(0, 0, offset).Format(time.DateOnly) }

func (e *env) addVehicle(u testkit.User, body map[string]any) string {
	e.t.Helper()
	if body["kind"] == nil {
		body["kind"] = "prime_mover"
	}
	r := e.do("POST", "/v1/fleet/vehicles", &u, body)
	if r.code != 201 {
		e.t.Fatalf("add vehicle: %d %v", r.code, r.body)
	}
	return r.body["id"].(string)
}

func (e *env) addDriver(u testkit.User, email string) string {
	e.t.Helper()
	r := e.do("POST", "/v1/fleet/drivers", &u, map[string]any{
		"name": "Jane Achieng", "email": email, "phone": "0712 345 678",
		"licence_number": "DL-" + email[:8], "licence_expires_on": day(365),
	})
	if r.code != 201 {
		e.t.Fatalf("add driver: %d %v", r.code, r.body)
	}
	return r.body["id"].(string)
}

func (e *env) assignTo(u testkit.User, shipmentID string, vehicleID, driverID any) response {
	e.t.Helper()
	if s, ok := vehicleID.(string); ok && s == "" {
		vehicleID = nil
	}
	if s, ok := driverID.(string); ok && s == "" {
		driverID = nil
	}
	r := e.do("PUT", "/v1/shipments/"+shipmentID+"/assignment", &u, map[string]any{"vehicle_id": vehicleID, "driver_id": driverID})
	return r
}

func TestVehiclesAndDrivers(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	finance := testkit.Colleague(ops, auth.RoleFinance)
	driver := testkit.Colleague(ops, auth.RoleDriver)

	r := e.do("POST", "/v1/fleet/vehicles", &ops, map[string]any{"registration": "  kda   123a ", "kind": "prime_mover", "capacity_kg": 28000})
	if r.code != 201 || r.body["registration"] != "KDA 123A" {
		t.Fatalf("add vehicle: %d %v", r.code, r.body)
	}
	id := r.body["id"].(string)
	if r := e.do("POST", "/v1/fleet/vehicles", &ops, map[string]any{"registration": "KDA-123A", "kind": "trailer"}); r.code != 409 {
		t.Fatalf("same plate written differently: %d", r.code)
	}
	if r := e.do("POST", "/v1/fleet/vehicles", &ops, map[string]any{"registration": "KDB 1B", "kind": "spaceship"}); r.code != 400 {
		t.Fatalf("unknown kind: %d", r.code)
	}
	if r := e.do("PATCH", "/v1/fleet/vehicles/"+id, &ops, map[string]any{"insurance_expires_on": day(30)}); r.code != 200 || r.body["insurance_expires_on"] != day(30) {
		t.Fatalf("patch: %d %v", r.code, r.body)
	}
	if r := e.do("PATCH", "/v1/fleet/vehicles/"+id, &ops, map[string]any{"insurance_expires_on": "31/12/2027"}); r.code != 400 {
		t.Fatalf("bad date format: %d", r.code)
	}

	if r := e.do("GET", "/v1/fleet/vehicles", &finance, nil); r.code != 200 || len(r.body["vehicles"].([]any)) != 1 {
		t.Fatalf("finance list: %d %v", r.code, r.body)
	}
	if r := e.do("POST", "/v1/fleet/vehicles", &finance, map[string]any{"registration": "KDC 9C", "kind": "van"}); r.code != 403 {
		t.Fatalf("finance adding vehicle: %d", r.code)
	}
	if r := e.do("GET", "/v1/fleet/drivers", &driver, nil); r.code != 403 {
		t.Fatalf("driver listing the fleet: %d", r.code)
	}

	e.addDriver(ops, "jane@example.com")
	dup := e.do("POST", "/v1/fleet/drivers", &ops, map[string]any{
		"name": "Other", "email": "JANE@example.com", "licence_number": "X1", "licence_expires_on": day(10),
	})
	if dup.code != 409 {
		t.Fatalf("duplicate driver email: %d", dup.code)
	}
	if r := e.do("POST", "/v1/fleet/drivers", &ops, map[string]any{"name": "No licence"}); r.code != 400 {
		t.Fatalf("driver without licence: %d", r.code)
	}
}

func TestLapsedComplianceBlocksAssignment(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	e.fund(ops, 10000)
	sh := e.book(ops, "C1")["id"].(string)

	lapsedTruck := e.addVehicle(ops, map[string]any{"registration": "KCA 1A", "insurance_expires_on": day(-1)})
	r := e.assignTo(ops, sh, lapsedTruck, nil)
	if r.code != 409 || r.body["error"] != "vehicle_not_compliant" {
		t.Fatalf("lapsed insurance: %d %v", r.code, r.body)
	}
	if v := e.do("GET", "/v1/fleet/vehicles/"+lapsedTruck, &ops, nil).body; len(v["lapsed"].([]any)) != 1 {
		t.Fatalf("vehicle should report lapsed insurance: %v", v)
	}

	// Insurance that expires today is still valid until the end of the day in Kenya.
	todayTruck := e.addVehicle(ops, map[string]any{"registration": "KCB 2B", "insurance_expires_on": day(0), "inspection_expires_on": day(90)})
	if r := e.assignTo(ops, sh, todayTruck, nil); r.code != 200 || r.body["vehicle_id"] != todayTruck {
		t.Fatalf("insurance expiring today: %d %v", r.code, r.body)
	}

	inactive := e.addVehicle(ops, map[string]any{"registration": "KCC 3C"})
	e.do("PATCH", "/v1/fleet/vehicles/"+inactive, &ops, map[string]any{"active": false})
	if r := e.assignTo(ops, sh, inactive, nil); r.code != 409 || r.body["error"] != "vehicle_inactive" {
		t.Fatalf("inactive vehicle: %d %v", r.code, r.body)
	}

	d := e.do("POST", "/v1/fleet/drivers", &ops, map[string]any{
		"name": "Expired Licence", "licence_number": "DL-OLD", "licence_expires_on": day(-3),
	})
	if d.body["licence_lapsed"] != true {
		t.Fatalf("driver should report lapsed licence: %v", d.body)
	}
	if r := e.assignTo(ops, sh, nil, d.body["id"]); r.code != 409 || r.body["error"] != "driver_not_compliant" {
		t.Fatalf("expired licence: %d %v", r.code, r.body)
	}
}

func TestDriversSeeOnlyTheirShipments(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	driver := testkit.Colleague(ops, auth.RoleDriver)
	e.fund(ops, 20000)
	mine := e.book(ops, "MINE")["id"].(string)
	other := e.book(ops, "OTHER")["id"].(string)

	// Before any assignment the driver sees nothing at all.
	if list := e.do("GET", "/v1/shipments", &driver, nil).body["shipments"].([]any); len(list) != 0 {
		t.Fatalf("unassigned driver sees %d shipments", len(list))
	}

	if r := e.assignTo(ops, mine, nil, e.addDriver(ops, driver.Email)); r.code != 200 {
		t.Fatalf("assign: %d %v", r.code, r.body)
	}
	list := e.do("GET", "/v1/shipments", &driver, nil).body["shipments"].([]any)
	if len(list) != 1 || list[0].(map[string]any)["id"] != mine {
		t.Fatalf("driver list = %v", list)
	}
	for _, try := range []response{
		e.do("GET", "/v1/shipments/"+other, &driver, nil),
		e.do("GET", "/v1/shipments/"+other+"/events", &driver, nil),
		e.move(driver, other, "picked_up"),
		e.do("POST", "/v1/shipments/"+other+"/events", &driver, map[string]any{"kind": "note", "note": "x"}),
	} {
		if try.code != 404 {
			t.Fatalf("driver reached a shipment not assigned to them: %d %v", try.code, try.body)
		}
	}
	if r := e.move(driver, mine, "picked_up"); r.code != 200 {
		t.Fatalf("driver on own shipment: %d", r.code)
	}

	// Taking the driver off the job takes away access.
	e.assignTo(ops, mine, nil, nil)
	if r := e.do("GET", "/v1/shipments/"+mine, &driver, nil); r.code != 404 {
		t.Fatalf("unassigned driver still sees the shipment: %d", r.code)
	}
}

func TestDriverLinksOnlyByVerifiedEmail(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	impostor := testkit.Colleague(ops, auth.RoleDriver)
	impostor.Email = "real.driver@example.com"
	impostor.EmailUnverified = true
	e.addDriver(ops, "real.driver@example.com")

	if r := e.do("GET", "/v1/fleet/me", &impostor, nil); r.code != 404 || r.body["error"] != "not_a_driver" {
		t.Fatalf("unverified email linked: %d %v", r.code, r.body)
	}

	real := testkit.Colleague(ops, auth.RoleDriver)
	real.Email = "Real.Driver@example.com"
	r := e.do("GET", "/v1/fleet/me", &real, nil)
	if r.code != 200 || r.body["signed_in"] != true {
		t.Fatalf("verified email: %d %v", r.code, r.body)
	}
	// Once linked, the profile belongs to that login only.
	impostor.EmailUnverified = false
	if r := e.do("GET", "/v1/fleet/me", &impostor, nil); r.code != 404 {
		t.Fatalf("second login claimed a linked profile: %d", r.code)
	}
}

func TestChangingDriverEmailUnlinksLogin(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	driver := testkit.Colleague(ops, auth.RoleDriver)
	id := e.addDriver(ops, driver.Email)
	if r := e.do("GET", "/v1/fleet/me", &driver, nil); r.code != 200 {
		t.Fatalf("link: %d", r.code)
	}
	r := e.do("PATCH", "/v1/fleet/drivers/"+id, &ops, map[string]any{"email": "new.phone.owner@example.com"})
	if r.code != 200 || r.body["signed_in"] != false {
		t.Fatalf("email change should unlink: %d %v", r.code, r.body)
	}
	if r := e.do("GET", "/v1/fleet/me", &driver, nil); r.code != 404 {
		t.Fatalf("old login still linked: %d", r.code)
	}
}

func TestNoCrossCompanyAssignment(t *testing.T) {
	e := setup(t)
	a := testkit.NewUser(auth.RoleOperations)
	b := testkit.NewUser(auth.RoleOperations)
	e.fund(a, 10000)
	sh := e.book(a, "X1")["id"].(string)
	theirTruck := e.addVehicle(b, map[string]any{"registration": "KDD 4D"})
	theirDriver := e.addDriver(b, b.Email)

	if r := e.assignTo(a, sh, theirTruck, nil); r.code != 422 || r.body["error"] != "unknown_vehicle" {
		t.Fatalf("other company's truck: %d %v", r.code, r.body)
	}
	if r := e.assignTo(a, sh, nil, theirDriver); r.code != 422 || r.body["error"] != "unknown_driver" {
		t.Fatalf("other company's driver: %d %v", r.code, r.body)
	}
	if r := e.do("GET", "/v1/fleet/vehicles/"+theirTruck, &a, nil); r.code != 404 {
		t.Fatalf("other company's truck visible: %d", r.code)
	}

	// Even with every application check bypassed, the database refuses.
	ctx := context.Background()
	err := e.db.AsSystem(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE shipments SET vehicle_id = $1 WHERE id = $2`, theirTruck, sh)
		return err
	})
	if err == nil || !strings.Contains(err.Error(), "foreign key") {
		t.Fatalf("database accepted another company's truck: %v", err)
	}
}

func TestAssignmentIsRecordedPrivately(t *testing.T) {
	e := setup(t)
	ops := testkit.NewUser(auth.RoleOperations)
	e.fund(ops, 10000)
	booked := e.book(ops, "P1")
	id, number := booked["id"].(string), booked["tracking_number"].(string)
	truck := e.addVehicle(ops, map[string]any{"registration": "KDE 5E"})
	if r := e.assignTo(ops, id, truck, e.addDriver(ops, "p1@example.com")); r.code != 200 {
		t.Fatalf("assign: %d %v", r.code, r.body)
	}

	var assignment map[string]any
	for _, ev := range e.do("GET", "/v1/shipments/"+id+"/events", &ops, nil).body["events"].([]any) {
		if m := ev.(map[string]any); m["kind"] == "assignment" {
			assignment = m
		}
	}
	if assignment == nil || assignment["internal"] != true || !strings.Contains(assignment["note"].(string), "KDE 5E") {
		t.Fatalf("assignment event = %v", assignment)
	}
	pub := e.do("GET", "/v1/track/"+number, nil, nil)
	if pub.code != 200 {
		t.Fatalf("tracking: %d", pub.code)
	}
	for _, ev := range pub.body["events"].([]any) {
		if ev.(map[string]any)["kind"] == "assignment" {
			t.Fatalf("assignment visible on public tracking: %v", pub.body)
		}
	}

	if r := e.assignTo(ops, id, "not-a-uuid", nil); r.code != 422 {
		t.Fatalf("malformed vehicle id: %d", r.code)
	}
	e.move(ops, id, "cancelled")
	if r := e.assignTo(ops, id, nil, nil); r.code != 409 {
		t.Fatalf("reassigning a cancelled shipment: %d", r.code)
	}
}
