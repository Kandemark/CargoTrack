package auth_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/cargotrack/core/internal/platform/auth"
	"github.com/cargotrack/core/internal/platform/testkit"
)

func TestVerifyAcceptsZitadelToken(t *testing.T) {
	iss := testkit.NewIssuer(t)
	v := auth.NewOIDCVerifier(iss.URL, testkit.Audience)
	u := testkit.NewUser(auth.RoleFinance)

	id, err := v.Verify(context.Background(), iss.Token(t, u, nil))
	if err != nil {
		t.Fatal(err)
	}
	if id.IdPUserID != u.ID || id.IdPOrgID != u.OrgID || id.OrgName != u.OrgName {
		t.Fatalf("identity = %+v, want user %s in org %s", id, u.ID, u.OrgID)
	}
	if !slices.Equal(id.Roles, []string{auth.RoleFinance}) {
		t.Fatalf("roles = %v", id.Roles)
	}
}

func TestVerifyRejects(t *testing.T) {
	iss := testkit.NewIssuer(t)
	other := testkit.NewIssuer(t)
	v := auth.NewOIDCVerifier(iss.URL, testkit.Audience)
	u := testkit.NewUser(auth.RoleOrgAdmin)

	hs256 := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss": iss.URL, "aud": testkit.Audience, "sub": u.ID, "exp": time.Now().Add(time.Hour).Unix(),
		"urn:zitadel:iam:user:resourceowner:id": u.OrgID,
	})
	hsToken, _ := hs256.SignedString([]byte("guessable"))

	cases := map[string]string{
		"wrong audience":      iss.Token(t, u, jwt.MapClaims{"aud": "some-other-app"}),
		"wrong issuer":        iss.Token(t, u, jwt.MapClaims{"iss": "https://evil.example"}),
		"expired":             iss.Token(t, u, jwt.MapClaims{"exp": time.Now().Add(-time.Hour).Unix()}),
		"no expiry":           iss.Token(t, u, jwt.MapClaims{"exp": nil}),
		"no organisation":     iss.Token(t, u, jwt.MapClaims{"urn:zitadel:iam:user:resourceowner:id": nil}),
		"signed by stranger":  other.Token(t, u, jwt.MapClaims{"iss": iss.URL}),
		"symmetric algorithm": hsToken,
		"garbage":             "not.a.token",
	}
	for name, token := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := v.Verify(context.Background(), token); err == nil {
				t.Fatal("token accepted")
			}
		})
	}
}

func TestRolesFromOtherOrganisationsAreIgnored(t *testing.T) {
	iss := testkit.NewIssuer(t)
	v := auth.NewOIDCVerifier(iss.URL, testkit.Audience)
	u := testkit.NewUser()
	token := iss.Token(t, u, jwt.MapClaims{
		"urn:zitadel:iam:org:project:roles": map[string]any{
			auth.RolePlatformOwner: map[string]string{"some-other-org": "other.example"},
			auth.RoleOperations:    map[string]string{u.OrgID: "own.example"},
		},
	})
	id, err := v.Verify(context.Background(), token)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(id.Roles, []string{auth.RoleOperations}) {
		t.Fatalf("roles = %v, want only the role granted in the user's own organisation", id.Roles)
	}
}

func TestKeyRotationNeedsNoRestart(t *testing.T) {
	iss := testkit.NewIssuer(t)
	v := auth.NewOIDCVerifier(iss.URL, testkit.Audience).WithKeyRefreshInterval(0)
	u := testkit.NewUser()
	if _, err := v.Verify(context.Background(), iss.Token(t, u, nil)); err != nil {
		t.Fatal(err)
	}
	iss.Rotate(t)
	if _, err := v.Verify(context.Background(), iss.Token(t, u, nil)); err != nil {
		t.Fatalf("token signed with the rotated key rejected by the running verifier: %v", err)
	}
}

func TestUnknownKeysDoNotFloodTheIssuer(t *testing.T) {
	iss := testkit.NewIssuer(t)
	v := auth.NewOIDCVerifier(iss.URL, testkit.Audience)
	u := testkit.NewUser()
	if _, err := v.Verify(context.Background(), iss.Token(t, u, nil)); err != nil {
		t.Fatal(err)
	}
	iss.Rotate(t)
	// Keys were fetched under 30s ago, so the unknown kid is refused
	// instead of triggering another fetch.
	if _, err := v.Verify(context.Background(), iss.Token(t, u, nil)); err == nil {
		t.Fatal("refetched keys within the refresh interval")
	}
}

func TestPermissions(t *testing.T) {
	owner := auth.Principal{Roles: []string{auth.RolePlatformOwner}}
	finance := auth.Principal{Roles: []string{auth.RoleFinance}}
	driver := auth.Principal{Roles: []string{auth.RoleDriver}}
	none := auth.Principal{}

	if !owner.Can(auth.PlatformAdmin) || !owner.IsPlatformOwner() {
		t.Error("platform owner lacks platform.admin")
	}
	if !finance.Can(auth.BillingManage) || finance.Can(auth.PlatformAdmin) || finance.IsPlatformOwner() {
		t.Error("finance permissions wrong")
	}
	if driver.Can(auth.BillingView) || none.Can(auth.BillingView) {
		t.Error("driver or role-less user can see billing")
	}
}
