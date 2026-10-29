package shipments

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const shipmentColumns = `id, seq, tracking_number, reference, status,
	origin_name, origin_country, destination_name, destination_country,
	cargo_description, weight_kg::float8, pieces, pickup_at, deliver_by,
	picked_up_at, delivered_at, created_at, updated_at`

func scanShipment(row pgx.Row) (Shipment, error) {
	var s Shipment
	err := row.Scan(&s.ID, &s.seq, &s.TrackingNumber, &s.Reference, &s.Status,
		&s.OriginName, &s.OriginCountry, &s.DestinationName, &s.DestinationCountry,
		&s.CargoDescription, &s.WeightKg, &s.Pieces, &s.PickupAt, &s.DeliverBy,
		&s.PickedUpAt, &s.DeliveredAt, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

const eventColumns = `id, kind, from_status, to_status, location, latitude, longitude,
	note, internal, occurred_at, recorded_by, created_at`

func scanEvent(row pgx.Row) (Event, error) {
	var e Event
	err := row.Scan(&e.ID, &e.Kind, &e.FromStatus, &e.ToStatus, &e.Location, &e.Latitude, &e.Longitude,
		&e.Note, &e.Internal, &e.OccurredAt, &e.RecordedBy, &e.CreatedAt)
	return e, err
}

var errDuplicateIdempotencyKey = errors.New("shipments: idempotency key already used")

// findByIdempotencyKey returns the shipment booked with key and the
// fingerprint of the request that booked it.
func findByIdempotencyKey(ctx context.Context, tx pgx.Tx, orgID, key string) (Shipment, string, error) {
	var fingerprint string
	row := tx.QueryRow(ctx, `SELECT coalesce(idempotency_fingerprint, ''), `+shipmentColumns+`
		FROM shipments WHERE org_id = $1 AND idempotency_key = $2`, orgID, key)
	var s Shipment
	err := row.Scan(&fingerprint, &s.ID, &s.seq, &s.TrackingNumber, &s.Reference, &s.Status,
		&s.OriginName, &s.OriginCountry, &s.DestinationName, &s.DestinationCountry,
		&s.CargoDescription, &s.WeightKg, &s.Pieces, &s.PickupAt, &s.DeliverBy,
		&s.PickedUpAt, &s.DeliveredAt, &s.CreatedAt, &s.UpdatedAt)
	return s, fingerprint, err
}

func getShipment(ctx context.Context, tx pgx.Tx, id string, forUpdate bool) (Shipment, error) {
	q := `SELECT ` + shipmentColumns + ` FROM shipments WHERE id = $1`
	if forUpdate {
		q += ` FOR UPDATE`
	}
	return scanShipment(tx.QueryRow(ctx, q, id))
}

// insertShipment books a shipment, retrying on the (rare) collision of a
// random tracking number. A repeated idempotency key returns
// errDuplicateIdempotencyKey; the caller then fetches the original.
func insertShipment(ctx context.Context, tx pgx.Tx, orgID, userID, idemKey, fingerprint string, in createInput) (Shipment, error) {
	for attempt := 0; ; attempt++ {
		sp, err := tx.Begin(ctx)
		if err != nil {
			return Shipment{}, err
		}
		s, err := scanShipment(sp.QueryRow(ctx, `
			INSERT INTO shipments (org_id, tracking_number, reference, origin_name, origin_country,
			    destination_name, destination_country, cargo_description, weight_kg, pieces,
			    pickup_at, deliver_by, idempotency_key, idempotency_fingerprint, created_by)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
			RETURNING `+shipmentColumns,
			orgID, newTrackingNumber(), in.Reference, in.OriginName, in.OriginCountry,
			in.DestinationName, in.DestinationCountry, in.CargoDescription, in.WeightKg, in.Pieces,
			in.PickupAt, in.DeliverBy, idemKey, fingerprint, userID))
		if err == nil {
			return s, sp.Commit(ctx)
		}
		_ = sp.Rollback(ctx)
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) {
			return Shipment{}, err
		}
		switch pgErr.ConstraintName {
		case "shipments_org_id_idempotency_key_key":
			return Shipment{}, errDuplicateIdempotencyKey
		case "shipments_tracking_number_key":
			if attempt < 3 {
				continue
			}
		}
		return Shipment{}, err
	}
}

func insertEvent(ctx context.Context, tx pgx.Tx, orgID, shipmentID, userID string, e Event) (Event, error) {
	return scanEvent(tx.QueryRow(ctx, `
		INSERT INTO shipment_events (shipment_id, org_id, kind, from_status, to_status, location,
		    latitude, longitude, note, internal, occurred_at, recorded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING `+eventColumns,
		shipmentID, orgID, e.Kind, e.FromStatus, e.ToStatus, e.Location,
		e.Latitude, e.Longitude, e.Note, e.Internal, e.OccurredAt, nullable(userID)))
}

func listEvents(ctx context.Context, tx pgx.Tx, shipmentID string, publicOnly bool) ([]Event, error) {
	q := `SELECT ` + eventColumns + ` FROM shipment_events WHERE shipment_id = $1`
	if publicOnly {
		q += ` AND NOT internal AND kind <> 'note'`
	}
	rows, err := tx.Query(ctx, q+` ORDER BY occurred_at, id`, shipmentID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Event, error) { return scanEvent(row) })
}

func nullable(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
