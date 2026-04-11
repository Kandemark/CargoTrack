"""
shipments/api_urls.py — URL patterns for the shipments app
===========================================================

Mounted at ``/api/<version>/shipments/`` by cargotrack/api_urls.py.

Routes
------
GET  POST  /api/v1/shipments/                      List / create shipments.
GET  PATCH  /api/v1/shipments/<pk>/                Retrieve / status-update a shipment.
POST        /api/v1/shipments/<pk>/predict/        Run delay prediction on a shipment.
GET         /api/v1/shipments/<pk>/tracking-events/ List TrackingEvents for a shipment.
"""
from django.urls import path
from .api_views import (
    ShipmentListCreateAPIView, ShipmentDetailAPIView, PredictDelayAPIView,
    ShipmentDocumentListCreateAPIView, PublicTrackingAPIView,
)
from tracking.api_views import ShipmentTrackingEventsAPIView

urlpatterns = [
    path('',                            ShipmentListCreateAPIView.as_view(),         name='api-list'),
    path('<int:pk>/',                   ShipmentDetailAPIView.as_view(),             name='api-detail'),
    path('<int:pk>/predict/',           PredictDelayAPIView.as_view(),               name='api-predict'),
    path('<int:pk>/tracking-events/',   ShipmentTrackingEventsAPIView.as_view(),     name='api-tracking-events'),
    path('<int:pk>/documents/',         ShipmentDocumentListCreateAPIView.as_view(), name='api-documents'),
    path('track/<str:tracking_number>/', PublicTrackingAPIView.as_view(),            name='api-public-track'),
]
