"""predictions URL routing — mounted at /api/<version>/predictions/"""
from django.urls import path
from .views import (
    DelayPredictionView,
    DemandForecastView,
    PricingRecommendationView,
    TheftRiskView,
    DriverScoreView,
    BorderDelayView,
    FuelOptimizeView,
    ContainerMatchView,
    ShipmentPredictionView,
)

urlpatterns = [
    path("delay/", DelayPredictionView.as_view(), name="predict-delay"),
    path("demand/", DemandForecastView.as_view(), name="predict-demand"),
    path("pricing/", PricingRecommendationView.as_view(), name="predict-pricing"),
    path("theft-risk/", TheftRiskView.as_view(), name="predict-theft-risk"),
    path("driver-score/", DriverScoreView.as_view(), name="predict-driver-score"),
    path("border-delay/", BorderDelayView.as_view(), name="predict-border-delay"),
    path("fuel-optimize/", FuelOptimizeView.as_view(), name="predict-fuel"),
    path("container-match/", ContainerMatchView.as_view(), name="predict-container"),
    path("shipment/", ShipmentPredictionView.as_view(), name="predict-shipment"),
]
