// Package shipments books shipments, moves them through their statuses,
// records their history, and serves public tracking.
//
// Booking is the paid action: it is charged (meter shipment.create) in the
// same transaction that inserts the shipment, and that one charge covers
// every tracking event afterwards, so a shipment already on the road never
// stops being tracked because the wallet ran low.
package shipments

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cargotrack/core/internal/platform/auth"
	"github.com/cargotrack/core/internal/platform/database"
	"github.com/cargotrack/core/internal/platform/httpx"
)

const MeterShipmentCreate = "shipment.create"

// Charger bills a paid action inside the caller's transaction.
// Implemented by billing.Service.
type Charger interface {
	Charge(ctx context.Context, tx pgx.Tx, p auth.Principal, meterCode string, quantity int, description string) error
}

type Service struct {
	db      *database.DB
	charger Charger
	now     func() time.Time
}

func NewService(db *database.DB, charger Charger) *Service {
	return &Service{db: db, charger: charger, now: time.Now}
}

func (s *Service) Routes(mux *http.ServeMux, authn func(http.Handler) http.Handler) {
	h := func(perm auth.Permission, fn httpx.HandlerFunc) http.Handler {
		return authn(httpx.Handle(auth.Require(perm, fn)))
	}
	mux.Handle("POST /v1/shipments", h(auth.ShipmentsManage, s.create))
	mux.Handle("GET /v1/shipments", h(auth.ShipmentsView, s.list))
	mux.Handle("GET /v1/shipments/{id}", h(auth.ShipmentsView, s.get))
	mux.Handle("PATCH /v1/shipments/{id}", h(auth.ShipmentsManage, s.update))
	mux.Handle("POST /v1/shipments/{id}/status", h(auth.ShipmentsTrack, s.changeStatus))
	mux.Handle("GET /v1/shipments/{id}/events", h(auth.ShipmentsView, s.events))
	mux.Handle("POST /v1/shipments/{id}/events", h(auth.ShipmentsTrack, s.addEvent))

	// Public: consignees track with the number on their waybill, no login.
	mux.Handle("GET /v1/track/{tracking_number}", httpx.Handle(s.track))
}

// ── Booking ──────────────────────────────────────────────────────────────────

type createInput struct {
	Reference          string    `json:"reference"`
	OriginName         string    `json:"origin_name"`
	OriginCountry      string    `json:"origin_country"`
	DestinationName    string    `json:"destination_name"`
	DestinationCountry string    `json:"destination_country"`
	CargoDescription   string    `json:"cargo_description"`
	WeightKg           float64   `json:"weight_kg"`
	Pieces             int       `json:"pieces"`
	PickupAt           time.Time `json:"pickup_at"`
	DeliverBy          time.Time `json:"deliver_by"`
}

var countryCode = regexp.MustCompile(`^[A-Z]{2}$`)

func (in *createInput) normalizeAndValidate() error {
	in.Reference = strings.TrimSpace(in.Reference)
	in.OriginName = strings.TrimSpace(in.OriginName)
	in.DestinationName = strings.TrimSpace(in.DestinationName)
	in.CargoDescription = strings.TrimSpace(in.CargoDescription)
	in.OriginCountry = strings.ToUpper(strings.TrimSpace(in.OriginCountry))
	in.DestinationCountry = strings.ToUpper(strings.TrimSpace(in.DestinationCountry))
	if in.Pieces == 0 {
		in.Pieces = 1
	}
	in.PickupAt, in.DeliverBy = in.PickupAt.UTC(), in.DeliverBy.UTC()

	var problems []string
	if in.OriginName == "" || len(in.OriginName) > 200 {
		problems = append(problems, "origin_name is required (at most 200 characters)")
	}
	if in.DestinationName == "" || len(in.DestinationName) > 200 {
		problems = append(problems, "destination_name is required (at most 200 characters)")
	}
	if !countryCode.MatchString(in.OriginCountry) || !countryCode.MatchString(in.DestinationCountry) {
		problems = append(problems, "origin_country and destination_country must be two-letter country codes, e.g. KE, UG")
	}
	if len(in.Reference) > 100 {
		problems = append(problems, "reference is at most 100 characters")
	}
	if len(in.CargoDescription) > 1000 {
		problems = append(problems, "cargo_description is at most 1000 characters")
	}
	if in.WeightKg <= 0 || in.WeightKg > 200000 {
		problems = append(problems, "weight_kg must be more than 0 and at most 200000")
	}
	if in.Pieces < 1 || in.Pieces > 100000 {
		problems = append(problems, "pieces must be between 1 and 100000")
	}
	if in.PickupAt.IsZero() || in.DeliverBy.IsZero() {
		problems = append(problems, "pickup_at and deliver_by are required")
	} else if !in.DeliverBy.After(in.PickupAt) {
		problems = append(problems, "deliver_by must be after pickup_at")
	}
	if len(problems) > 0 {
		e := httpx.BadRequest(strings.Join(problems, "; ") + ".")
		e.Details = map[string]any{"problems": problems}
		return e
	}
	return nil
}

