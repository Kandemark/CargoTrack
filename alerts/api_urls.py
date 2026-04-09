from django.urls import path
from . import api_views

urlpatterns = [
    path('',              api_views.AlertListAPIView.as_view(),        name='v1-alert-list'),
    path('<int:pk>/acknowledge/', api_views.AlertAcknowledgeAPIView.as_view(), name='v1-alert-ack'),
]
