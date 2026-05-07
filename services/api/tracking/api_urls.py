"""
tracking/api_urls.py — URL patterns for the tracking app
=========================================================

Mounted at ``/api/<version>/tracking/`` by cargotrack/api_urls.py.

Routes
------
GET  POST  /api/v1/tracking/events/                  Global event list / create.
GET        /api/v1/tracking/events/<pk>/             Single event detail.
GET        /api/v1/tracking/<tracking_number>/events/ Events for a shipment
                                                      (legacy — prefer the
                                                      /shipments/<pk>/tracking-events/
                                                      sub-resource endpoint).
"""
from django.urls import path
from cargotrack.async_views import async_tracking_event_create
from . import api_views

urlpatterns = [
    path("events/",          api_views.TrackingEventListCreateView.as_view(), name="events"),
    path("events/async/",    async_tracking_event_create,                     name="events-async"),
    path("events/<int:pk>/", api_views.TrackingEventDetailView.as_view(),     name="event-detail"),
    # Legacy endpoint — kept for backwards compatibility; prefer the shipments
    # sub-resource path for new clients.
    path("<str:tracking_number>/events/", api_views.ShipmentEventsView.as_view(), name="shipment-events"),
]
