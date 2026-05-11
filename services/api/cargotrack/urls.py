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
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenVerifyView
from accounts.api_views import RegisterAPIView
from cargotrack.auth_views import (
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    CookieTokenLogoutView,
)
from cargotrack.health import HealthCheckView


class ThrottledRegisterAPIView(RegisterAPIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'


urlpatterns = [
    path('admin/', admin.site.urls),

    # ── JWT authentication (cookie-based for web, header fallback for mobile) ──
    path('api/auth/token/',          CookieTokenObtainPairView.as_view(),  name='token_obtain_pair'),
    path('api/auth/token/refresh/',  CookieTokenRefreshView.as_view(),     name='token_refresh'),
    path('api/auth/token/verify/',   TokenVerifyView.as_view(),            name='token_verify'),
    path('api/auth/token/logout/',   CookieTokenLogoutView.as_view(),      name='token_logout'),
    # Keep blacklist for backwards compat with mobile clients
    path('api/auth/token/blacklist/', CookieTokenLogoutView.as_view(),     name='token_blacklist'),
    # AllowAny — registration is public so new users can sign up without a token.
    path('api/auth/register/',       ThrottledRegisterAPIView.as_view(),  name='register'),
    path('api/health/',              HealthCheckView.as_view(),      name='api-health'),

    # ── Prometheus metrics (scraped by prometheus:9090) ────────────────────────
    path('', include('django_prometheus.urls')),

    # ── OpenAPI schema & docs ──────────────────────────────────────────────────
    path('api/schema/',              SpectacularAPIView.as_view(),    name='schema'),
    path('api/docs/swagger/',        SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/docs/redoc/',          SpectacularRedocView.as_view(url_name='schema'),   name='redoc'),

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
