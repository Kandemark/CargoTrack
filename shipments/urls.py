from django.http import HttpResponse
from django.urls import path
from . import views
from .api_views import (
    ShipmentListCreateAPIView,
    ShipmentDetailAPIView,
    PredictDelayAPIView,
)

app_name = "shipments"


def placeholder(request):
    return HttpResponse("shipments")


urlpatterns = [
    # ── HTML / template routes ─────────────────────────────────────────────
    path("list/",          views.ShipmentListView.as_view(),    name="list"),
    path("create/",        views.ShipmentCreateView.as_view(),  name="create"),
    path("track/",         views.TrackByNumberView.as_view(),   name="track"),
    # Tracking-number detail — uses str converter so it matches before <int:pk>
    path("<str:tracking_number>/", views.ShipmentDetailView.as_view(), name="detail"),

    # ── JSON API routes ────────────────────────────────────────────────────
    path("api/",              ShipmentListCreateAPIView.as_view(), name="list_create"),
    path("api/<int:pk>/",     ShipmentDetailAPIView.as_view(),     name="api-detail"),
    path("api/<int:pk>/predict/", PredictDelayAPIView.as_view(),   name="predict_delay"),
]
