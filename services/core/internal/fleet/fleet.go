// Package fleet keeps an organisation's vehicles and drivers, and answers
// the two questions the shipments module asks: which driver is this user,
// and may this vehicle and driver be put on a shipment.
//
// A vehicle with lapsed insurance or inspection, or a driver with an
// expired licence, cannot be assigned: an uninsured truck carrying a
// client's cargo is a liability CargoTrack would share in.
package fleet

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/cargotrack/core/internal/platform/auth"
	"github.com/cargotrack/core/internal/platform/database"
	"github.com/cargotrack/core/internal/platform/httpx"
)

// eat is East Africa Time; compliance dates expire at the end of the day
// in Kenya, not in UTC.
var eat = time.FixedZone("EAT", 3*60*60)

// Date is a calendar day, written as "2026-12-31" in JSON.
type Date struct{ time.Time }

func (d Date) MarshalJSON() ([]byte, error) { return json.Marshal(d.Format(time.DateOnly)) }

func (d *Date) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	t, err := time.Parse(time.DateOnly, s)
	if err != nil {
		return fmt.Errorf("dates are written YYYY-MM-DD, got %q", s)
	}
	d.Time = t
	return nil
}

func dateOrNil(t *time.Time) *Date {
	if t == nil {
		return nil
	}
	return &Date{*t}
}

func dateArg(d *Date) *time.Time {
	if d == nil {
		return nil
	}
	return &d.Time
}

// lapsed reports whether a date has passed in Kenya today.
func lapsed(d *Date, now time.Time) bool {
	if d == nil {
		return false
	}
	today := now.In(eat).Format(time.DateOnly)
	return d.Format(time.DateOnly) < today
}

