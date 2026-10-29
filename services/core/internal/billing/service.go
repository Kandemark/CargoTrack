// Package billing runs CargoTrack's prepaid wallets: every organisation
// tops up KES credit through a payment provider, and paid actions are
// deducted from it. An action without credit behind it does not run.
//
// Other modules bill an action by calling Service.Charge inside the same
// transaction as the action, so the two commit or roll back together.
package billing

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cargotrack/core/internal/payments"
	"github.com/cargotrack/core/internal/platform/auth"
	"github.com/cargotrack/core/internal/platform/database"
	"github.com/cargotrack/core/internal/platform/httpx"
)

type Options struct {
	MinTopUpCents   int64
	LowBalanceCents int64
	// CheckInterval is the minimum gap between provider status checks for
	// one top-up when a customer polls, so polling cannot hammer Daraja.
	CheckInterval time.Duration
}

type Service struct {
	db        *database.DB
	providers *payments.Registry
	opts      Options
}

func NewService(db *database.DB, providers *payments.Registry, opts Options) *Service {
	return &Service{db: db, providers: providers, opts: opts}
}

// Charge bills the caller's organisation for quantity units of meterCode
// inside tx. Call it after the action's own writes, just before commit,
// so the wallet row stays locked for as short a time as possible.
//
// Without enough credit it returns a 402 *httpx.Error; returning it from
// the handler rolls back the action. Platform owners are never billed.
func (s *Service) Charge(ctx context.Context, tx pgx.Tx, p auth.Principal, meterCode string, quantity int, description string) error {
	if p.IsPlatformOwner() {
		return nil
	}
	_, err := charge(ctx, tx, p.OrgID, meterCode, quantity, p.UserID, description)
	var short *InsufficientCreditError
	if errors.As(err, &short) {
		return &httpx.Error{
			Status:  http.StatusPaymentRequired,
			Code:    "insufficient_credit",
			Message: "Your CargoTrack wallet does not have enough credit for this. Top up to continue.",
			Details: map[string]any{
				"meter":         short.Meter,
				"price_cents":   short.RequiredCents,
				"balance_cents": short.BalanceCents,
				"currency":      "KES",
			},
		}
	}
	return err
}

func (s *Service) Routes(mux *http.ServeMux, authn func(http.Handler) http.Handler) {
	h := func(perm auth.Permission, fn httpx.HandlerFunc) http.Handler {
		return authn(httpx.Handle(auth.Require(perm, fn)))
	}
	mux.Handle("GET /v1/billing/wallet", h(auth.BillingView, s.getWallet))
	mux.Handle("GET /v1/billing/ledger", h(auth.BillingView, s.getLedger))
	mux.Handle("GET /v1/billing/topups", h(auth.BillingView, s.listTopUps))
	mux.Handle("POST /v1/billing/topups", h(auth.BillingManage, s.createTopUp))
	mux.Handle("GET /v1/billing/topups/{id}", h(auth.BillingView, s.getTopUp))
	mux.Handle("POST /v1/billing/topups/{id}/check", h(auth.BillingView, s.checkTopUp))

	mux.Handle("GET /v1/admin/meters", h(auth.PlatformAdmin, s.adminListMeters))
	mux.Handle("PUT /v1/admin/meters/{code}", h(auth.PlatformAdmin, s.adminUpdateMeter))
	mux.Handle("POST /v1/admin/organizations/{id}/adjustments", h(auth.PlatformAdmin, s.adminAdjust))

	// Provider callbacks carry no user token; each provider authenticates
	// its own callback in ParseCallback.
	mux.Handle("POST /v1/payments/{provider}/callback", httpx.Handle(s.providerCallback))
}

// ── Wallet and ledger ────────────────────────────────────────────────────────

func (s *Service) getWallet(w http.ResponseWriter, r *http.Request) error {
	p, _ := auth.FromContext(r.Context())
	var cents int64
	var meters []Meter
	err := s.db.InOrg(r.Context(), p.OrgID, func(tx pgx.Tx) error {
		var err error
		if cents, err = balance(r.Context(), tx, p.OrgID); err != nil {
			return err
		}
		meters, err = listMeters(r.Context(), tx, true)
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"balance_cents": cents,
		"currency":      "KES",
		"low_balance":   cents < s.opts.LowBalanceCents,
		"prices":        meters,
	})
	return nil
}

