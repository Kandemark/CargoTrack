"""
shipments/api_urls.py — URL patterns for the shipments app.
"""
from django.urls import path
from .api_views import (
    ShipmentListCreateAPIView, ShipmentDetailAPIView, PredictDelayAPIView,
    ShipmentDocumentListCreateAPIView, PublicTrackingAPIView,
    ComplianceDocListCreateView, ComplianceDocDetailView,
    DispatchShipmentView,
    SLAListView, AnalyticsView, CarbonView,
)
from tracking.api_views import ShipmentTrackingEventsAPIView

urlpatterns = [
    path('',                               ShipmentListCreateAPIView.as_view(),         name='api-list'),
    path('<int:pk>/',                      ShipmentDetailAPIView.as_view(),             name='api-detail'),
    path('<int:pk>/predict/',              PredictDelayAPIView.as_view(),               name='api-predict'),
    path('<int:pk>/tracking-events/',      ShipmentTrackingEventsAPIView.as_view(),     name='api-tracking-events'),
    path('<int:pk>/documents/',            ShipmentDocumentListCreateAPIView.as_view(), name='api-documents'),
    path('<int:pk>/dispatch/',             DispatchShipmentView.as_view(),              name='api-dispatch'),
    path('<int:pk>/compliance/',           ComplianceDocListCreateView.as_view(),       name='api-shipment-compliance'),
    path('track/<str:tracking_number>/',   PublicTrackingAPIView.as_view(),             name='api-public-track'),
]
