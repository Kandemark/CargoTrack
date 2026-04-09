"""
dashboard/views.py
KPI aggregation and analytics views.

OOP: Encapsulation — all KPI computation logic delegated to LogisticsDashboard;
     views stay thin and only handle HTTP concerns.
"""
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView
from django.db import models as db_models
from django.db.models import Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from shipments.models import Shipment
from alerts.models import Alert
from tracking.models import TrackingEvent
from .dashboard import LogisticsDashboard


class DashboardView(LoginRequiredMixin, TemplateView):
    """Main logistics dashboard with KPI summary."""
    template_name = "dashboard/index.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["kpis"] = self._get_kpis()
        ctx["recent_shipments"] = (
            Shipment.objects.select_related("route").order_by("-created_at")[:10]
        )
        ctx["unread_count"] = Alert.objects.filter(acknowledged=False).count()
        return ctx

    def _get_kpis(self) -> dict:
        """Compute dashboard KPIs."""
        total     = Shipment.objects.count()
        active    = Shipment.objects.exclude(status__in=["DELIVERED"]).count()
        delivered = Shipment.objects.filter(status="DELIVERED").count()
        delayed   = Shipment.objects.filter(status="DELAYED").count()

        on_time = Shipment.objects.filter(
            status="DELIVERED",
            actual_arrival__isnull=False,
            actual_arrival__lte=db_models.F("scheduled_arrival"),
        ).count()
        on_time_rate = round((on_time / delivered * 100) if delivered else 100, 1)

        carrier_count = Shipment.objects.values("carrier_name").distinct().count()

        return {
            "total_shipments":    total,
            "active_shipments":   active,
            "delivered_shipments": delivered,
            "delayed_shipments":  delayed,
            "exception_count":    delayed,
            "on_time_rate":       on_time_rate,
            "carrier_count":      carrier_count,
            "open_alerts":        Alert.objects.filter(acknowledged=False).count(),
        }


class KPIApiView(APIView):
    """REST endpoint returning KPI data for Chart.js dashboard."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        view = DashboardView()
        return Response(view._get_kpis())


class MapDataAPIView(APIView):
    """
    Returns recent TrackingEvent locations as a GeoJSON FeatureCollection
    for the Leaflet map on the dashboard.

    Since our TrackingEvent model stores location as a plain text field
    (not lat/lng coordinates), we return an empty FeatureCollection.
    The map renders without markers rather than crashing.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"type": "FeatureCollection", "features": []})


class DashboardAPIView(APIView):
    """
    Unified dashboard API — returns summary stats, recent events,
    and per-carrier performance in one response.

    GET /dashboard/api/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        db = LogisticsDashboard()
        return Response({
            'summary':             db.get_summary_stats(),
            'recent_events':       db.get_recent_events(),
            'carrier_performance': db.get_carrier_performance(),
        })
