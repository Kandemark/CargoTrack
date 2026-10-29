package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// The Zitadel application must be set to issue JWT access tokens, and the
// project to "assert roles on authentication", or the organisation and
// role claims below are missing and every request is rejected.
const claimOrgID = "urn:zitadel:iam:user:resourceowner:id"

// DefaultKeyRefreshInterval stops a flood of tokens with unknown key IDs
// from turning into a flood of requests to the identity provider.
const DefaultKeyRefreshInterval = 30 * time.Second

// OIDCVerifier verifies RS256 access tokens against the issuer's published
// signing keys (JWKS), refreshing them when an unknown key ID appears so
// Zitadel's key rotation needs no restart.
type OIDCVerifier struct {
	issuer       string
	audience     string
	client       *http.Client
	refreshEvery time.Duration

	mu          sync.Mutex
	keys        map[string]*rsa.PublicKey
	lastRefresh time.Time
}

func NewOIDCVerifier(issuer, audience string) *OIDCVerifier {
	return &OIDCVerifier{
		issuer:       issuer,
		audience:     audience,
		client:       &http.Client{Timeout: 10 * time.Second},
		refreshEvery: DefaultKeyRefreshInterval,
		keys:         map[string]*rsa.PublicKey{},
	}
}

// WithKeyRefreshInterval sets the minimum gap between JWKS fetches.
func (v *OIDCVerifier) WithKeyRefreshInterval(d time.Duration) *OIDCVerifier {
	v.refreshEvery = d
	return v
}

type zitadelClaims struct {
	jwt.RegisteredClaims
	Email   string                       `json:"email"`
	Name    string                       `json:"name"`
	OrgID   string                       `json:"urn:zitadel:iam:user:resourceowner:id"`
	OrgName string                       `json:"urn:zitadel:iam:user:resourceowner:name"`
	Roles   map[string]map[string]string `json:"urn:zitadel:iam:org:project:roles"`
}

func (v *OIDCVerifier) Verify(ctx context.Context, raw string) (Identity, error) {
	var claims zitadelClaims
	_, err := jwt.ParseWithClaims(raw, &claims,
		func(t *jwt.Token) (any, error) {
			kid, _ := t.Header["kid"].(string)
			return v.key(ctx, kid)
		},
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience(v.audience),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil {
		return Identity{}, err
	}
	if claims.Subject == "" || claims.OrgID == "" {
		return Identity{}, fmt.Errorf("token lacks subject or %s", claimOrgID)
	}

	// A role counts only where it was granted in the caller's own
	// organisation; a grant in some other organisation means nothing here.
	var roles []string
	for role, grantedIn := range claims.Roles {
		if _, ok := grantedIn[claims.OrgID]; ok {
			roles = append(roles, role)
		}
	}
	return Identity{
		IdPUserID: claims.Subject,
		IdPOrgID:  claims.OrgID,
		OrgName:   claims.OrgName,
		Email:     claims.Email,
		Name:      claims.Name,
		Roles:     roles,
	}, nil
}

func (v *OIDCVerifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if k, ok := v.keys[kid]; ok {
		return k, nil
	}
	if !v.lastRefresh.IsZero() && time.Since(v.lastRefresh) < v.refreshEvery {
		return nil, fmt.Errorf("unknown signing key %q", kid)
	}
	v.lastRefresh = time.Now()
	keys, err := v.fetchKeys(ctx)
	if err != nil {
		return nil, err
	}
	v.keys = keys
	if k, ok := keys[kid]; ok {
		return k, nil
	}
	return nil, fmt.Errorf("unknown signing key %q", kid)
}

func (v *OIDCVerifier) fetchKeys(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	var discovery struct {
		JWKSURI string `json:"jwks_uri"`
	}
	if err := v.getJSON(ctx, v.issuer+"/.well-known/openid-configuration", &discovery); err != nil {
		return nil, fmt.Errorf("oidc discovery: %w", err)
	}
	var set struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Use string `json:"use"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := v.getJSON(ctx, discovery.JWKSURI, &set); err != nil {
		return nil, fmt.Errorf("fetch jwks: %w", err)
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range set.Keys {
		if k.Kty != "RSA" || (k.Use != "" && k.Use != "sig") {
			continue
		}
		n, errN := base64.RawURLEncoding.DecodeString(k.N)
		e, errE := base64.RawURLEncoding.DecodeString(k.E)
		if errN != nil || errE != nil || len(e) > 4 {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{
			N: new(big.Int).SetBytes(n),
			E: int(new(big.Int).SetBytes(e).Int64()),
		}
	}
	if len(keys) == 0 {
		return nil, errors.New("jwks has no usable RSA signing keys")
	}
	return keys, nil
}

func (v *OIDCVerifier) getJSON(ctx context.Context, url string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s: %s", url, resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
