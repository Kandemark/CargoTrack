"""coldchain/urls.py"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ColdChainShipmentViewSet, TemperatureReadingViewSet, compliance_dashboard,
)

router = DefaultRouter()
router.register(r'coldchain', ColdChainShipmentViewSet, basename='coldchain')
router.register(r'temperature-readings', TemperatureReadingViewSet, basename='temperature-readings')

urlpatterns = [
    path('compliance-dashboard/', compliance_dashboard, name='coldchain-compliance-dashboard'),
    path('', include(router.urls)),
]
