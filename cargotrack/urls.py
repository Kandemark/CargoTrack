"""
cargotrack/urls.py — Root URL Configuration
============================================

URL groups
----------
/admin/                     Django admin site (session auth).
/api/auth/                  JWT token lifecycle (no version prefix — these are
                            version-agnostic and consumed by all clients):
    token/                  POST  — obtain access + refresh token pair.
    token/refresh/          POST  — exchange a refresh token for a new access token.
    token/verify/           POST  — confirm an access token is still valid.
    register/               POST  — create a new user account (AllowAny).

/api/<version>/             Versioned REST API — delegates to cargotrack.api_urls.
                            DRF URLPathVersioning extracts <version> and enforces
                            ALLOWED_VERSIONS = ['v1'] (see settings.py).

^(?!api/|admin/)            Negative-lookahead catch-all → serves the React SPA
                            (frontend/dist/index.html). The Vite dev server handles
                            this in development; in production Django serves the
                            pre-built static bundle from frontend/dist/.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
    TokenBlacklistView,
)
from accounts.api_views import RegisterAPIView, SecureTokenObtainPairView
from cargotrack.health import HealthCheckView


class ThrottledRegisterAPIView(RegisterAPIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'


urlpatterns = [
    path('admin/', admin.site.urls),

    # ── JWT authentication ────────────────────────────────────────────────────
    # These endpoints are intentionally outside the /api/<version>/ prefix so
    # that the auth flow doesn't need to change when a new API version ships.
    path('api/auth/token/',          SecureTokenObtainPairView.as_view(),  name='token_obtain_pair'),
    path('api/auth/token/refresh/',  TokenRefreshView.as_view(),     name='token_refresh'),
    path('api/auth/token/verify/',   TokenVerifyView.as_view(),      name='token_verify'),
    # Logout: invalidates the refresh token so it cannot be used again.
    # authStore.logout() POSTs to this endpoint before clearing local state.
    path('api/auth/token/blacklist/', TokenBlacklistView.as_view(),  name='token_blacklist'),
    # AllowAny — registration is public so new users can sign up without a token.
    path('api/auth/register/',       ThrottledRegisterAPIView.as_view(),      name='register'),
    path('api/health/',              HealthCheckView.as_view(),      name='api-health'),

    # ── Versioned REST API ────────────────────────────────────────────────────
    # DRF URLPathVersioning reads <version> here and injects it into request.version.
    # The router in api_urls.py does not re-validate the version string; that
    # validation happens in DRF (ALLOWED_VERSIONS = ['v1'] in settings.py).
    path('api/<version>/', include('cargotrack.api_urls')),

    # ── React SPA catch-all ───────────────────────────────────────────────────
    # The negative-lookahead regex matches every path that doesn't start with
    # 'api/' or 'admin/', so Django's URL dispatcher passes client-side routes
    # (e.g. /shipments/42, /dashboard) to React Router instead of 404-ing.
    # In development the Vite dev server intercepts at port 5173; this rule only
    # fires in production when Django serves the built SPA directly.
    re_path(r'^(?!api/|admin/).*$',
            TemplateView.as_view(template_name='index.html'),
            name='react_app'),
]
