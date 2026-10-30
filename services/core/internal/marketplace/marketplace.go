// Package marketplace lets a shipper put a booked shipment out to carriers
// from other organisations, collect sealed bids, and hand the shipment to
// the carrier it accepts.
//
// The shipper pays a listing fee (meter marketplace.listing); bidding is
// free, because what shippers pay for is many bids per load, and East
// African carriers are small and price-sensitive. The bid price is agreed
// here and paid between the two companies directly: CargoTrack never holds
// freight money.
package marketplace

import (
	"context"
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
	"github.com/cargotrack/core/internal/shipments"
)

const MeterListing = "marketplace.listing"

// Charger bills a paid action inside the caller's transaction.
type Charger interface {
	Charge(ctx context.Context, tx pgx.Tx, p auth.Principal, meterCode string, quantity int, description string) error
}

type Service struct {
	db        *database.DB
	charger   Charger
	shipments *shipments.Service
	now       func() time.Time
}

func NewService(db *database.DB, charger Charger, ship *shipments.Service) *Service {
	return &Service{db: db, charger: charger, shipments: ship, now: time.Now}
}

// Listing is a load as carriers see it. ShipmentID and BidCount are only
// filled in for the owner.
type Listing struct {
	ID                 string    `json:"id"`
	Mine               bool      `json:"mine"`
	ShipmentID         *string   `json:"shipment_id,omitempty"`
	OriginName         string    `json:"origin_name"`
	OriginCountry      string    `json:"origin_country"`
	DestinationName    string    `json:"destination_name"`
	DestinationCountry string    `json:"destination_country"`
	CargoDescription   string    `json:"cargo_description"`
	WeightKg           float64   `json:"weight_kg"`
	Pieces             int       `json:"pieces"`
	PickupAt           time.Time `json:"pickup_at"`
	DeliverBy          time.Time `json:"deliver_by"`
	Notes              string    `json:"notes"`
	ClosesAt           time.Time `json:"closes_at"`
	Status             string    `json:"status"`
	BiddingOpen        bool      `json:"bidding_open"`
	BidCount           *int      `json:"bid_count,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
	seq                int64
	orgID              string
	shipmentID         string
}

type Bid struct {
	ID          string    `json:"id"`
	ListingID   string    `json:"listing_id"`
	CarrierName string    `json:"carrier_name"`
	PriceCents  int64     `json:"price_cents"`
	Currency    string    `json:"currency"`
	Note        string    `json:"note"`
	Status      string    `json:"status"`
	ShipmentID  *string   `json:"shipment_id"` // set once accepted
	CreatedAt   time.Time `json:"created_at"`
	Mine        bool      `json:"mine"`
	carrierOrg  string
}

const listingColumns = `id, seq, org_id, shipment_id, origin_name, origin_country, destination_name,
	destination_country, cargo_description, weight_kg::float8, pieces, pickup_at, deliver_by, notes,
	closes_at, status, created_at,
	(SELECT count(*) FROM bids b WHERE b.listing_id = listings.id AND b.status <> 'withdrawn')::int`

func (s *Service) scanListing(row pgx.Row, p auth.Principal) (Listing, error) {
	var l Listing
	var bids int
	err := row.Scan(&l.ID, &l.seq, &l.orgID, &l.shipmentID, &l.OriginName, &l.OriginCountry, &l.DestinationName,
		&l.DestinationCountry, &l.CargoDescription, &l.WeightKg, &l.Pieces, &l.PickupAt, &l.DeliverBy, &l.Notes,
		&l.ClosesAt, &l.Status, &l.CreatedAt, &bids)
	l.Mine = l.orgID == p.OrgID
	l.BiddingOpen = l.Status == "open" && s.now().Before(l.ClosesAt)
	if l.Mine {
		l.ShipmentID, l.BidCount = &l.shipmentID, &bids
	}
	return l, err
}

const bidColumns = `id, listing_id, carrier_org_id, carrier_name, price_cents, note, status, shipment_id, created_at`

func scanBid(row pgx.Row, p auth.Principal) (Bid, error) {
	var b Bid
	err := row.Scan(&b.ID, &b.ListingID, &b.carrierOrg, &b.CarrierName, &b.PriceCents, &b.Note, &b.Status, &b.ShipmentID, &b.CreatedAt)
	b.Currency = "KES"
	b.Mine = b.carrierOrg == p.OrgID
	return b, err
}

func (s *Service) Routes(mux *http.ServeMux, authn func(http.Handler) http.Handler) {
	h := func(perm auth.Permission, fn httpx.HandlerFunc) http.Handler {
		return authn(httpx.Handle(auth.Require(perm, fn)))
	}
	mux.Handle("POST /v1/marketplace/listings", h(auth.ShipmentsManage, s.createListing))
	mux.Handle("GET /v1/marketplace/listings", h(auth.MarketplaceView, s.listListings))
	mux.Handle("GET /v1/marketplace/listings/{id}", h(auth.MarketplaceView, s.getListing))
	mux.Handle("POST /v1/marketplace/listings/{id}/withdraw", h(auth.ShipmentsManage, s.withdrawListing))
	mux.Handle("POST /v1/marketplace/listings/{id}/bids", h(auth.MarketplaceBid, s.createBid))
	mux.Handle("GET /v1/marketplace/listings/{id}/bids", h(auth.MarketplaceView, s.listingBids))
	mux.Handle("GET /v1/marketplace/bids", h(auth.MarketplaceBid, s.myBids))
	mux.Handle("POST /v1/marketplace/bids/{id}/withdraw", h(auth.MarketplaceBid, s.withdrawBid))
	mux.Handle("POST /v1/marketplace/bids/{id}/accept", h(auth.ShipmentsManage, s.acceptBid))
}

// ── Listing ──────────────────────────────────────────────────────────────────

type listingInput struct {
	ShipmentID string     `json:"shipment_id"`
	ClosesAt   *time.Time `json:"closes_at"`
	Notes      string     `json:"notes"`
}

func (s *Service) createListing(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var in listingInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	in.Notes = strings.TrimSpace(in.Notes)
	if len(in.Notes) > 2000 {
		return httpx.BadRequest("notes is at most 2000 characters.")
	}

	var l Listing
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		sh, err := s.shipments.Listable(ctx, tx, p, in.ShipmentID)
		if err != nil {
			return err
		}
		// Bidding closes by pickup at the latest; by default after three
		// days or at pickup, whichever is sooner.
		closes := sh.PickupAt
		if d := s.now().Add(72 * time.Hour); d.Before(closes) {
			closes = d
		}
		if in.ClosesAt != nil {
			closes = *in.ClosesAt
		}
		if !closes.After(s.now().Add(15*time.Minute)) || closes.After(sh.PickupAt) {
			return httpx.BadRequest("closes_at must be at least 15 minutes from now and no later than pickup.")
		}
		l, err = s.scanListing(tx.QueryRow(ctx, `
			INSERT INTO listings (org_id, shipment_id, origin_name, origin_country, destination_name,
			    destination_country, cargo_description, weight_kg, pieces, pickup_at, deliver_by,
			    notes, closes_at, created_by)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			RETURNING `+listingColumns,
			p.OrgID, sh.ID, sh.OriginName, sh.OriginCountry, sh.DestinationName, sh.DestinationCountry,
			sh.CargoDescription, sh.WeightKg, sh.Pieces, sh.PickupAt, sh.DeliverBy, in.Notes, closes, p.UserID), p)
		if isUnique(err, "listings_one_open_idx") {
			return httpx.NewError(http.StatusConflict, "already_listed", "This shipment is already on the marketplace.")
		}
		if err != nil {
			return err
		}
		return s.charger.Charge(ctx, tx, p, MeterListing, 1, "Listing for shipment "+sh.TrackingNumber)
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, l)
	return nil
}

// listListings: scope=open (default) is the load board of other
// organisations' loads still taking bids; scope=mine is the caller's own
// listings in any status.
func (s *Service) listListings(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "open"
	}
	if scope != "open" && scope != "mine" {
		return httpx.BadRequest("scope must be open or mine.")
	}
	var list []Listing
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		q := `SELECT ` + listingColumns + ` FROM listings WHERE status = 'open' AND closes_at > now() AND org_id <> $1`
		if scope == "mine" {
			q = `SELECT ` + listingColumns + ` FROM listings WHERE org_id = $1`
		}
		rows, err := tx.Query(ctx, q+` ORDER BY seq DESC LIMIT 200`, p.OrgID)
		if err != nil {
			return err
		}
		list, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Listing, error) { return s.scanListing(row, p) })
		return err
	})
	if err != nil {
		return err
	}
	if list == nil {
		list = []Listing{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"listings": list})
	return nil
}

func (s *Service) loadListing(ctx context.Context, tx pgx.Tx, p auth.Principal, id string, forUpdate bool) (Listing, error) {
	if !httpx.IsUUID(id) {
		return Listing{}, httpx.ErrNotFound
	}
	q := `SELECT ` + listingColumns + ` FROM listings WHERE id = $1`
	if forUpdate {
		q += ` FOR UPDATE`
	}
	l, err := s.scanListing(tx.QueryRow(ctx, q, id), p)
	if errors.Is(err, pgx.ErrNoRows) {
		return l, httpx.ErrNotFound
	}
	return l, err
}

func (s *Service) getListing(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var l Listing
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		var err error
		l, err = s.loadListing(ctx, tx, p, r.PathValue("id"), false)
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, l)
	return nil
}

func (s *Service) withdrawListing(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var l Listing
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		cur, err := s.loadListing(ctx, tx, p, r.PathValue("id"), true)
		if err != nil {
			return err
		}
		if !cur.Mine {
			return httpx.ErrNotFound
		}
		if cur.Status != "open" {
			return httpx.NewError(http.StatusConflict, "listing_closed", "This listing is already "+cur.Status+".")
		}
		if err := s.WithdrawForShipment(ctx, tx, cur.shipmentID); err != nil {
			return err
		}
		l, err = s.loadListing(ctx, tx, p, cur.ID, false)
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, l)
	return nil
}

// ── Bidding ──────────────────────────────────────────────────────────────────

type bidInput struct {
	PriceCents int64  `json:"price_cents"`
	Note       string `json:"note"`
}

func (s *Service) createBid(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var in bidInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	in.Note = strings.TrimSpace(in.Note)
	if in.PriceCents <= 0 || in.PriceCents > 100_000_000_00 {
		return httpx.BadRequest("price_cents must be more than 0 and at most KES 100,000,000.")
	}
	if len(in.Note) > 1000 {
		return httpx.BadRequest("note is at most 1000 characters.")
	}
	var b Bid
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		l, err := s.loadListing(ctx, tx, p, r.PathValue("id"), false)
		if err != nil {
			return err
		}
		if l.Mine {
			return httpx.NewError(http.StatusConflict, "own_listing", "You cannot bid on your own load.")
		}
		if !l.BiddingOpen {
			return httpx.NewError(http.StatusConflict, "bidding_closed", "Bidding on this load has closed.")
		}
		var carrierName string
		if err := tx.QueryRow(ctx, `SELECT name FROM organizations WHERE id = $1`, p.OrgID).Scan(&carrierName); err != nil {
			return err
		}
		b, err = scanBid(tx.QueryRow(ctx, `
			INSERT INTO bids (listing_id, carrier_org_id, carrier_name, price_cents, note, created_by)
			VALUES ($1, $2, $3, $4, $5, $6) RETURNING `+bidColumns,
			l.ID, p.OrgID, carrierName, in.PriceCents, in.Note, p.UserID), p)
		if isUnique(err, "bids_one_pending_idx") {
			return httpx.NewError(http.StatusConflict, "already_bid",
				"You already have a bid on this load. Withdraw it to bid again.")
		}
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, b)
	return nil
}

// listingBids shows the owner every bid; a carrier sees only its own,
// because row-level security hides competitors' bids.
func (s *Service) listingBids(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var list []Bid
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		if !httpx.IsUUID(r.PathValue("id")) {
			return httpx.ErrNotFound
		}
		rows, err := tx.Query(ctx, `SELECT `+bidColumns+` FROM bids WHERE listing_id = $1
			ORDER BY price_cents, created_at`, r.PathValue("id"))
		if err != nil {
			return err
		}
		list, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Bid, error) { return scanBid(row, p) })
		return err
	})
	if err != nil {
		return err
	}
	if list == nil {
		list = []Bid{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"bids": list})
	return nil
}

func (s *Service) myBids(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var list []Bid
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT `+bidColumns+` FROM bids WHERE carrier_org_id = $1
			ORDER BY created_at DESC LIMIT 200`, p.OrgID)
		if err != nil {
			return err
		}
		list, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Bid, error) { return scanBid(row, p) })
		return err
	})
	if err != nil {
		return err
	}
	if list == nil {
		list = []Bid{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"bids": list})
	return nil
}

