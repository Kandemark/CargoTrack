"""
cargotrack/api_urls.py — Versioned API Router
==============================================

Mounted at ``/api/<version>/`` by cargotrack/urls.py.
All endpoints require ``Authorization: Bearer <access_token>`` unless
explicitly overridden with ``permission_classes = [AllowAny]``.

Resolved URL table (prefix = /api/v1/)
---------------------------------------
Prefix          Module                  Description
-----------     --------------------    ----------------------------------------
accounts/       accounts.api_urls       User profile (GET/PATCH /api/v1/accounts/me/)
routes/         shipments.api_views     Read-only route catalogue (RouteListAPIView)
shipments/      shipments.api_urls      Shipment CRUD + delay-prediction trigger
tracking/       tracking.api_urls       TrackingEvent list + create
alerts/         alerts.api_urls         Alert list + notification stream
dashboard/      dashboard.api_urls      KPI aggregates (read-only, manager+ access)

Note: ``routes/`` is mounted here (not under ``shipments/``) to keep the public
API path as ``/api/v1/routes/`` — matching the README contract and the frontend
API client. Moving it into ``shipments.api_urls`` would produce the breaking path
``/api/v1/shipments/routes/``.
"""
from django.urls import path, include
from shipments.api_views import RouteListAPIView

urlpatterns = [
    path('accounts/',  include('accounts.api_urls')),
    # RouteListAPIView lives in shipments but is mounted at the top-level routes/
    # prefix to keep the public API path at /api/v1/routes/ (see module docstring).
    path('routes/',    RouteListAPIView.as_view(), name='v1-routes'),
    path('shipments/', include('shipments.api_urls')),
    path('tracking/',  include('tracking.api_urls')),
    path('alerts/',    include('alerts.api_urls')),
    path('dashboard/', include('dashboard.api_urls')),
    path('',           include('payments.api_urls')),      # /api/v1/invoices/ + /api/v1/payments/webhook/*
]
