// Package orgs mirrors Zitadel organisations and users into local rows the
// rest of the schema can reference, and serves GET /v1/me.
package orgs

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cargotrack/core/internal/platform/auth"
	"github.com/cargotrack/core/internal/platform/database"
	"github.com/cargotrack/core/internal/platform/httpx"
)

// cacheTTL bounds how long a renamed organisation keeps its old name here,
// and how often last_seen_at is written: once per user per TTL, not once
// per request.
const cacheTTL = 5 * time.Minute

type Service struct {
	db *database.DB

	mu    sync.Mutex
	cache map[string]cached // by IdP user ID
}

type cached struct {
	userID, orgID string
	expires       time.Time
}

func NewService(db *database.DB) *Service {
	return &Service{db: db, cache: map[string]cached{}}
}

// Resolve implements auth.Resolver.
func (s *Service) Resolve(ctx context.Context, id auth.Identity) (auth.Principal, error) {
	s.mu.Lock()
	c, ok := s.cache[id.IdPUserID]
	s.mu.Unlock()
	if ok && time.Now().Before(c.expires) {
		return principal(c.userID, c.orgID, id), nil
	}

	var userID, orgID string
	err := s.db.AsSystem(ctx, func(tx pgx.Tx) error {
		name := id.OrgName
		if name == "" {
			name = id.IdPOrgID
		}
		if err := tx.QueryRow(ctx, `
			INSERT INTO organizations (idp_org_id, name) VALUES ($1, $2)
			ON CONFLICT (idp_org_id) DO UPDATE SET name = EXCLUDED.name
			RETURNING id`, id.IdPOrgID, name,
		).Scan(&orgID); err != nil {
			return fmt.Errorf("upsert organization: %w", err)
		}
		// A Zitadel user belongs to one organisation for life, so org_id is
		// set on insert and never moved by a later token.
		if err := tx.QueryRow(ctx, `
			INSERT INTO users (idp_user_id, org_id, email, display_name) VALUES ($1, $2, $3, $4)
			ON CONFLICT (idp_user_id) DO UPDATE
			    SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, last_seen_at = now()
			RETURNING id, org_id`, id.IdPUserID, orgID, id.Email, id.Name,
		).Scan(&userID, &orgID); err != nil {
			return fmt.Errorf("upsert user: %w", err)
		}
		return nil
	})
	if err != nil {
		return auth.Principal{}, err
	}

	s.mu.Lock()
	s.cache[id.IdPUserID] = cached{userID: userID, orgID: orgID, expires: time.Now().Add(cacheTTL)}
	s.mu.Unlock()
	return principal(userID, orgID, id), nil
}

func principal(userID, orgID string, id auth.Identity) auth.Principal {
	return auth.Principal{
		UserID: userID, OrgID: orgID, Roles: id.Roles,
		Email: id.Email, EmailVerified: id.EmailVerified,
	}
}

// Organization is the public view of the caller's organisation.
type Organization struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Country string `json:"country"`
}

func (s *Service) Routes(mux *http.ServeMux, authn func(http.Handler) http.Handler) {
	mux.Handle("GET /v1/me", authn(httpx.Handle(s.me)))
}

func (s *Service) me(w http.ResponseWriter, r *http.Request) error {
	p, _ := auth.FromContext(r.Context())
	var org Organization
	err := s.db.InOrg(r.Context(), p.OrgID, func(tx pgx.Tx) error {
		return tx.QueryRow(r.Context(),
			`SELECT id, name, country FROM organizations WHERE id = $1`, p.OrgID,
		).Scan(&org.ID, &org.Name, &org.Country)
	})
	if err != nil {
		return err
	}
	roles := p.Roles
	if roles == nil {
		roles = []string{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"user_id":      p.UserID,
		"organization": org,
		"roles":        roles,
	})
	return nil
}
