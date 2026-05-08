"""
Keycloak OIDC configuration for Django.

With Keycloak as the identity provider, Django becomes a resource server —
validating JWTs issued by Keycloak rather than generating its own tokens.
SimpleJWT is kept for local development fallback (OIDC_ENABLED=false).
"""
import os

# Keycloak OIDC endpoints
KEYCLOAK_SERVER_URL = os.getenv(
    "KEYCLOAK_SERVER_URL", "http://keycloak:8080"
)
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "cargotrack")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "cargotrack-api")

OIDC_ISSUER = f"{KEYCLOAK_SERVER_URL}/realms/{KEYCLOAK_REALM}"
OIDC_JWKS_URL = f"{OIDC_ISSUER}/protocol/openid-connect/certs"
OIDC_AUTHORIZATION_URL = f"{OIDC_ISSUER}/protocol/openid-connect/auth"
OIDC_TOKEN_URL = f"{OIDC_ISSUER}/protocol/openid-connect/token"
OIDC_USERINFO_URL = f"{OIDC_ISSUER}/protocol/openid-connect/userinfo"
OIDC_LOGOUT_URL = f"{OIDC_ISSUER}/protocol/openid-connect/logout"

# Feature flag: set OIDC_ENABLED=true to use Keycloak instead of SimpleJWT.
OIDC_ENABLED = os.getenv("OIDC_ENABLED", "false").lower() in ("1", "true", "yes")

# When OIDC is enabled, validate tokens against Keycloak's JWKS.
if OIDC_ENABLED:
    SIMPLE_JWT_OVERRIDE = {
        "SIGNING_KEY": None,
        "VERIFYING_KEY": None,
        "ALGORITHM": "RS256",
        "ISSUER": OIDC_ISSUER,
        "JWK_URL": OIDC_JWKS_URL,
        "AUDIENCE": KEYCLOAK_CLIENT_ID,
        "USER_ID_CLAIM": "sub",
        "AUTH_HEADER_TYPES": ("Bearer",),
    }


# ── Role Mapping ───────────────────────────────────────────────────────────

# Map Keycloak realm roles to Django groups/permissions.
# Keycloak roles are embedded in the JWT `realm_access.roles` claim.
# Matches the 12 roles defined in deploy/keycloak/cargotrack-realm.json.
KEYCLOAK_ROLE_MAPPING = {
    "admin": {
        "is_staff": True,
        "is_superuser": True,
        "django_groups": ["Administrators"],
    },
    "logistics_mgr": {
        "is_staff": True,
        "django_groups": ["LogisticsManagers"],
    },
    "dispatcher": {
        "is_staff": True,
        "django_groups": ["Dispatchers"],
    },
    "driver": {
        "django_groups": ["Drivers"],
    },
    "client": {
        "django_groups": ["Shippers"],
    },
    "carrier": {
        "django_groups": ["Carriers"],
    },
    "customs_broker": {
        "is_staff": True,
        "django_groups": ["CustomsBrokers"],
    },
    "warehouse_mgr": {
        "is_staff": True,
        "django_groups": ["WarehouseManagers"],
    },
    "port_agent": {
        "is_staff": True,
        "django_groups": ["PortAgents"],
    },
    "finance_officer": {
        "is_staff": True,
        "django_groups": ["Finance"],
    },
    "viewer": {
        "django_groups": ["Viewers"],
    },
    "api_client": {
        "django_groups": ["ApiClients"],
    },
}


# ── OIDC Authentication Backend ────────────────────────────────────────────

def get_oidc_authentication_backends():
    """Return authentication backends list with OIDC if enabled."""
    backends = [
        "django.contrib.auth.backends.ModelBackend",
    ]
    if OIDC_ENABLED:
        backends.insert(
            0, "mozilla_django_oidc.auth.OIDCAuthenticationBackend"
        )
    return backends
