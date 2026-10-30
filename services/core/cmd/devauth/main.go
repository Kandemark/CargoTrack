// Command devauth is a stand-in for Zitadel on a development machine. It is
// never built into the core image and must never be deployed.
//
// It speaks enough OpenID Connect for the app's real sign-in code to run
// unchanged (discovery, JWKS, authorization code with PKCE, refresh) and
// issues tokens with the same claims Zitadel puts in them, so the core's
// real token verification runs too. Instead of a password, the sign-in
// page lists demo users to choose from.
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type user struct {
	ID, Name, Email, OrgID, OrgName string
	Roles                           []string
	Description                     string
}

// Fixed IDs, so data created as a demo user is still theirs after a restart.
var users = []user{
	{"demo-amina", "Amina Wanjiru", "amina@mombasafreight.example", "demo-org-mombasa", "Mombasa Freight Ltd",
		[]string{"org_admin"}, "Shipper. Books shipments, manages the wallet and fleet, lists loads."},
	{"demo-brian", "Brian Otieno", "brian@mombasafreight.example", "demo-org-mombasa", "Mombasa Freight Ltd",
		[]string{"driver"}, "Driver at Mombasa Freight. Sees only the jobs assigned to him."},
	{"demo-carol", "Carol Nakato", "carol@kampalahaulage.example", "demo-org-kampala", "Kampala Haulage",
		[]string{"org_admin"}, "Carrier. Bids on loads and runs won shipments with its own trucks."},
	{"demo-owner", "Platform owner", "owner@cargotrack.example", "demo-org-cargotrack", "CargoTrack",
		[]string{"platform_owner"}, "You. Sets prices and credits wallets. Never billed."},
}

type grant struct {
	user        user
	redirectURI string
	challenge   string
	expires     time.Time
}

type server struct {
	issuer   string
	audience string
	key      *rsa.PrivateKey
	kid      string

	mu      sync.Mutex
	codes   map[string]grant
	refresh map[string]user
}

func main() {
	addr := flag.String("addr", ":9000", "listen address")
	issuer := flag.String("issuer", "http://localhost:9000", "issuer URL as the app and core reach it")
	audience := flag.String("audience", "cargotrack-dev", "project ID put in the token audience (OIDC_AUDIENCE)")
	flag.Parse()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal(err)
	}
	s := &server{
		issuer: strings.TrimSuffix(*issuer, "/"), audience: *audience, key: key, kid: randomString(8),
		codes: map[string]grant{}, refresh: map[string]user{},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /.well-known/openid-configuration", s.discovery)
	mux.HandleFunc("GET /keys", s.jwks)
	mux.HandleFunc("GET /authorize", s.authorizePage)
	mux.HandleFunc("POST /authorize", s.authorizeChoose)
	mux.HandleFunc("POST /token", s.token)
	log.Printf("devauth: DEVELOPMENT ONLY identity provider at %s (audience %s)", s.issuer, s.audience)
	logged := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.String())
		mux.ServeHTTP(w, r)
	})
	log.Fatal(http.ListenAndServe(*addr, logged))
}

func (s *server) discovery(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{
		"issuer":                                s.issuer,
		"authorization_endpoint":                s.issuer + "/authorize",
		"token_endpoint":                        s.issuer + "/token",
		"jwks_uri":                              s.issuer + "/keys",
		"response_types_supported":              []string{"code"},
		"grant_types_supported":                 []string{"authorization_code", "refresh_token"},
		"code_challenge_methods_supported":      []string{"S256"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
	})
}

func (s *server) jwks(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{"keys": []map[string]string{{
		"kty": "RSA", "use": "sig", "alg": "RS256", "kid": s.kid,
		"n": base64.RawURLEncoding.EncodeToString(s.key.N.Bytes()),
		"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(s.key.E)).Bytes()),
	}}})
}

