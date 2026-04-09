from django.urls import path
from . import api_views

urlpatterns = [
    path("events/",          api_views.TrackingEventListCreateView.as_view(), name="events"),
    path("events/<int:pk>/", api_views.TrackingEventDetailView.as_view(),     name="event-detail"),
    path("<str:tracking_number>/events/", api_views.ShipmentEventsView.as_view(), name="shipment-events"),
]
