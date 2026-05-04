from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api_views import DriverAnalyticsView, DriverViewSet, FleetStatsView, TruckViewSet

router = DefaultRouter()
router.register('trucks',  TruckViewSet,  basename='truck')
router.register('drivers', DriverViewSet, basename='driver')

urlpatterns = [
    path('stats/', FleetStatsView.as_view(), name='fleet-stats'),
    path('drivers/stats/', DriverAnalyticsView.as_view(), name='driver-analytics'),
    path('',       include(router.urls)),
]