var page = template.Must(template.New("p").Parse(`<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CargoTrack development sign-in</title>
<style>
 body{font-family:system-ui,sans-serif;margin:0;padding:24px;max-width:520px;color:#111418}
 h1{font-size:22px;margin:0 0 4px} p.note{color:#B45309;margin:0 0 24px;font-size:14px}
 button{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid #E6E8EB;padding:16px 0;cursor:pointer}
 b{font-size:17px;display:block} span{color:#5B6470;font-size:14px}
</style></head><body>
<h1>Choose a demo user</h1>
<p class="note">Development sign-in. Real accounts use Zitadel.</p>
<form method="post">
 {{range $k, $v := .Query}}<input type="hidden" name="{{$k}}" value="{{index $v 0}}">{{end}}
 {{range .Users}}<button name="user" value="{{.ID}}"><b>{{.Name}} &middot; {{.OrgName}}</b><span>{{.Description}}</span></button>{{end}}
</form></body></html>`))

func (s *server) authorizePage(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if q.Get("response_type") != "code" || q.Get("code_challenge") == "" || q.Get("code_challenge_method") != "S256" {
		http.Error(w, "only the authorization code flow with S256 PKCE is supported", http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = page.Execute(w, map[string]any{"Query": q, "Users": users})
}

func (s *server) authorizeChoose(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var chosen *user
	for i := range users {
		if users[i].ID == r.PostForm.Get("user") {
			chosen = &users[i]
		}
	}
	redirect, err := url.Parse(r.PostForm.Get("redirect_uri"))
	if chosen == nil || err != nil || redirect.Scheme == "" {
		http.Error(w, "unknown user or redirect_uri", http.StatusBadRequest)
		return
	}
	code := randomString(24)
	s.mu.Lock()
	s.codes[code] = grant{user: *chosen, redirectURI: redirect.String(), challenge: r.PostForm.Get("code_challenge"),
		expires: time.Now().Add(2 * time.Minute)}
	s.mu.Unlock()

	q := redirect.Query()
	q.Set("code", code)
	q.Set("state", r.PostForm.Get("state"))
	redirect.RawQuery = q.Encode()
	http.Redirect(w, r, redirect.String(), http.StatusFound)
}

func (s *server) token(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		tokenError(w, "invalid_request")
		return
	}
	var u user
	switch r.PostForm.Get("grant_type") {
	case "authorization_code":
		s.mu.Lock()
		g, ok := s.codes[r.PostForm.Get("code")]
		delete(s.codes, r.PostForm.Get("code"))
		s.mu.Unlock()
		sum := sha256.Sum256([]byte(r.PostForm.Get("code_verifier")))
		switch {
		case !ok || time.Now().After(g.expires):
			tokenError(w, "invalid_grant")
			return
		case base64.RawURLEncoding.EncodeToString(sum[:]) != g.challenge:
			tokenError(w, "invalid_grant") // PKCE verifier does not match
			return
		case r.PostForm.Get("redirect_uri") != g.redirectURI:
			tokenError(w, "invalid_grant")
			return
		}
		u = g.user
	case "refresh_token":
		s.mu.Lock()
		found, ok := s.refresh[r.PostForm.Get("refresh_token")]
		delete(s.refresh, r.PostForm.Get("refresh_token")) // rotate, like Zitadel
		s.mu.Unlock()
		if !ok {
			tokenError(w, "invalid_grant")
			return
		}
		u = found
	default:
		tokenError(w, "unsupported_grant_type")
		return
	}

	access, err := s.sign(u)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	refresh := randomString(32)
	s.mu.Lock()
	s.refresh[refresh] = u
	s.mu.Unlock()
	writeJSON(w, map[string]any{
		"access_token": access, "token_type": "Bearer", "expires_in": 3600, "refresh_token": refresh,
	})
}

func (s *server) sign(u user) (string, error) {
	roles := map[string]map[string]string{}
	for _, role := range u.Roles {
		roles[role] = map[string]string{u.OrgID: "dev.local"}
	}
	t := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": s.issuer, "aud": []string{s.audience}, "sub": u.ID,
		"iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix(),
		"email": u.Email, "email_verified": true, "name": u.Name,
		"urn:zitadel:iam:user:resourceowner:id":   u.OrgID,
		"urn:zitadel:iam:user:resourceowner:name": u.OrgName,
		"urn:zitadel:iam:org:project:roles":       roles,
	})
	t.Header["kid"] = s.kid
	return t.SignedString(s.key)
}

func tokenError(w http.ResponseWriter, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func randomString(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x", b)
}