// fingerprint identifies the contents of a booking request, after
// normalisation, so retries match even if whitespace differs.
func (in createInput) fingerprint() string {
	b, _ := json.Marshal(in)
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

var errKeyReused = httpx.NewError(http.StatusUnprocessableEntity, "idempotency_key_reused",
	"This Idempotency-Key was already used for a different shipment. Use a new key for each booking.")

func (s *Service) create(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if key == "" || len(key) > 100 {
		return httpx.NewError(http.StatusBadRequest, "idempotency_key_required",
			"Send an Idempotency-Key header (for example a UUID) so a retried request cannot book and charge twice.")
	}
	var in createInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	if err := in.normalizeAndValidate(); err != nil {
		return err
	}

	fp := in.fingerprint()
	replay := func(tx pgx.Tx) (Shipment, error) {
		existing, existingFP, err := findByIdempotencyKey(ctx, tx, p.OrgID, key)
		if err == nil && existingFP != fp {
			return existing, errKeyReused
		}
		return existing, err
	}

	var created Shipment
	replayed := false
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		existing, err := replay(tx)
		if err == nil {
			created, replayed = existing, true
			return nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		created, err = insertShipment(ctx, tx, p.OrgID, p.UserID, key, fp, in)
		if err != nil {
			return err
		}
		booked := Booked
		if _, err := insertEvent(ctx, tx, p.OrgID, created.ID, p.UserID, Event{
			Kind: "status", ToStatus: &booked, OccurredAt: s.now(),
		}); err != nil {
			return err
		}
		// Last write before commit: the wallet row is locked only briefly.
		return s.charger.Charge(ctx, tx, p, MeterShipmentCreate, 1, "Shipment "+created.TrackingNumber)
	})
	if errors.Is(err, errDuplicateIdempotencyKey) {
		// A concurrent request with the same key won the race; return its shipment.
		err = s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
			created, err = replay(tx)
			return err
		})
		replayed = true
	}
	if err != nil {
		return err
	}
	if replayed {
		w.Header().Set("Idempotent-Replayed", "true")
		httpx.WriteJSON(w, http.StatusOK, created)
		return nil
	}
	httpx.WriteJSON(w, http.StatusCreated, created)
	return nil
}

// ── Reading ──────────────────────────────────────────────────────────────────