func (s *Service) getLedger(w http.ResponseWriter, r *http.Request) error {
	p, _ := auth.FromContext(r.Context())
	before, limit, err := pageParams(r)
	if err != nil {
		return err
	}
	var entries []LedgerEntry
	err = s.db.InOrg(r.Context(), p.OrgID, func(tx pgx.Tx) error {
		entries, err = listLedger(r.Context(), tx, p.OrgID, before, limit)
		return err
	})
	if err != nil {
		return err
	}
	var next *int64
	if len(entries) == limit {
		next = &entries[len(entries)-1].ID
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"entries": entries, "next_before": next})
	return nil
}

func pageParams(r *http.Request) (before int64, limit int, err error) {
	limit = 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if limit, err = strconv.Atoi(v); err != nil || limit < 1 || limit > 200 {
			return 0, 0, httpx.BadRequest("limit must be between 1 and 200.")
		}
	}
	if v := r.URL.Query().Get("before"); v != "" {
		if before, err = strconv.ParseInt(v, 10, 64); err != nil || before < 1 {
			return 0, 0, httpx.BadRequest("before must be a ledger entry id.")
		}
	}
	return before, limit, nil
}

// ── Top-ups ──────────────────────────────────────────────────────────────────

type createTopUpRequest struct {
	Provider    string `json:"provider"`
	AmountCents int64  `json:"amount_cents"`
	Phone       string `json:"phone"`
}

func (s *Service) createTopUp(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	p, _ := auth.FromContext(ctx)
	var req createTopUpRequest
	if err := httpx.Decode(r, &req); err != nil {
		return err
	}
	prov, ok := s.providers.Get(req.Provider)
	if !ok {
		e := httpx.BadRequest("This payment method is not available.")
		e.Details = map[string]any{"available": s.providers.Names()}
		return e
	}
	if req.AmountCents < s.opts.MinTopUpCents {
		return httpx.BadRequest(fmt.Sprintf("The minimum top-up is KES %d.", s.opts.MinTopUpCents/100))
	}
	phone, err := prov.NormalizePhone(req.Phone)
	var rejected *payments.RejectedError
	if errors.As(err, &rejected) {
		return httpx.NewError(http.StatusBadRequest, "invalid_phone", rejected.Reason)
	} else if err != nil {
		return err
	}

	var t TopUp
	err = s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		if err := ensureWallet(ctx, tx, p.OrgID); err != nil {
			return err
		}
		t, err = scanTopUp(tx.QueryRow(ctx, `
			INSERT INTO topups (org_id, reference_code, provider, amount_cents, phone_masked, created_by)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING `+topUpColumns,
			p.OrgID, newReferenceCode(), prov.Name(), req.AmountCents, maskPhone(phone), p.UserID))
		return err
	})
	if err != nil {
		return err
	}

	// The provider call happens outside any transaction: it can take
	// seconds, and the top-up row must exist even if this process dies
	// before the provider answers.
	init, initErr := prov.Initiate(ctx, payments.Request{
		Reference: t.ReferenceCode, AmountCents: t.AmountCents, Phone: phone, Description: "CargoTrack wallet top-up",
	})

	err = s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		var err error
		switch {
		case initErr == nil:
			_, err = tx.Exec(ctx, `UPDATE topups SET provider_ref = $2, updated_at = now() WHERE id = $1`,
				t.ID, init.ProviderRef)
		case errors.As(initErr, &rejected):
			_, err = tx.Exec(ctx, `UPDATE topups SET status = 'failed', failure_reason = $2, updated_at = now() WHERE id = $1`,
				t.ID, rejected.Reason)
		default:
			// The prompt may or may not have reached the phone, and without
			// a provider reference the payment cannot be checked. If money
			// arrives it carries our reference code and is credited by hand.
			_, err = tx.Exec(ctx, `UPDATE topups SET status = 'failed', failure_reason = $2, updated_at = now() WHERE id = $1`,
				t.ID, "Could not reach the payment provider. If you were charged, contact support with code "+t.ReferenceCode+".")
		}
		if err != nil {
			return err
		}
		t, err = scanTopUp(tx.QueryRow(ctx, `SELECT `+topUpColumns+` FROM topups WHERE id = $1`, t.ID))
		return err
	})
	if err != nil {
		return err
	}

	switch {
	case initErr == nil:
		httpx.WriteJSON(w, http.StatusCreated, map[string]any{"topup": t, "customer_message": init.CustomerMessage})
		return nil
	case errors.As(initErr, &rejected):
		e := httpx.NewError(http.StatusUnprocessableEntity, "payment_rejected", rejected.Reason)
		e.Details = map[string]any{"topup": t}
		return e
	default:
		slog.ErrorContext(ctx, "top-up initiation failed", "topup", t.ReferenceCode, "provider", t.Provider, "err", initErr)
		e := httpx.NewError(http.StatusBadGateway, "provider_unavailable", t.FailureReason)
		e.Details = map[string]any{"topup": t}
		return e
	}
}