type Vehicle struct {
	ID                  string    `json:"id"`
	Registration        string    `json:"registration"`
	Kind                string    `json:"kind"`
	CapacityKg          *float64  `json:"capacity_kg"`
	InsuranceExpiresOn  *Date     `json:"insurance_expires_on"`
	InspectionExpiresOn *Date     `json:"inspection_expires_on"`
	Active              bool      `json:"active"`
	Lapsed              []string  `json:"lapsed"` // e.g. ["insurance"]; empty when compliant
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type Driver struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Email            string    `json:"email"`
	Phone            string    `json:"phone"`
	LicenceNumber    string    `json:"licence_number"`
	LicenceExpiresOn Date      `json:"licence_expires_on"`
	Active           bool      `json:"active"`
	SignedIn         bool      `json:"signed_in"` // linked to a CargoTrack login
	LicenceLapsed    bool      `json:"licence_lapsed"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

var vehicleKinds = map[string]bool{
	"prime_mover": true, "rigid_truck": true, "trailer": true, "van": true, "pickup": true, "motorbike": true,
}

const vehicleColumns = `id, registration, kind, capacity_kg::float8, insurance_expires_on,
	inspection_expires_on, active, created_at, updated_at`

func (s *Service) scanVehicle(row pgx.Row) (Vehicle, error) {
	var v Vehicle
	var ins, insp *time.Time
	err := row.Scan(&v.ID, &v.Registration, &v.Kind, &v.CapacityKg, &ins, &insp, &v.Active, &v.CreatedAt, &v.UpdatedAt)
	v.InsuranceExpiresOn, v.InspectionExpiresOn = dateOrNil(ins), dateOrNil(insp)
	v.Lapsed = []string{}
	if lapsed(v.InsuranceExpiresOn, s.now()) {
		v.Lapsed = append(v.Lapsed, "insurance")
	}
	if lapsed(v.InspectionExpiresOn, s.now()) {
		v.Lapsed = append(v.Lapsed, "inspection")
	}
	return v, err
}

const driverColumns = `id, name, email, phone, licence_number, licence_expires_on, active,
	user_id IS NOT NULL, created_at, updated_at`

func (s *Service) scanDriver(row pgx.Row) (Driver, error) {
	var d Driver
	var exp time.Time
	err := row.Scan(&d.ID, &d.Name, &d.Email, &d.Phone, &d.LicenceNumber, &exp, &d.Active, &d.SignedIn, &d.CreatedAt, &d.UpdatedAt)
	d.LicenceExpiresOn = Date{exp}
	d.LicenceLapsed = lapsed(&d.LicenceExpiresOn, s.now())
	return d, err
}

// registrationKey makes "kda 123a", "KDA-123A" and "KDA123A" the same plate.
func registrationKey(reg string) string {
	return strings.Map(func(r rune) rune {
		if r == ' ' || r == '-' {
			return -1
		}
		return r
	}, strings.ToUpper(reg))
}

type Service struct {
	db  *database.DB
	now func() time.Time
}

func NewService(db *database.DB) *Service { return &Service{db: db, now: time.Now} }

func (s *Service) Routes(mux *http.ServeMux, authn func(http.Handler) http.Handler) {
	h := func(perm auth.Permission, fn httpx.HandlerFunc) http.Handler {
		return authn(httpx.Handle(auth.Require(perm, fn)))
	}
	mux.Handle("POST /v1/fleet/vehicles", h(auth.FleetManage, s.createVehicle))
	mux.Handle("GET /v1/fleet/vehicles", h(auth.FleetView, s.listVehicles))
	mux.Handle("GET /v1/fleet/vehicles/{id}", h(auth.FleetView, s.getVehicle))
	mux.Handle("PATCH /v1/fleet/vehicles/{id}", h(auth.FleetManage, s.updateVehicle))
	mux.Handle("POST /v1/fleet/drivers", h(auth.FleetManage, s.createDriver))
	mux.Handle("GET /v1/fleet/drivers", h(auth.FleetView, s.listDrivers))
	mux.Handle("GET /v1/fleet/drivers/{id}", h(auth.FleetView, s.getDriver))
	mux.Handle("PATCH /v1/fleet/drivers/{id}", h(auth.FleetManage, s.updateDriver))
	// Any signed-in user: a driver's own profile, linking it on first call.
	mux.Handle("GET /v1/fleet/me", authn(httpx.Handle(s.me)))
}

// ── Vehicles ─────────────────────────────────────────────────────────────────

type vehicleInput struct {
	Registration        *string  `json:"registration"`
	Kind                *string  `json:"kind"`
	CapacityKg          *float64 `json:"capacity_kg"`
	InsuranceExpiresOn  *Date    `json:"insurance_expires_on"`
	InspectionExpiresOn *Date    `json:"inspection_expires_on"`
	Active              *bool    `json:"active"`
}

func (in *vehicleInput) validate(creating bool) error {
	var problems []string
	if in.Registration != nil {
		*in.Registration = strings.ToUpper(strings.Join(strings.Fields(*in.Registration), " "))
		if k := registrationKey(*in.Registration); len(k) < 3 || len(k) > 15 {
			problems = append(problems, "registration must be 3 to 15 characters, e.g. KDA 123A")
		}
	} else if creating {
		problems = append(problems, "registration is required")
	}
	if in.Kind != nil {
		if !vehicleKinds[*in.Kind] {
			problems = append(problems, "kind must be prime_mover, rigid_truck, trailer, van, pickup or motorbike")
		}
	} else if creating {
		problems = append(problems, "kind is required")
	}
	if in.CapacityKg != nil && (*in.CapacityKg <= 0 || *in.CapacityKg > 200000) {
		problems = append(problems, "capacity_kg must be more than 0 and at most 200000")
	}
	return problemsError(problems)
}

func problemsError(problems []string) error {
	if len(problems) == 0 {
		return nil
	}
	e := httpx.BadRequest(strings.Join(problems, "; ") + ".")
	e.Details = map[string]any{"problems": problems}
	return e
}

var errDuplicateRegistration = httpx.NewError(http.StatusConflict, "duplicate_registration",
	"Your fleet already has a vehicle with this registration.")

func (s *Service) createVehicle(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var in vehicleInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	if err := in.validate(true); err != nil {
		return err
	}
	var v Vehicle
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		var err error
		v, err = s.scanVehicle(tx.QueryRow(ctx, `
			INSERT INTO vehicles (org_id, registration, registration_key, kind, capacity_kg,
			    insurance_expires_on, inspection_expires_on)
			VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING `+vehicleColumns,
			p.OrgID, *in.Registration, registrationKey(*in.Registration), *in.Kind, in.CapacityKg,
			dateArg(in.InsuranceExpiresOn), dateArg(in.InspectionExpiresOn)))
		return err
	})
	if isUnique(err, "vehicles_org_id_registration_key_key") {
		return errDuplicateRegistration
	}
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, v)
	return nil
}

func (s *Service) listVehicles(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var list []Vehicle
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+vehicleColumns+` FROM vehicles
			WHERE active OR $1 ORDER BY registration_key`, r.URL.Query().Get("include_inactive") == "true")
		if err != nil {
			return err
		}
		list, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Vehicle, error) { return s.scanVehicle(row) })
		return err
	})
	if err != nil {
		return err
	}
	if list == nil {
		list = []Vehicle{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"vehicles": list})
	return nil
}

func (s *Service) getVehicle(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	id := r.PathValue("id")
	if !httpx.IsUUID(id) {
		return httpx.ErrNotFound
	}
	var v Vehicle
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		var err error
		v, err = s.scanVehicle(tx.QueryRow(ctx, `SELECT `+vehicleColumns+` FROM vehicles WHERE id = $1`, id))
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return httpx.ErrNotFound
	}
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, v)
	return nil
}

func (s *Service) updateVehicle(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	id := r.PathValue("id")
	if !httpx.IsUUID(id) {
		return httpx.ErrNotFound
	}
	var in vehicleInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	if err := in.validate(false); err != nil {
		return err
	}
	var key *string
	if in.Registration != nil {
		k := registrationKey(*in.Registration)
		key = &k
	}
	var v Vehicle
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		var err error
		v, err = s.scanVehicle(tx.QueryRow(ctx, `
			UPDATE vehicles SET
			    registration = coalesce($2, registration), registration_key = coalesce($3, registration_key),
			    kind = coalesce($4, kind), capacity_kg = coalesce($5, capacity_kg),
			    insurance_expires_on = coalesce($6, insurance_expires_on),
			    inspection_expires_on = coalesce($7, inspection_expires_on),
			    active = coalesce($8, active), updated_at = now()
			WHERE id = $1 RETURNING `+vehicleColumns,
			id, in.Registration, key, in.Kind, in.CapacityKg,
			dateArg(in.InsuranceExpiresOn), dateArg(in.InspectionExpiresOn), in.Active))
		return err
	})
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return httpx.ErrNotFound
	case isUnique(err, "vehicles_org_id_registration_key_key"):
		return errDuplicateRegistration
	case err != nil:
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, v)
	return nil
}

// ── Drivers ──────────────────────────────────────────────────────────────────

type driverInput struct {
	Name             *string `json:"name"`
	Email            *string `json:"email"`
	Phone            *string `json:"phone"`
	LicenceNumber    *string `json:"licence_number"`
	LicenceExpiresOn *Date   `json:"licence_expires_on"`
	Active           *bool   `json:"active"`
}

func (in *driverInput) validate(creating bool) error {
	var problems []string
	trim := func(v *string) {
		if v != nil {
			*v = strings.TrimSpace(*v)
		}
	}
	trim(in.Name)
	trim(in.Phone)
	trim(in.LicenceNumber)
	if in.Email != nil {
		*in.Email = strings.ToLower(strings.TrimSpace(*in.Email))
		if *in.Email != "" && (!strings.Contains(*in.Email, "@") || len(*in.Email) > 254) {
			problems = append(problems, "email is not a valid address")
		}
	}
	if (in.Name == nil && creating) || (in.Name != nil && (*in.Name == "" || len(*in.Name) > 200)) {
		problems = append(problems, "name is required (at most 200 characters)")
	}
	if (in.LicenceNumber == nil && creating) || (in.LicenceNumber != nil && (*in.LicenceNumber == "" || len(*in.LicenceNumber) > 50)) {
		problems = append(problems, "licence_number is required (at most 50 characters)")
	}
	if in.LicenceExpiresOn == nil && creating {
		problems = append(problems, "licence_expires_on is required")
	}
	if in.Phone != nil && len(*in.Phone) > 20 {
		problems = append(problems, "phone is at most 20 characters")
	}
	return problemsError(problems)
}

var errDuplicateEmail = httpx.NewError(http.StatusConflict, "duplicate_email",
	"Another driver in your fleet already uses this email.")

func (s *Service) createDriver(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var in driverInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	if err := in.validate(true); err != nil {
		return err
	}
	email, phone := "", ""
	if in.Email != nil {
		email = *in.Email
	}
	if in.Phone != nil {
		phone = *in.Phone
	}
	var d Driver
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		var err error
		d, err = s.scanDriver(tx.QueryRow(ctx, `
			INSERT INTO drivers (org_id, name, email, phone, licence_number, licence_expires_on)
			VALUES ($1, $2, $3, $4, $5, $6) RETURNING `+driverColumns,
			p.OrgID, *in.Name, email, phone, *in.LicenceNumber, in.LicenceExpiresOn.Time))
		return err
	})
	if isUnique(err, "drivers_org_email_idx") {
		return errDuplicateEmail
	}
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, d)
	return nil
}

func (s *Service) listDrivers(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var list []Driver
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+driverColumns+` FROM drivers
			WHERE active OR $1 ORDER BY name`, r.URL.Query().Get("include_inactive") == "true")
		if err != nil {
			return err
		}
		list, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Driver, error) { return s.scanDriver(row) })
		return err
	})
	if err != nil {
		return err
	}
	if list == nil {
		list = []Driver{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"drivers": list})
	return nil
}

func (s *Service) getDriver(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	id := r.PathValue("id")
	if !httpx.IsUUID(id) {
		return httpx.ErrNotFound
	}
	var d Driver
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		var err error
		d, err = s.scanDriver(tx.QueryRow(ctx, `SELECT `+driverColumns+` FROM drivers WHERE id = $1`, id))
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return httpx.ErrNotFound
	}
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, d)
	return nil
}

func (s *Service) updateDriver(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	id := r.PathValue("id")
	if !httpx.IsUUID(id) {
		return httpx.ErrNotFound
	}
	var in driverInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	if err := in.validate(false); err != nil {
		return err
	}
	var d Driver
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		var err error
		// Changing the email unlinks the login: whoever owns the new
		// address must sign in to claim the profile.
		d, err = s.scanDriver(tx.QueryRow(ctx, `
			UPDATE drivers SET
			    user_id = CASE WHEN $3::text IS NOT NULL AND $3 <> email THEN NULL ELSE user_id END,
			    name = coalesce($2, name), email = coalesce($3, email), phone = coalesce($4, phone),
			    licence_number = coalesce($5, licence_number),
			    licence_expires_on = coalesce($6, licence_expires_on),
			    active = coalesce($7, active), updated_at = now()
			WHERE id = $1 RETURNING `+driverColumns,
			id, in.Name, in.Email, in.Phone, in.LicenceNumber, dateArg(in.LicenceExpiresOn), in.Active))
		return err
	})
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return httpx.ErrNotFound
	case isUnique(err, "drivers_org_email_idx"):
		return errDuplicateEmail
	case err != nil:
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, d)
	return nil
}

func (s *Service) me(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var d Driver
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		id, err := s.DriverIDForUser(ctx, tx, p)
		if err != nil {
			return err
		}
		if id == "" {
			return httpx.NewError(http.StatusNotFound, "not_a_driver",
				"No driver profile matches your verified email. Ask your fleet manager to add you.")
		}
		d, err = s.scanDriver(tx.QueryRow(ctx, `SELECT `+driverColumns+` FROM drivers WHERE id = $1`, id))
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, d)
	return nil
}

// ── Used by the shipments module ─────────────────────────────────────────────

// DriverIDForUser returns the caller's driver record ID, or "" if they have
// none. The first time a driver signs in, their login is linked to the
// active driver record with the same email, but only if Zitadel has
// verified that email: otherwise anyone could claim a driver's jobs by
// typing the driver's address.
func (s *Service) DriverIDForUser(ctx context.Context, tx pgx.Tx, p auth.Principal) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `SELECT id FROM drivers WHERE user_id = $1`, p.UserID).Scan(&id)
	if err == nil || !errors.Is(err, pgx.ErrNoRows) {
		return id, err
	}
	if !p.EmailVerified || p.Email == "" {
		return "", nil
	}
	err = tx.QueryRow(ctx, `
		UPDATE drivers SET user_id = $1, updated_at = now()
		WHERE org_id = $2 AND email = lower($3) AND user_id IS NULL AND active
		RETURNING id`, p.UserID, p.OrgID, p.Email).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// CheckAssignment verifies that the vehicle and driver (either may be nil)
// exist in the caller's organisation, are active, and are compliant today,
// and returns a short description for the shipment history.
func (s *Service) CheckAssignment(ctx context.Context, tx pgx.Tx, vehicleID, driverID *string) (string, error) {
	var parts []string
	if vehicleID != nil {
		if !httpx.IsUUID(*vehicleID) {
			return "", unknown("vehicle")
		}
		v, err := s.scanVehicle(tx.QueryRow(ctx, `SELECT `+vehicleColumns+` FROM vehicles WHERE id = $1`, *vehicleID))
		if errors.Is(err, pgx.ErrNoRows) {
			return "", unknown("vehicle")
		}
		if err != nil {
			return "", err
		}
		if !v.Active {
			return "", httpx.NewError(http.StatusConflict, "vehicle_inactive", v.Registration+" is marked inactive.")
		}
		if len(v.Lapsed) > 0 {
			e := httpx.NewError(http.StatusConflict, "vehicle_not_compliant",
				fmt.Sprintf("%s cannot be assigned: its %s has lapsed.", v.Registration, strings.Join(v.Lapsed, " and ")))
			e.Details = map[string]any{"lapsed": v.Lapsed}
			return "", e
		}
		parts = append(parts, "vehicle "+v.Registration)
	}
	if driverID != nil {
		if !httpx.IsUUID(*driverID) {
			return "", unknown("driver")
		}
		d, err := s.scanDriver(tx.QueryRow(ctx, `SELECT `+driverColumns+` FROM drivers WHERE id = $1`, *driverID))
		if errors.Is(err, pgx.ErrNoRows) {
			return "", unknown("driver")
		}
		if err != nil {
			return "", err
		}
		if !d.Active {
			return "", httpx.NewError(http.StatusConflict, "driver_inactive", d.Name+" is marked inactive.")
		}
		if d.LicenceLapsed {
			return "", httpx.NewError(http.StatusConflict, "driver_not_compliant",
				fmt.Sprintf("%s cannot be assigned: their driving licence expired on %s.", d.Name, d.LicenceExpiresOn.Format(time.DateOnly)))
		}
		parts = append(parts, "driver "+d.Name)
	}
	if len(parts) == 0 {
		return "Unassigned", nil
	}
	return "Assigned " + strings.Join(parts, ", "), nil
}

func unknown(what string) error {
	return httpx.NewError(http.StatusUnprocessableEntity, "unknown_"+what,
		fmt.Sprintf("No such %s in your fleet.", what))
}

func isUnique(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == constraint
}
