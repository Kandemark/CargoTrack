"""CargoTrack Root URL Configuration"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # ── JWT authentication ────────────────────────────────────────────────────
    path('api/auth/token/',         TokenObtainPairView.as_view(),  name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(),     name='token_refresh'),
    path('api/auth/token/verify/',  TokenVerifyView.as_view(),      name='token_verify'),

    # ── Versioned REST API v1 ─────────────────────────────────────────────────
    path('api/<version>/', include('cargotrack.api_urls')),

    # ── Legacy unversioned API (kept for backward compatibility) ──────────────
    path('api/shipments/',   include('shipments.api_urls')),
    path('api/tracking/',    include('tracking.api_urls')),

    # ── Legacy Django template views (kept during React migration) ───────────
    path('shipments/',   include('shipments.urls',   namespace='shipments')),
    path('tracking/',    include('tracking.urls',    namespace='tracking')),
    path('alerts/',      include('alerts.urls',      namespace='alerts')),
    path('dashboard/',   include('dashboard.urls',   namespace='dashboard')),
    path('accounts/',    include('accounts.urls',    namespace='accounts')),

    # ── React SPA catch-all (production) ─────────────────────────────────────
    re_path(r'^(?!api/|admin/|static/|media/).*$',
            TemplateView.as_view(template_name='index.html'),
            name='react_app'),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
