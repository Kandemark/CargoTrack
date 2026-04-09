from django.urls import path
from .views import DashboardAPIView, KPIApiView

urlpatterns = [
    path('stats/', DashboardAPIView.as_view(), name='v1-dashboard-stats'),
    path('kpis/',  KPIApiView.as_view(),       name='v1-dashboard-kpis'),
]
