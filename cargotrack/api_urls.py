"""
cargotrack/api_urls.py
Versioned API router — mounted at /api/<version>/ in cargotrack/urls.py.

All endpoints require JWT (or session) authentication unless noted.
Use the Authorization header:
    Authorization: Bearer <access_token>

Obtain tokens:
    POST /api/auth/token/          {"username": "...", "password": "..."}
    POST /api/auth/token/refresh/  {"refresh": "<refresh_token>"}
"""
from django.urls import path, include

from shipments.api_views import (
    ShipmentListCreateAPIView,
    ShipmentDetailAPIView,
    PredictDelayAPIView as ShipmentPredictAPIView,
)
from tracking.api_views import (
    TrackingEventListCreateView,
    ShipmentTrackingEventsAPIView,
)
from alerts.api_urls import urlpatterns as alerts_patterns
from accounts.api_urls import urlpatterns as accounts_patterns
from dashboard.api_urls import urlpatterns as dashboard_patterns

urlpatterns = [
    # ── Shipments ─────────────────────────────────────────────────────────────
    path(
        'shipments/',
        ShipmentListCreateAPIView.as_view(),
        name='v1-shipment-list',
    ),
    path(
        'shipments/<int:pk>/',
        ShipmentDetailAPIView.as_view(),
        name='v1-shipment-detail',
    ),
    path(
        'shipments/<int:pk>/tracking-events/',
        ShipmentTrackingEventsAPIView.as_view(),
        name='v1-shipment-tracking-events',
    ),
    path(
        'shipments/<int:pk>/predict/',
        ShipmentPredictAPIView.as_view(),
        name='v1-shipment-predict',
    ),

    # ── Tracking ──────────────────────────────────────────────────────────────
    path(
        'tracking/',
        TrackingEventListCreateView.as_view(),
        name='v1-tracking-list',
    ),

    # ── Alerts ────────────────────────────────────────────────────────────────
    path('alerts/', include(alerts_patterns)),

    # ── Dashboard ─────────────────────────────────────────────────────────────
    path('dashboard/', include(dashboard_patterns)),

    # ── Accounts ──────────────────────────────────────────────────────────────
    path('accounts/', include(accounts_patterns)),
]
