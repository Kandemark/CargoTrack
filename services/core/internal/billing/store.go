package billing

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Every function here takes the caller's transaction, so a charge commits
// or rolls back together with the work it pays for.

type Meter struct {
	Code           string    `json:"code"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	UnitPriceCents int64     `json:"unit_price_cents"`
	Active         bool      `json:"active"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type LedgerEntry struct {
	ID                int64     `json:"id"`
	Kind              string    `json:"kind"`
	AmountCents       int64     `json:"amount_cents"`
	BalanceAfterCents int64     `json:"balance_after_cents"`
	MeterCode         *string   `json:"meter_code"`
	Quantity          int       `json:"quantity"`
	UnitPriceCents    *int64    `json:"unit_price_cents"`
	Description       string    `json:"description"`
	ActorUserID       *string   `json:"actor_user_id"`
	CreatedAt         time.Time `json:"created_at"`
}

// InsufficientCreditError is returned by charge when the wallet cannot
// cover the price. Nothing has been written when it is returned.
type InsufficientCreditError struct {
	Meter         string
	RequiredCents int64
	BalanceCents  int64
}

func (e *InsufficientCreditError) Error() string {
	return fmt.Sprintf("insufficient credit for %s: need %d cents, have %d", e.Meter, e.RequiredCents, e.BalanceCents)
}

// ErrDuplicateReference means a ledger entry with this idempotency
// reference already exists: the credit was applied before.
var ErrDuplicateReference = errors.New("billing: ledger reference already used")

// ErrBelowZero means a debit adjustment would take the balance negative.
var ErrBelowZero = errors.New("billing: balance cannot go below zero")

func ensureWallet(ctx context.Context, tx pgx.Tx, orgID string) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO wallets (org_id) VALUES ($1) ON CONFLICT (org_id) DO NOTHING`, orgID)
	return err
}

func getMeter(ctx context.Context, tx pgx.Tx, code string) (Meter, error) {
	var m Meter
	err := tx.QueryRow(ctx, `
		SELECT code, name, description, unit_price_cents, active, updated_at
		FROM meters WHERE code = $1`, code,
	).Scan(&m.Code, &m.Name, &m.Description, &m.UnitPriceCents, &m.Active, &m.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		// A missing meter is a programming error, never a free action.
		return m, fmt.Errorf("billing: unknown meter %q", code)
	}
	return m, err
}

func listMeters(ctx context.Context, tx pgx.Tx, activeOnly bool) ([]Meter, error) {
	rows, err := tx.Query(ctx, `
		SELECT code, name, description, unit_price_cents, active, updated_at
		FROM meters WHERE active OR NOT $1 ORDER BY code`, activeOnly)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Meter, error) {
		var m Meter
		err := row.Scan(&m.Code, &m.Name, &m.Description, &m.UnitPriceCents, &m.Active, &m.UpdatedAt)
		return m, err
	})
}

func balance(ctx context.Context, tx pgx.Tx, orgID string) (int64, error) {
	if err := ensureWallet(ctx, tx, orgID); err != nil {
		return 0, err
	}
	var cents int64
	err := tx.QueryRow(ctx, `SELECT balance_cents FROM wallets WHERE org_id = $1`, orgID).Scan(&cents)
	return cents, err
}

// charge deducts quantity units of meterCode. It returns (nil, nil) when
// the meter is inactive or priced at zero.
func charge(ctx context.Context, tx pgx.Tx, orgID, meterCode string, quantity int, actorUserID, description string) (*LedgerEntry, error) {
	if quantity <= 0 {
		return nil, fmt.Errorf("billing: quantity must be positive, got %d", quantity)
	}
	m, err := getMeter(ctx, tx, meterCode)
	if err != nil {
		return nil, err
	}
	cost := m.UnitPriceCents * int64(quantity)
	if !m.Active || cost == 0 {
		return nil, nil
	}
	if err := ensureWallet(ctx, tx, orgID); err != nil {
		return nil, err
	}

	// One conditional UPDATE both checks and spends the credit, so two
	// concurrent charges can never spend the same shilling.
	var after int64
	err = tx.QueryRow(ctx, `
		UPDATE wallets SET balance_cents = balance_cents - $2, updated_at = now()
		WHERE org_id = $1 AND balance_cents >= $2
		RETURNING balance_cents`, orgID, cost,
	).Scan(&after)
	if errors.Is(err, pgx.ErrNoRows) {
		have, berr := balance(ctx, tx, orgID)
		if berr != nil {
			return nil, berr
		}
		return nil, &InsufficientCreditError{Meter: meterCode, RequiredCents: cost, BalanceCents: have}
	}
	if err != nil {
		return nil, err
	}

	e := &LedgerEntry{
		Kind: "charge", AmountCents: -cost, BalanceAfterCents: after,
		MeterCode: &m.Code, Quantity: quantity, UnitPriceCents: &m.UnitPriceCents,
		Description: description,
	}
	if actorUserID != "" {
		e.ActorUserID = &actorUserID
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO ledger_entries
		    (org_id, kind, amount_cents, balance_after_cents, meter_code, quantity, unit_price_cents, description, actor_user_id)
		VALUES ($1, 'charge', $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`,
		orgID, e.AmountCents, after, m.Code, quantity, m.UnitPriceCents, description, e.ActorUserID,
	).Scan(&e.ID, &e.CreatedAt)
	return e, err
}