func (s *Service) loadBid(ctx context.Context, tx pgx.Tx, p auth.Principal, id string) (Bid, error) {
	if !httpx.IsUUID(id) {
		return Bid{}, httpx.ErrNotFound
	}
	b, err := scanBid(tx.QueryRow(ctx, `SELECT `+bidColumns+` FROM bids WHERE id = $1 FOR UPDATE`, id), p)
	if errors.Is(err, pgx.ErrNoRows) {
		return b, httpx.ErrNotFound
	}
	return b, err
}

func (s *Service) withdrawBid(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var b Bid
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		cur, err := s.loadBid(ctx, tx, p, r.PathValue("id"))
		if err != nil {
			return err
		}
		if !cur.Mine {
			return httpx.ErrNotFound
		}
		if cur.Status != "pending" {
			return httpx.NewError(http.StatusConflict, "bid_closed", "This bid is already "+cur.Status+".")
		}
		b, err = scanBid(tx.QueryRow(ctx, `UPDATE bids SET status = 'withdrawn', updated_at = now()
			WHERE id = $1 RETURNING `+bidColumns, cur.ID), p)
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, b)
	return nil
}

// acceptBid awards the load. The shipper may accept after bidding closes;
// closing only stops new bids.
func (s *Service) acceptBid(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var b Bid
	var l Listing
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		cur, err := s.loadBid(ctx, tx, p, r.PathValue("id"))
		if err != nil {
			return err
		}
		// Lock the listing first: two accepts racing on one load must not
		// both win.
		l, err = s.loadListing(ctx, tx, p, cur.ListingID, true)
		if err != nil {
			return err
		}
		if !l.Mine {
			return httpx.ErrNotFound
		}
		if l.Status != "open" {
			return httpx.NewError(http.StatusConflict, "listing_closed", "This load is already "+l.Status+".")
		}
		if cur.Status != "pending" {
			return httpx.NewError(http.StatusConflict, "bid_closed", "This bid is "+cur.Status+".")
		}
		if err := s.shipments.Award(ctx, tx, p, l.shipmentID, cur.carrierOrg,
			fmt.Sprintf("Awarded on the marketplace to %s at KES %s", cur.CarrierName, kes(cur.PriceCents))); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE bids SET status = 'rejected', updated_at = now()
			WHERE listing_id = $1 AND status = 'pending' AND id <> $2`, l.ID, cur.ID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE listings SET status = 'awarded', awarded_bid_id = $2, updated_at = now()
			WHERE id = $1`, l.ID, cur.ID); err != nil {
			return err
		}
		b, err = scanBid(tx.QueryRow(ctx, `UPDATE bids SET status = 'accepted', shipment_id = $2, updated_at = now()
			WHERE id = $1 RETURNING `+bidColumns, cur.ID, l.shipmentID), p)
		if err != nil {
			return err
		}
		l, err = s.loadListing(ctx, tx, p, l.ID, false)
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"listing": l, "bid": b})
	return nil
}