func (s *Service) listTopUps(w http.ResponseWriter, r *http.Request) error {
	p, _ := auth.FromContext(r.Context())
	var list []TopUp
	err := s.db.InOrg(r.Context(), p.OrgID, func(tx pgx.Tx) error {
		rows, err := tx.Query(r.Context(),
			`SELECT `+topUpColumns+` FROM topups WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`, p.OrgID)
		if err != nil {
			return err
		}
		list, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (TopUp, error) { return scanTopUp(row) })
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"topups": list})
	return nil
}

// loadTopUp fetches a top-up the caller's organisation owns. Row-level
// security makes another organisation's top-up indistinguishable from a
// missing one.
func (s *Service) loadTopUp(ctx context.Context, p auth.Principal, id string) (TopUp, error) {
	var t TopUp
	if !httpx.IsUUID(id) {
		return t, httpx.ErrNotFound
	}
	err := s.db.InOrg(ctx, p.OrgID, func(tx pgx.Tx) error {
		var err error
		t, err = scanTopUp(tx.QueryRow(ctx, `SELECT `+topUpColumns+` FROM topups WHERE id = $1`, id))
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return t, httpx.ErrNotFound
	}
	return t, err
}

func (s *Service) getTopUp(w http.ResponseWriter, r *http.Request) error {
	p, _ := auth.FromContext(r.Context())
	t, err := s.loadTopUp(r.Context(), p, r.PathValue("id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, t)
	return nil
}

func (s *Service) checkTopUp(w http.ResponseWriter, r *http.Request) error {
	p, _ := auth.FromContext(r.Context())
	t, err := s.loadTopUp(r.Context(), p, r.PathValue("id"))
	if err != nil {
		return err
	}
	if t, err = s.check(r.Context(), t, false); err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, t)
	return nil
}

// check asks the provider about a top-up and applies the answer.
// Unforced checks skip settled top-ups and respect CheckInterval; a forced
// check (from an authenticated provider callback) always asks, so a
// payment cannot be lost to an earlier "failed" answer.
func (s *Service) check(ctx context.Context, t TopUp, force bool) (TopUp, error) {
	if t.Status == "succeeded" || t.providerRef == "" {
		return t, nil
	}
	if !force {
		if t.Status != "pending" {
			return t, nil
		}
		if t.lastCheckedAt != nil && time.Since(*t.lastCheckedAt) < s.opts.CheckInterval {
			return t, nil
		}
	}
	prov, ok := s.providers.Get(t.Provider)
	if !ok {
		slog.WarnContext(ctx, "top-up provider no longer configured", "topup", t.ReferenceCode, "provider", t.Provider)
		return t, nil
	}
	result, err := prov.Check(ctx, t.providerRef)
	if err != nil {
		// Transient: the top-up stays as it is and is checked again later.
		slog.WarnContext(ctx, "top-up status check failed", "topup", t.ReferenceCode, "err", err)
		return t, nil
	}
	err = s.db.InOrg(ctx, t.orgID, func(tx pgx.Tx) error {
		t, err = applyCheck(ctx, tx, t.ID, result)
		return err
	})
	return t, err
}

func (s *Service) providerCallback(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	prov, ok := s.providers.Get(r.PathValue("provider"))
	if !ok {
		return httpx.ErrNotFound
	}
	cb, err := prov.ParseCallback(r)
	if errors.Is(err, payments.ErrUnauthenticatedCallback) {
		slog.WarnContext(ctx, "rejected unauthenticated payment callback", "provider", prov.Name(), "remote", r.RemoteAddr)
		return httpx.ErrUnauthorized
	}
	if err != nil {
		return httpx.BadRequest(err.Error())
	}

	var t TopUp
	err = s.db.AsSystem(ctx, func(tx pgx.Tx) error {
		var err error
		t, err = scanTopUp(tx.QueryRow(ctx,
			`SELECT `+topUpColumns+` FROM topups WHERE provider = $1 AND provider_ref = $2`, prov.Name(), cb.ProviderRef))
		return err
	})
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		slog.WarnContext(ctx, "payment callback for unknown reference", "provider", prov.Name(), "ref", cb.ProviderRef)
	case err != nil:
		return err
	default:
		if _, err := s.check(ctx, t, true); err != nil {
			return err
		}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ResultCode": 0, "ResultDesc": "Accepted"})
	return nil
}

// ── Reconciler ───────────────────────────────────────────────────────────────

// Reconcile re-checks pending top-ups whose callback never arrived. Without
// it, a lost callback leaves a customer who paid with no credit.
func (s *Service) Reconcile(ctx context.Context, every time.Duration) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.reconcileOnce(ctx); err != nil && ctx.Err() == nil {
				slog.ErrorContext(ctx, "top-up reconciliation failed", "err", err)
			}
		}
	}
}