// credit adds (or, for a negative adjustment, removes) amountCents and
// writes the matching ledger entry. A non-empty reference makes the call
// idempotent: a second call with it returns ErrDuplicateReference.
func credit(ctx context.Context, tx pgx.Tx, orgID string, amountCents int64, kind, reference, description, actorUserID string) (*LedgerEntry, error) {
	if amountCents == 0 {
		return nil, errors.New("billing: amount must not be zero")
	}
	if err := ensureWallet(ctx, tx, orgID); err != nil {
		return nil, err
	}
	// The savepoint lets a constraint violation be reported as an error
	// without poisoning the caller's transaction.
	sp, err := tx.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = sp.Rollback(ctx) }()

	var after int64
	if err := sp.QueryRow(ctx, `
		UPDATE wallets SET balance_cents = balance_cents + $2, updated_at = now()
		WHERE org_id = $1 RETURNING balance_cents`, orgID, amountCents,
	).Scan(&after); err != nil {
		if isConstraint(err, "wallets_balance_cents_check") {
			return nil, ErrBelowZero
		}
		return nil, err
	}

	e := &LedgerEntry{Kind: kind, AmountCents: amountCents, BalanceAfterCents: after, Quantity: 1, Description: description}
	if actorUserID != "" {
		e.ActorUserID = &actorUserID
	}
	var ref *string
	if reference != "" {
		ref = &reference
	}
	if err := sp.QueryRow(ctx, `
		INSERT INTO ledger_entries (org_id, kind, amount_cents, balance_after_cents, reference, description, actor_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at`,
		orgID, kind, amountCents, after, ref, description, e.ActorUserID,
	).Scan(&e.ID, &e.CreatedAt); err != nil {
		if isConstraint(err, "ledger_entries_reference_key") {
			return nil, ErrDuplicateReference
		}
		return nil, err
	}
	return e, sp.Commit(ctx)
}

func listLedger(ctx context.Context, tx pgx.Tx, orgID string, beforeID int64, limit int) ([]LedgerEntry, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, kind, amount_cents, balance_after_cents, meter_code, quantity,
		       unit_price_cents, description, actor_user_id, created_at
		FROM ledger_entries
		WHERE org_id = $1 AND ($2 = 0 OR id < $2)
		ORDER BY id DESC LIMIT $3`, orgID, beforeID, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (LedgerEntry, error) {
		var e LedgerEntry
		err := row.Scan(&e.ID, &e.Kind, &e.AmountCents, &e.BalanceAfterCents, &e.MeterCode, &e.Quantity,
			&e.UnitPriceCents, &e.Description, &e.ActorUserID, &e.CreatedAt)
		return e, err
	})
}

func isConstraint(err error, name string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.ConstraintName == name
}
