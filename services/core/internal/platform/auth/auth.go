// Package auth turns a bearer token into a Principal: who is calling, which
// organisation they act for, and what they may do.
//
// Identity is Zitadel's job (login, passwords, MFA, organisations). This
// package only verifies Zitadel's tokens and maps them onto CargoTrack's
// own organisation and user rows.
package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/cargotrack/core/internal/platform/httpx"
)

// Identity is what a verified token says about the caller.
type Identity struct {
	IdPUserID string
	IdPOrgID  string
	OrgName   string
	Email     string
	// EmailVerified is Zitadel's email_verified claim. Only a verified
	// email may be used to link a login to an existing record.
	EmailVerified bool
	Name          string
	Roles         []string
}

// Principal is the caller as the rest of the service sees them.
type Principal struct {
	UserID        string // users.id
	OrgID         string // organizations.id
	Roles         []string
	Email         string
	EmailVerified bool
}

// Verifier checks a raw bearer token and returns the identity it carries.
type Verifier interface {
	Verify(ctx context.Context, token string) (Identity, error)
}

// Resolver maps a verified identity to local rows, creating them on first
// sight. Implemented by the orgs module.
type Resolver interface {
	Resolve(ctx context.Context, id Identity) (Principal, error)
}

// Permission is something a role allows.
type Permission string

const (
	BillingView   Permission = "billing.view"   // see wallet, ledger, top-ups
	BillingManage Permission = "billing.manage" // start top-ups
	PlatformAdmin Permission = "platform.admin" // set prices, adjust any wallet

	ShipmentsView         Permission = "shipments.view"          // every shipment of the organisation
	ShipmentsViewAssigned Permission = "shipments.view_assigned" // only shipments assigned to the caller as driver
	ShipmentsManage       Permission = "shipments.manage"        // book (paid), edit, cancel, assign
	ShipmentsTrack        Permission = "shipments.track"         // move a shipment along, record checkpoints, delays, notes

	FleetView   Permission = "fleet.view"   // vehicles and drivers
	FleetManage Permission = "fleet.manage" // add and edit vehicles and drivers
)

// Role keys as configured on the Zitadel project.
const (
	RolePlatformOwner = "platform_owner"
	RoleOrgAdmin      = "org_admin"
	RoleFinance       = "finance"
	RoleOperations    = "operations"
	RoleDriver        = "driver"
)

// Booking a shipment costs money, so drivers can move shipments along but
// not book or cancel them, and they only see shipments assigned to them:
// a lost driver's phone must not expose the company's whole book.
var rolePermissions = map[string][]Permission{
	RolePlatformOwner: {BillingView, BillingManage, PlatformAdmin, ShipmentsView, ShipmentsManage, ShipmentsTrack, FleetView, FleetManage},
	RoleOrgAdmin:      {BillingView, BillingManage, ShipmentsView, ShipmentsManage, ShipmentsTrack, FleetView, FleetManage},
	RoleFinance:       {BillingView, BillingManage, ShipmentsView, FleetView},
	RoleOperations:    {BillingView, ShipmentsView, ShipmentsManage, ShipmentsTrack, FleetView, FleetManage},
	RoleDriver:        {ShipmentsViewAssigned, ShipmentsTrack},
}

func (p Principal) Can(perm Permission) bool {
	for _, role := range p.Roles {
		for _, granted := range rolePermissions[role] {
			if granted == perm {
				return true
			}
		}
	}
	return false
}

// IsPlatformOwner reports whether the caller runs the platform itself.
// Platform owners are never billed.
func (p Principal) IsPlatformOwner() bool {
	for _, role := range p.Roles {
		if role == RolePlatformOwner {
			return true
		}
	}
	return false
}

type ctxKey struct{}

func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, ctxKey{}, p)
}

// FromContext returns the caller. Handlers behind Middleware can rely on ok.
func FromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(ctxKey{}).(Principal)
	return p, ok
}

// Middleware rejects requests without a valid token and attaches the
// Principal to the request context.
func Middleware(v Verifier, res Resolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
			if !ok || raw == "" {
				httpx.WriteError(w, r, httpx.ErrUnauthorized)
				return
			}
			id, err := v.Verify(r.Context(), raw)
			if err != nil {
				httpx.WriteError(w, r, httpx.ErrUnauthorized)
				return
			}
			p, err := res.Resolve(r.Context(), id)
			if err != nil {
				httpx.WriteError(w, r, err)
				return
			}
			next.ServeHTTP(w, r.WithContext(WithPrincipal(r.Context(), p)))
		})
	}
}

// Require wraps a handler so it only runs for callers holding perm.
func Require(perm Permission, h httpx.HandlerFunc) httpx.HandlerFunc {
	return RequireAny(h, perm)
}

// RequireAny runs h for callers holding at least one of perms.
func RequireAny(h httpx.HandlerFunc, perms ...Permission) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		p, ok := FromContext(r.Context())
		if !ok {
			return httpx.ErrUnauthorized
		}
		for _, perm := range perms {
			if p.Can(perm) {
				return h(w, r)
			}
		}
		return httpx.ErrForbidden
	}
}