// ── Used by the shipments module ─────────────────────────────────────────────

// IsListed reports whether the shipment has an open listing.
func (s *Service) IsListed(ctx context.Context, tx pgx.Tx, shipmentID string) (bool, error) {
	var listed bool
	err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM listings WHERE shipment_id = $1 AND status = 'open')`,
		shipmentID).Scan(&listed)
	return listed, err
}

// WithdrawForShipment closes the shipment's open listing, if any, and
// turns down its pending bids.
func (s *Service) WithdrawForShipment(ctx context.Context, tx pgx.Tx, shipmentID string) error {
	var listingID string
	err := tx.QueryRow(ctx, `UPDATE listings SET status = 'withdrawn', updated_at = now()
		WHERE shipment_id = $1 AND status = 'open' RETURNING id`, shipmentID).Scan(&listingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE bids SET status = 'rejected', updated_at = now()
		WHERE listing_id = $1 AND status = 'pending'`, listingID)
	return err
}

func kes(cents int64) string {
	whole := fmt.Sprintf("%d", cents/100)
	var b strings.Builder
	for i, c := range whole {
		if i > 0 && (len(whole)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(c)
	}
	if rem := cents % 100; rem != 0 {
		fmt.Fprintf(&b, ".%02d", rem)
	}
	return b.String()
}

func isUnique(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == constraint
}