func (s *Service) list(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	q := r.URL.Query()

	limit := 50
	if v := q.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 200 {
			return httpx.BadRequest("limit must be between 1 and 200.")
		}
		limit = n
	}
	var before int64
	if v := q.Get("cursor"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n < 1 {
			return httpx.BadRequest("cursor is not valid; use next_cursor from the previous page.")
		}
		before = n
	}
	// Empty, not nil: a nil slice reaches Postgres as NULL and would match nothing.
	statuses := []string{}
	if v := q.Get("status"); v != "" {
		for _, st := range strings.Split(v, ",") {
			st = strings.TrimSpace(st)
			if !Status(st).Valid() {
				return httpx.BadRequest(fmt.Sprintf("Unknown status %q.", st))
			}
			statuses = append(statuses, st)
		}
	}
	search := strings.TrimSpace(q.Get("q"))
	// Escape LIKE wildcards so a search for "50%" means what it says.
	like := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(search)

	var list []Shipment
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT `+shipmentColumns+` FROM shipments
			WHERE ($1 = 0 OR seq < $1)
			  AND (cardinality($2::text[]) = 0 OR status = ANY ($2))
			  AND ($3 = '' OR tracking_number = upper($3) OR reference ILIKE '%' || $5 || '%')
			ORDER BY seq DESC LIMIT $4`, before, statuses, search, limit, like)
		if err != nil {
			return err
		}
		list, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Shipment, error) { return scanShipment(row) })
		return err
	})
	if err != nil {
		return err
	}
	var next *string
	if len(list) == limit {
		c := strconv.FormatInt(list[len(list)-1].seq, 10)
		next = &c
	}
	if list == nil {
		list = []Shipment{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"shipments": list, "next_cursor": next})
	return nil
}

func (s *Service) load(ctx context.Context, tx pgx.Tx, id string, forUpdate bool) (Shipment, error) {
	if !httpx.IsUUID(id) {
		return Shipment{}, httpx.ErrNotFound
	}
	sh, err := getShipment(ctx, tx, id, forUpdate)
	if errors.Is(err, pgx.ErrNoRows) {
		return sh, httpx.ErrNotFound
	}
	return sh, err
}

func (s *Service) get(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var sh Shipment
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		var err error
		sh, err = s.load(ctx, tx, r.PathValue("id"), false)
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, sh)
	return nil
}

func (s *Service) events(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var list []Event
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		sh, err := s.load(ctx, tx, r.PathValue("id"), false)
		if err != nil {
			return err
		}
		list, err = listEvents(ctx, tx, sh.ID, false)
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"events": list})
	return nil
}

// ── Editing ──────────────────────────────────────────────────────────────────

// updateInput holds the fields that may change before pickup. Editing is
// free, which is why mistakes are fixed here rather than by cancelling.
type updateInput struct {
	Reference          *string    `json:"reference"`
	OriginName         *string    `json:"origin_name"`
	OriginCountry      *string    `json:"origin_country"`
	DestinationName    *string    `json:"destination_name"`
	DestinationCountry *string    `json:"destination_country"`
	CargoDescription   *string    `json:"cargo_description"`
	WeightKg           *float64   `json:"weight_kg"`
	Pieces             *int       `json:"pieces"`
	PickupAt           *time.Time `json:"pickup_at"`
	DeliverBy          *time.Time `json:"deliver_by"`
}

func (s *Service) update(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var patch updateInput
	if err := httpx.Decode(r, &patch); err != nil {
		return err
	}
	var sh Shipment
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		cur, err := s.load(ctx, tx, r.PathValue("id"), true)
		if err != nil {
			return err
		}
		if cur.Status != Booked {
			return httpx.NewError(http.StatusConflict, "not_editable",
				"A shipment can only be edited before pickup. Record a note or an exception instead.")
		}
		in := createInput{
			Reference: cur.Reference, OriginName: cur.OriginName, OriginCountry: cur.OriginCountry,
			DestinationName: cur.DestinationName, DestinationCountry: cur.DestinationCountry,
			CargoDescription: cur.CargoDescription, WeightKg: cur.WeightKg, Pieces: cur.Pieces,
			PickupAt: cur.PickupAt, DeliverBy: cur.DeliverBy,
		}
		apply(&in.Reference, patch.Reference)
		apply(&in.OriginName, patch.OriginName)
		apply(&in.OriginCountry, patch.OriginCountry)
		apply(&in.DestinationName, patch.DestinationName)
		apply(&in.DestinationCountry, patch.DestinationCountry)
		apply(&in.CargoDescription, patch.CargoDescription)
		apply(&in.WeightKg, patch.WeightKg)
		apply(&in.Pieces, patch.Pieces)
		apply(&in.PickupAt, patch.PickupAt)
		apply(&in.DeliverBy, patch.DeliverBy)
		if err := in.normalizeAndValidate(); err != nil {
			return err
		}
		sh, err = scanShipment(tx.QueryRow(ctx, `
			UPDATE shipments SET reference = $2, origin_name = $3, origin_country = $4,
			    destination_name = $5, destination_country = $6, cargo_description = $7,
			    weight_kg = $8, pieces = $9, pickup_at = $10, deliver_by = $11, updated_at = now()
			WHERE id = $1 RETURNING `+shipmentColumns,
			cur.ID, in.Reference, in.OriginName, in.OriginCountry, in.DestinationName, in.DestinationCountry,
			in.CargoDescription, in.WeightKg, in.Pieces, in.PickupAt, in.DeliverBy))
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, sh)
	return nil
}

func apply[T any](dst *T, v *T) {
	if v != nil {
		*dst = *v
	}
}

// ── Status and events ────────────────────────────────────────────────────────

type eventInput struct {
	Status     Status     `json:"status"` // status changes only
	Kind       string     `json:"kind"`   // events only: checkpoint | delay | note
	Location   string     `json:"location"`
	Latitude   *float64   `json:"latitude"`
	Longitude  *float64   `json:"longitude"`
	Note       string     `json:"note"`
	Internal   bool       `json:"internal"`
	OccurredAt *time.Time `json:"occurred_at"`
}

// common validates the fields status changes and events share, and
// returns the time the thing happened.
func (s *Service) common(in *eventInput) (time.Time, error) {
	in.Location = strings.TrimSpace(in.Location)
	in.Note = strings.TrimSpace(in.Note)
	if len(in.Location) > 200 || len(in.Note) > 2000 {
		return time.Time{}, httpx.BadRequest("location is at most 200 characters and note at most 2000.")
	}
	if (in.Latitude == nil) != (in.Longitude == nil) {
		return time.Time{}, httpx.BadRequest("Send latitude and longitude together.")
	}
	if in.Latitude != nil && (*in.Latitude < -90 || *in.Latitude > 90 || *in.Longitude < -180 || *in.Longitude > 180) {
		return time.Time{}, httpx.BadRequest("latitude or longitude is out of range.")
	}
	now := s.now()
	at := now
	if in.OccurredAt != nil {
		at = *in.OccurredAt
		// Allow for phone clocks that run a little fast, not for the future.
		if at.After(now.Add(5 * time.Minute)) {
			return time.Time{}, httpx.BadRequest("occurred_at cannot be in the future.")
		}
	}
	return at, nil
}

func (s *Service) changeStatus(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var in eventInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	if in.Kind != "" {
		return httpx.BadRequest("kind is for events; this endpoint takes status.")
	}
	if !in.Status.Valid() {
		return httpx.BadRequest("status must be one of booked, picked_up, in_transit, customs, exception, delivered, cancelled.")
	}
	// Cancelling throws away a paid booking, so it needs booking rights,
	// not just tracking rights.
	if in.Status == Cancelled && !p.Can(auth.ShipmentsManage) {
		return httpx.ErrForbidden
	}
	at, err := s.common(&in)
	if err != nil {
		return err
	}

	var sh Shipment
	var ev Event
	err = s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		cur, err := s.load(ctx, tx, r.PathValue("id"), true)
		if err != nil {
			return err
		}
		if !cur.Status.CanMoveTo(in.Status) {
			e := httpx.NewError(http.StatusConflict, "invalid_transition",
				fmt.Sprintf("A %s shipment cannot move to %s.", cur.Status, in.Status))
			e.Details = map[string]any{"from": cur.Status, "allowed": transitions[cur.Status]}
			return e
		}
		sh, err = scanShipment(tx.QueryRow(ctx, `
			UPDATE shipments SET status = $2, updated_at = now(),
			    picked_up_at = CASE WHEN $2 = 'picked_up' THEN $3 ELSE picked_up_at END,
			    delivered_at = CASE WHEN $2 = 'delivered' THEN $3 ELSE delivered_at END
			WHERE id = $1 RETURNING `+shipmentColumns, cur.ID, in.Status, at))
		if err != nil {
			return err
		}
		from, to := cur.Status, in.Status
		ev, err = insertEvent(ctx, tx, p.OrgID, cur.ID, p.UserID, Event{
			Kind: "status", FromStatus: &from, ToStatus: &to, Location: in.Location,
			Latitude: in.Latitude, Longitude: in.Longitude, Note: in.Note, Internal: in.Internal, OccurredAt: at,
		})
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"shipment": sh, "event": ev})
	return nil
}

func (s *Service) addEvent(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var in eventInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	if in.Status != "" {
		return httpx.BadRequest("Change status with POST /v1/shipments/{id}/status.")
	}
	if in.Kind != "checkpoint" && in.Kind != "delay" && in.Kind != "note" {
		return httpx.BadRequest("kind must be checkpoint, delay or note.")
	}
	at, err := s.common(&in)
	if err != nil {
		return err
	}
	if in.Kind == "checkpoint" && in.Location == "" && in.Latitude == nil {
		return httpx.BadRequest("A checkpoint needs a location or coordinates.")
	}
	if in.Kind != "checkpoint" && in.Note == "" {
		return httpx.BadRequest("A delay or note needs a note.")
	}

	var ev Event
	err = s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		cur, err := s.load(ctx, tx, r.PathValue("id"), false)
		if err != nil {
			return err
		}
		if cur.Status.Final() && in.Kind != "note" {
			return httpx.NewError(http.StatusConflict, "shipment_closed",
				fmt.Sprintf("The shipment is %s; only notes can be added.", cur.Status))
		}
		ev, err = insertEvent(ctx, tx, p.OrgID, cur.ID, p.UserID, Event{
			Kind: in.Kind, Location: in.Location, Latitude: in.Latitude, Longitude: in.Longitude,
			Note: in.Note, Internal: in.Internal, OccurredAt: at,
		})
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, ev)
	return nil
}

// ── Public tracking ──────────────────────────────────────────────────────────

// PublicEvent is what a consignee sees: where and when, never who or why.
type PublicEvent struct {
	Kind       string    `json:"kind"`
	Status     *Status   `json:"status,omitempty"`
	Location   string    `json:"location"`
	OccurredAt time.Time `json:"occurred_at"`
}

func (s *Service) track(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	number := normalizeTrackingNumber(r.PathValue("tracking_number"))
	if len(number) != 12 || !strings.HasPrefix(number, "CT") {
		return httpx.ErrNotFound
	}
	var sh Shipment
	var events []Event
	// No user, so no tenant to scope to; only the public fields below are
	// returned.
	err := s.db.AsSystem(ctx, func(tx pgx.Tx) error {
		var err error
		sh, err = scanShipment(tx.QueryRow(ctx,
			`SELECT `+shipmentColumns+` FROM shipments WHERE tracking_number = $1`, number))
		if err != nil {
			return err
		}
		events, err = listEvents(ctx, tx, sh.ID, true)
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return httpx.ErrNotFound
	}
	if err != nil {
		return err
	}
	public := make([]PublicEvent, 0, len(events))
	for _, e := range events {
		public = append(public, PublicEvent{Kind: e.Kind, Status: e.ToStatus, Location: e.Location, OccurredAt: e.OccurredAt})
	}
	w.Header().Set("Cache-Control", "public, max-age=30")
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"tracking_number":     sh.TrackingNumber,
		"status":              sh.Status,
		"origin_name":         sh.OriginName,
		"origin_country":      sh.OriginCountry,
		"destination_name":    sh.DestinationName,
		"destination_country": sh.DestinationCountry,
		"deliver_by":          sh.DeliverBy,
		"picked_up_at":        sh.PickedUpAt,
		"delivered_at":        sh.DeliveredAt,
		"events":              public,
	})
	return nil
}
