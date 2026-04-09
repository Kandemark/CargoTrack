from django.urls import path
from .api_views import ShipmentListCreateAPIView, ShipmentDetailAPIView, PredictDelayAPIView

urlpatterns = [
    path("",               ShipmentListCreateAPIView.as_view(), name="api-list"),
    path("<int:pk>/",      ShipmentDetailAPIView.as_view(),     name="api-detail"),
    path("<int:pk>/predict/", PredictDelayAPIView.as_view(),    name="api-predict"),
]