func (s *Service) reconcileOnce(ctx context.Context) error {
	var pending []TopUp
	err := s.db.AsSystem(ctx, func(tx pgx.Tx) error {
		// After a day without an answer the provider will not give one.
		if _, err := tx.Exec(ctx, `
			UPDATE topups SET status = 'failed', updated_at = now(),
			    failure_reason = 'No confirmation from the payment provider within 24 hours.'
			WHERE status = 'pending' AND created_at < now() - interval '24 hours'`); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `
			SELECT `+topUpColumns+` FROM topups
			WHERE status = 'pending' AND provider_ref <> ''
			  AND created_at < now() - interval '30 seconds'
			ORDER BY created_at LIMIT 100`)
		if err != nil {
			return err
		}
		pending, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (TopUp, error) { return scanTopUp(row) })
		return err
	})
	if err != nil {
		return err
	}
	for _, t := range pending {
		if _, err := s.check(ctx, t, false); err != nil {
			slog.ErrorContext(ctx, "reconcile top-up", "topup", t.ReferenceCode, "err", err)
		}
	}
	return nil
}

// ── Platform administration ──────────────────────────────────────────────────

func (s *Service) adminListMeters(w http.ResponseWriter, r *http.Request) error {
	var meters []Meter
	err := s.db.AsSystem(r.Context(), func(tx pgx.Tx) error {
		var err error
		meters, err = listMeters(r.Context(), tx, false)
		return err
	})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"meters": meters})
	return nil
}

type updateMeterRequest struct {
	UnitPriceCents *int64 `json:"unit_price_cents"`
	Active         *bool  `json:"active"`
}

func (s *Service) adminUpdateMeter(w http.ResponseWriter, r *http.Request) error {
	var req updateMeterRequest
	if err := httpx.Decode(r, &req); err != nil {
		return err
	}
	if req.UnitPriceCents != nil && *req.UnitPriceCents < 0 {
		return httpx.BadRequest("unit_price_cents cannot be negative.")
	}
	var m Meter
	err := s.db.AsSystem(r.Context(), func(tx pgx.Tx) error {
		err := tx.QueryRow(r.Context(), `
			UPDATE meters SET unit_price_cents = coalesce($2, unit_price_cents),
			                  active = coalesce($3, active), updated_at = now()
			WHERE code = $1
			RETURNING code, name, description, unit_price_cents, active, updated_at`,
			r.PathValue("code"), req.UnitPriceCents, req.Active,
		).Scan(&m.Code, &m.Name, &m.Description, &m.UnitPriceCents, &m.Active, &m.UpdatedAt)
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return httpx.ErrNotFound
	}
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, m)
	return nil
}

type adjustRequest struct {
	AmountCents int64  `json:"amount_cents"`
	Note        string `json:"note"`
	// Reference, e.g. the bank transfer reference, makes the adjustment
	// safe to retry: a second request with it is refused.
	Reference string `json:"reference"`
}

func (s *Service) adminAdjust(w http.ResponseWriter, r *http.Request) error {
	p, _ := auth.FromContext(r.Context())
	var req adjustRequest
	if err := httpx.Decode(r, &req); err != nil {
		return err
	}
	if req.AmountCents == 0 || req.Note == "" {
		return httpx.BadRequest("amount_cents (non-zero) and note are required.")
	}
	orgID := r.PathValue("id")
	if !httpx.IsUUID(orgID) {
		return httpx.ErrNotFound
	}
	ref := ""
	if req.Reference != "" {
		ref = "adjust:" + req.Reference
	}
	var e *LedgerEntry
	err := s.db.AsSystem(r.Context(), func(tx pgx.Tx) error {
		var exists bool
		if err := tx.QueryRow(r.Context(),
			`SELECT EXISTS (SELECT 1 FROM organizations WHERE id = $1)`, orgID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return httpx.ErrNotFound
		}
		var err error
		e, err = credit(r.Context(), tx, orgID, req.AmountCents, "adjustment", ref, req.Note, p.UserID)
		return err
	})
	switch {
	case errors.Is(err, ErrDuplicateReference):
		return httpx.NewError(http.StatusConflict, "duplicate_reference", "An adjustment with this reference was already applied.")
	case errors.Is(err, ErrBelowZero):
		return httpx.NewError(http.StatusUnprocessableEntity, "below_zero", "This debit would take the balance below zero.")
	case err != nil:
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, e)
	return nil
}
