package billing

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cargotrack/core/internal/payments"
)

type TopUp struct {
	ID            string     `json:"id"`
	ReferenceCode string     `json:"reference_code"`
	Provider      string     `json:"provider"`
	AmountCents   int64      `json:"amount_cents"`
	PhoneMasked   string     `json:"phone_masked"`
	Status        string     `json:"status"`
	FailureReason string     `json:"failure_reason,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	CreditedAt    *time.Time `json:"credited_at"`
	orgID         string
	providerRef   string
	lastCheckedAt *time.Time
}

const topUpColumns = `id, org_id, reference_code, provider, provider_ref, amount_cents, phone_masked,
	status, failure_reason, created_at, credited_at, last_checked_at`

func scanTopUp(row pgx.Row) (TopUp, error) {
	var t TopUp
	err := row.Scan(&t.ID, &t.orgID, &t.ReferenceCode, &t.Provider, &t.providerRef, &t.AmountCents,
		&t.PhoneMasked, &t.Status, &t.FailureReason, &t.CreatedAt, &t.CreditedAt, &t.lastCheckedAt)
	return t, err
}

// newReferenceCode returns e.g. TU7F3A91C2D0: 12 characters, the most an
// M-Pesa account reference allows, and what the customer sees on the receipt.
func newReferenceCode() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return "TU" + strings.ToUpper(hex.EncodeToString(b))
}

// maskPhone keeps enough of a number to recognise it on a receipt.
func maskPhone(phone string) string {
	if len(phone) < 7 {
		return ""
	}
	return phone[:4] + strings.Repeat("*", len(phone)-7) + phone[len(phone)-3:]
}

// applyCheck records what the provider said about a top-up and, if it was
// paid, credits the wallet. It locks the top-up row, so concurrent
// callbacks, polls, and the reconciler cannot credit the same payment twice;
// the unique ledger reference is a second guard.
func applyCheck(ctx context.Context, tx pgx.Tx, topUpID string, check payments.Check) (TopUp, error) {
	t, err := scanTopUp(tx.QueryRow(ctx,
		`SELECT `+topUpColumns+` FROM topups WHERE id = $1 FOR UPDATE`, topUpID))
	if err != nil {
		return t, err
	}
	if t.Status == "succeeded" {
		return t, nil
	}

	switch check.Status {
	case payments.StatusPaid:
		_, err := credit(ctx, tx, t.orgID, t.AmountCents, "topup", "topup:"+t.ID,
			fmt.Sprintf("%s top-up %s", t.Provider, t.ReferenceCode), "")
		if err != nil && !errors.Is(err, ErrDuplicateReference) {
			return t, err
		}
		_, err = tx.Exec(ctx, `
			UPDATE topups SET status = 'succeeded', failure_reason = '', credited_at = now(),
			    last_checked_at = now(), updated_at = now()
			WHERE id = $1`, t.ID)
		if err != nil {
			return t, err
		}
		slog.InfoContext(ctx, "top-up credited", "topup", t.ReferenceCode, "org", t.orgID, "amount_cents", t.AmountCents)
	case payments.StatusFailed:
		_, err = tx.Exec(ctx, `
			UPDATE topups SET status = 'failed', failure_reason = $2, last_checked_at = now(), updated_at = now()
			WHERE id = $1`, t.ID, check.Reason)
	default:
		_, err = tx.Exec(ctx, `UPDATE topups SET last_checked_at = now() WHERE id = $1`, t.ID)
	}
	if err != nil {
		return t, err
	}
	return scanTopUp(tx.QueryRow(ctx, `SELECT `+topUpColumns+` FROM topups WHERE id = $1`, t.ID))
}
