"""
alerts/api_urls.py — URL patterns for the alerts app
======================================================

Mounted at ``/api/<version>/alerts/`` by cargotrack/api_urls.py.

Routes
------
GET   /api/v1/alerts/                       List alerts (unacked by default;
                                            ?all=1 for manager+ to see all).
POST  /api/v1/alerts/<pk>/acknowledge/      Acknowledge an alert (manager+).
"""
from django.urls import path
from . import api_views

urlpatterns = [
    path('',              api_views.AlertListAPIView.as_view(),               name='v1-alert-list'),
    path('<int:pk>/acknowledge/', api_views.AlertAcknowledgeAPIView.as_view(), name='v1-alert-ack'),
]
