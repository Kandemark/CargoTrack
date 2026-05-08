"""pod/urls.py"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ProofOfDeliveryViewSet, PODDisputeViewSet, verify_pod_by_code,
)

router = DefaultRouter()
router.register(r'pod', ProofOfDeliveryViewSet, basename='pod')
router.register(r'disputes', PODDisputeViewSet, basename='dispute')

urlpatterns = [
    path('pod/verify-by-code/', verify_pod_by_code, name='pod-verify-by-code'),
    path('', include(router.urls)),
]
