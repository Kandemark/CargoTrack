// Package payments defines what CargoTrack needs from a payment provider
// (M-Pesa, Airtel Money, MTN MoMo, Flutterwave, Pesapal) and nothing more:
// start a payment, ask whether it was paid, and read the provider's
// callback. Providers never touch wallets; billing does that.
package payments

import (
	"context"
	"errors"
	"net/http"
	"sort"
)

type Status int

const (
	StatusPending Status = iota
	StatusPaid
	StatusFailed
)

func (s Status) String() string {
	switch s {
	case StatusPaid:
		return "paid"
	case StatusFailed:
		return "failed"
	default:
		return "pending"
	}
}

type Request struct {
	Reference   string // our top-up reference code, shown on the customer's receipt
	AmountCents int64
	Phone       string // already normalised by the provider's NormalizePhone
	Description string
}

type Initiation struct {
	ProviderRef     string // the provider's ID for this payment, used for checks and callbacks
	CustomerMessage string // e.g. "Enter your M-Pesa PIN on your phone"
}

type Check struct {
	Status Status
	Reason string // provider's explanation when failed
}

// Callback is what a provider's callback claims. Billing never acts on the
// claim itself: it uses ProviderRef to ask the provider via Check.
type Callback struct {
	ProviderRef string
}

type Provider interface {
	Name() string

	// NormalizePhone validates a payer phone number and returns it in the
	// provider's format, so typos are rejected before a top-up exists.
	NormalizePhone(phone string) (string, error)

	// Initiate starts a payment. A *RejectedError means the provider refused
	// it (bad number, amount out of range); other errors are transport
	// failures and the payment may or may not have started.
	Initiate(ctx context.Context, req Request) (Initiation, error)

	// Check asks the provider, over an authenticated server-to-server
	// call, what happened to a payment. This is the only source of truth
	// for releasing credit.
	Check(ctx context.Context, providerRef string) (Check, error)

	// ParseCallback authenticates and decodes a provider callback.
	// ErrUnauthenticatedCallback means the request should be dropped.
	ParseCallback(r *http.Request) (Callback, error)
}

var ErrUnauthenticatedCallback = errors.New("payments: callback failed authentication")

// RejectedError is a provider's refusal, safe to show to the customer.
type RejectedError struct{ Reason string }

func (e *RejectedError) Error() string { return "payment rejected: " + e.Reason }

// Registry holds the providers configured for this deployment.
type Registry struct{ providers map[string]Provider }

func NewRegistry(providers ...Provider) *Registry {
	r := &Registry{providers: map[string]Provider{}}
	for _, p := range providers {
		r.providers[p.Name()] = p
	}
	return r
}

func (r *Registry) Get(name string) (Provider, bool) {
	p, ok := r.providers[name]
	return p, ok
}

func (r *Registry) Names() []string {
	names := make([]string, 0, len(r.providers))
	for n := range r.providers {
		names = append(names, n)
	}
	sort.Strings(names)
	return names
}
