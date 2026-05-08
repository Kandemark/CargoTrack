from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api_views import (
    AssignTruckView, DriverAnalyticsView, DriverExpenseViewSet,
    DriverTripSheetView, DriverViewSet, FleetStatsView,
    OfflineSyncView, TruckViewSet,
)

router = DefaultRouter()
router.register('trucks',  TruckViewSet,  basename='truck')
router.register('drivers', DriverViewSet, basename='driver')
router.register('expenses', DriverExpenseViewSet, basename='expense')

urlpatterns = [
    path('stats/', FleetStatsView.as_view(), name='fleet-stats'),
    path('drivers/stats/', DriverAnalyticsView.as_view(), name='driver-analytics'),
    path('driver/trip-sheet/', DriverTripSheetView.as_view(), name='driver-trip-sheet'),
    path('offline-sync/', OfflineSyncView.as_view(), name='offline-sync'),
    path('trucks/<int:pk>/assign-truck/', AssignTruckView.as_view(), name='truck-assign'),
    path('',       include(router.urls)),
]
