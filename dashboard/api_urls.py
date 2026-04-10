"""
dashboard/api_urls.py — URL patterns for the dashboard app
===========================================================

Mounted at ``/api/<version>/dashboard/`` by cargotrack/api_urls.py.
All routes require at minimum IsAuthenticated.

Routes
------
GET  /api/v1/dashboard/stats/   Full dashboard payload (summary, events, carriers).
GET  /api/v1/dashboard/kpis/    Compact KPI card data for the React dashboard header.
GET  /api/v1/dashboard/map/     GeoJSON FeatureCollection (stub until geocoding
                                 is implemented).
"""
from django.urls import path
from .api_views import DashboardAPIView, KPIApiView, MapDataAPIView

urlpatterns = [
    path('stats/', DashboardAPIView.as_view(), name='v1-dashboard-stats'),
    path('kpis/',  KPIApiView.as_view(),       name='v1-dashboard-kpis'),
    path('map/',   MapDataAPIView.as_view(),   name='v1-dashboard-map'),
]
