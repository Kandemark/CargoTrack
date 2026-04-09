from django.http import HttpResponse
from django.urls import path
from . import views

app_name = "tracking"


def placeholder(request):
    return HttpResponse("tracking")


urlpatterns = [
    # Public — no login required
    path("track/", views.PublicTrackView.as_view(), name="public_track"),
    # Authenticated HTML views
    path("<str:tracking_number>/log/",    views.LogEventFormView.as_view(),   name="log"),
    # JSON CRUD API views
    path("shipment/<int:shipment_id>/", views.ShipmentTrackingView.as_view(), name="shipment_events"),
    path("log/",                        views.LogEventView.as_view(),         name="log_event"),
    path("<int:pk>/",                   views.EventDetailView.as_view(),      name="event_detail"),
]
