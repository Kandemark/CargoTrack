"""dashboard/api_views.py — DRF API views for the logistics dashboard."""
from django.db import models as db_models
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from alerts.models import Alert
from shipments.models import Shipment

from .dashboard import LogisticsDashboard


def _compute_kpis() -> dict:
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
        "total_shipments":     total,
        "active_shipments":    active,
        "delivered_shipments": delivered,
        "delayed_shipments":   delayed,
        "exception_count":     delayed,
        "on_time_rate":        on_time_rate,
        "carrier_count":       carrier_count,
        "open_alerts":         Alert.objects.filter(acknowledged=False).count(),
    }


class KPIApiView(APIView):
    """GET /api/v1/dashboard/kpis/ — KPI summary for the React dashboard."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_compute_kpis())


class MapDataAPIView(APIView):
    """
    GET /api/v1/dashboard/map/
    Returns a GeoJSON FeatureCollection of recent tracking event locations.
    Location is stored as free text, so features are empty until geocoding
    is implemented.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"type": "FeatureCollection", "features": []})


class DashboardAPIView(APIView):
    """
    GET /api/v1/dashboard/stats/
    Returns summary stats, recent events, and per-carrier performance.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        db = LogisticsDashboard()
        return Response({
            "summary":             db.get_summary_stats(),
            "recent_events":       db.get_recent_events(),
            "carrier_performance": db.get_carrier_performance(),
        })
