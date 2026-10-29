// Package testkit gives tests a real Postgres database and a real OIDC
// issuer, so they exercise row-level security and token verification
// exactly as production does.
//
// Tests that need Postgres are skipped unless CORE_TEST_DATABASE_URL is
// set. The role in that URL must not be a superuser: superusers bypass
// row-level security and the isolation tests would prove nothing.
package testkit

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"

	"github.com/cargotrack/core/internal/platform/database"
	"github.com/cargotrack/core/migrations"
)

const Audience = "cargotrack-test-project"

// DB returns a migrated database in a schema of its own, dropped when the
// test ends, so tests and packages never see each other's rows.
func DB(t testing.TB) *database.DB {
	t.Helper()
	base := os.Getenv("CORE_TEST_DATABASE_URL")
	if base == "" {
		t.Skip("CORE_TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	schema := fmt.Sprintf("t_%d_%s", time.Now().UnixNano(), randHex(4))

	admin, err := pgx.Connect(ctx, base)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	var super bool
	if err := admin.QueryRow(ctx, `SELECT rolsuper FROM pg_roles WHERE rolname = current_user`).Scan(&super); err != nil {
		t.Fatal(err)
	}
	if super {
		t.Fatal("CORE_TEST_DATABASE_URL uses a superuser, which bypasses row-level security; use an ordinary role")
	}
	if _, err := admin.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(context.Background(), `DROP SCHEMA `+schema+` CASCADE`)
		_ = admin.Close(context.Background())
	})

	u, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()

	db, err := database.Open(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := db.Migrate(ctx, migrations.FS); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

// Issuer is a fake Zitadel: it serves OIDC discovery and a JWKS, and signs
// access tokens with the same claims Zitadel puts in them.
type Issuer struct {
	URL    string
	server *httptest.Server

	mu   sync.Mutex
	kid  string
	key  *rsa.PrivateKey
	jwks []map[string]string
}

func NewIssuer(t testing.TB) *Issuer {
	t.Helper()
	iss := &Issuer{}
	iss.Rotate(t)
	mux := http.NewServeMux()
	iss.server = httptest.NewServer(mux)
	iss.URL = iss.server.URL
	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"issuer": iss.URL, "jwks_uri": iss.URL + "/keys"})
	})
	mux.HandleFunc("/keys", func(w http.ResponseWriter, r *http.Request) {
		iss.mu.Lock()
		defer iss.mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": iss.jwks})
	})
	t.Cleanup(iss.server.Close)
	return iss
}

// Rotate adds a new signing key and signs with it from now on, like a
// Zitadel key rotation. Old keys stay published.
func (iss *Issuer) Rotate(t testing.TB) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	iss.mu.Lock()
	defer iss.mu.Unlock()
	iss.key = key
	iss.kid = randHex(8)
	iss.jwks = append(iss.jwks, map[string]string{
		"kty": "RSA", "use": "sig", "alg": "RS256", "kid": iss.kid,
		"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
		"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
	})
}

// User describes the caller a token is minted for.
type User struct {
	ID, OrgID, OrgName, Email string
	Roles                     []string
}

// Token returns a signed access token for u. extra overrides or adds claims.
func (iss *Issuer) Token(t testing.TB, u User, extra jwt.MapClaims) string {
	t.Helper()
	roles := map[string]map[string]string{}
	for _, r := range u.Roles {
		roles[r] = map[string]string{u.OrgID: "test.example"}
	}
	claims := jwt.MapClaims{
		"iss":                                   iss.URL,
		"aud":                                   []string{Audience},
		"sub":                                   u.ID,
		"exp":                                   time.Now().Add(time.Hour).Unix(),
		"iat":                                   time.Now().Unix(),
		"email":                                 u.Email,
		"urn:zitadel:iam:user:resourceowner:id": u.OrgID,
		"urn:zitadel:iam:user:resourceowner:name": u.OrgName,
		"urn:zitadel:iam:org:project:roles":       roles,
	}
	for k, v := range extra {
		if v == nil {
			delete(claims, k)
		} else {
			claims[k] = v
		}
	}
	iss.mu.Lock()
	defer iss.mu.Unlock()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = iss.kid
	s, err := tok.SignedString(iss.key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

// NewUser returns a user in a fresh organisation with the given roles.
func NewUser(roles ...string) User {
	org := "org-" + randHex(6)
	return User{
		ID: "user-" + randHex(6), OrgID: org, OrgName: "Org " + strings.ToUpper(org[4:]),
		Email: "someone@example.com", Roles: roles,
	}
}

// Colleague returns another user in the same organisation as u.
func Colleague(u User, roles ...string) User {
	c := u
	c.ID = "user-" + randHex(6)
	c.Roles = roles
	return c
}

func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x", b)
}
