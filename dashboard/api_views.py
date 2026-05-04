"""dashboard/api_views.py — DRF API views for the logistics dashboard."""
from django.db import models as db_models
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from alerts.models import Alert
from carriers.models import Carrier
from fleet.models import Truck
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

    def get(self, request, **kwargs):
        return Response(_compute_kpis())


class MapDataAPIView(APIView):
    """
    GET /api/v1/dashboard/map/?bounds=lat1,lng1,lat2,lng2
    Returns a GeoJSON FeatureCollection of active shipments with route lines.
    Each shipment is a Point feature; routes are LineString features.
    """
    permission_classes = [IsAuthenticated]

    # City coordinate lookup — mirrors LiveMap.tsx CITY_COORDS
    CITY_COORDS: dict[str, tuple[float, float]] = {
        'Mombasa':         (-4.0435,  39.6682),
        'Nairobi':         (-1.2921,  36.8219),
        'Kampala':         ( 0.3476,  32.5825),
        'Kigali':          (-1.9441,  30.0619),
        'Dar es Salaam':   (-6.7924,  39.2083),
        'Kisumu':          (-0.1022,  34.7617),
        'Eldoret':         ( 0.5143,  35.2698),
        'Bujumbura':       (-3.3731,  29.3644),
        'Juba':            ( 4.8594,  31.5713),
        'Dodoma':          (-6.1731,  35.7395),
        'Nakuru':          (-0.3031,  36.0800),
        'Thika':           (-1.0332,  37.0693),
        'Garissa':         (-0.4532,  39.6461),
        'Nyeri':           (-0.4218,  36.9479),
        'Malindi':         (-3.2175,  40.1169),
        'Voi':             (-3.3969,  38.5565),
        'Machakos':        (-1.5177,  37.2634),
        'Kericho':         (-0.3687,  35.2863),
        'Kakamega':        ( 0.2827,  34.7519),
        'Taveta':          (-3.3961,  37.6761),
        'Kajiado':         (-1.8521,  36.7756),
        'Embu':            (-0.5303,  37.4501),
        'Lamu':            (-2.2694,  40.9022),
        'Nanyuki':         ( 0.0072,  37.0741),
        'Kwale':           (-4.1740,  39.4526),
    }

    def _lookup_coords(self, city: str):
        """Fuzzy-match city name to known coordinates."""
        city_lower = city.lower()
        for name, coords in self.CITY_COORDS.items():
            if name.lower() in city_lower or city_lower in name.lower():
                return coords
        return None

    def get(self, request, **kwargs):
        shipments = Shipment.objects.select_related('route').exclude(status='DELIVERED')[:200]
        features = []

        for s in shipments:
            origin_pos = self._lookup_coords(s.route.origin)
            dest_pos = self._lookup_coords(s.route.destination)

            if not origin_pos and not dest_pos:
                continue

            # Compute position as midpoint between origin and destination
            if origin_pos and dest_pos:
                pos = [(origin_pos[0] + dest_pos[0]) / 2, (origin_pos[1] + dest_pos[1]) / 2]
            else:
                pos = list(origin_pos or dest_pos)

            features.append({
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [pos[1], pos[0]]},
                'properties': {
                    'id': s.pk,
                    'tracking_number': s.tracking_number,
                    'status': s.status,
                    'carrier_name': s.carrier_name,
                    'risk_score': round(s.delay_risk_score, 3),
                    'weight_kg': s.weight_kg,
                    'origin': s.route.origin,
                    'destination': s.route.destination,
                    'scheduled_arrival': s.scheduled_arrival.isoformat() if s.scheduled_arrival else None,
                    'distance_km': s.route.distance_km,
                },
            })

            # Add route line if both coords known
            if origin_pos and dest_pos:
                features.append({
                    'type': 'Feature',
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': [[origin_pos[1], origin_pos[0]], [dest_pos[1], dest_pos[0]]],
                    },
                    'properties': {
                        'type': 'route',
                        'shipment_id': s.pk,
                        'status': s.status,
                        'risk_score': round(s.delay_risk_score, 3),
                    },
                })

        return Response({
            'type': 'FeatureCollection',
            'features': features,
        })


class DashboardAPIView(APIView):
    """
    GET /api/v1/dashboard/stats/
    Returns summary stats, recent events, and per-carrier performance.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        db = LogisticsDashboard()
        return Response({
            "summary":             db.get_summary_stats(),
            "recent_events":       db.get_recent_events(),
            "carrier_performance": db.get_carrier_performance(),
        })


class PublicLandingStatsView(APIView):
    """
    GET /api/v1/dashboard/public-stats/ — AllowAny
    Returns live aggregate stats and anonymized active shipment dots for the
    public landing page.
    """
    permission_classes = [AllowAny]

    CITY_COORDS: dict[str, tuple[float, float]] = {
        'Mombasa':         (-4.0435,  39.6682),
        'Nairobi':         (-1.2921,  36.8219),
        'Kampala':         ( 0.3476,  32.5825),
        'Kigali':          (-1.9441,  30.0619),
        'Dar es Salaam':   (-6.7924,  39.2083),
        'Kisumu':          (-0.1022,  34.7617),
        'Eldoret':         ( 0.5143,  35.2698),
        'Bujumbura':       (-3.3731,  29.3644),
        'Juba':            ( 4.8594,  31.5713),
        'Dodoma':          (-6.1731,  35.7395),
        'Nakuru':          (-0.3031,  36.0800),
        'Thika':           (-1.0332,  37.0693),
        'Garissa':         (-0.4532,  39.6461),
        'Nyeri':           (-0.4218,  36.9479),
        'Malindi':         (-3.2175,  40.1169),
        'Voi':             (-3.3969,  38.5565),
        'Machakos':        (-1.5177,  37.2634),
        'Kericho':         (-0.3687,  35.2863),
        'Kakamega':        ( 0.2827,  34.7519),
        'Taveta':          (-3.3961,  37.6761),
        'Kajiado':         (-1.8521,  36.7756),
        'Embu':            (-0.5303,  37.4501),
        'Lamu':            (-2.2694,  40.9022),
        'Nanyuki':         ( 0.0072,  37.0741),
        'Kwale':           (-4.1740,  39.4526),
    }

    def get(self, request, **kwargs):
        active = Shipment.objects.filter(status='IN_TRANSIT').count()
        total = Shipment.objects.count()
        carriers = Carrier.objects.filter(status='ACTIVE').count()
        trucks = Truck.objects.filter(status='ACTIVE').count()
        on_time = Shipment.objects.filter(
            status='DELIVERED',
            actual_arrival__isnull=False,
            actual_arrival__lte=db_models.F('scheduled_arrival'),
        ).count()
        delivered = Shipment.objects.filter(status='DELIVERED').count()
        on_time_rate = round((on_time / delivered * 100), 1) if delivered else 100.0

        # Social proof stats
        total_weight = Shipment.objects.aggregate(
            total=db_models.Sum('weight_kg')
        )['total'] or 0
        total_tonnes = round(total_weight / 1000, 1)
        delayed = Shipment.objects.filter(status='DELAYED').count()
        delay_pct = round((delayed / total * 100), 1) if total else 0
        from fleet.models import Driver
        avg_rating = Driver.objects.aggregate(
            avg=db_models.Avg('rating')
        )['avg'] or 5.0

        # Anonymized active shipment dots for mini map
        dots = []
        for s in Shipment.objects.select_related('route').exclude(status='DELIVERED')[:20]:
            origin_pos = None
            dest_pos = None
            for name, coords in self.CITY_COORDS.items():
                if name.lower() in s.route.origin.lower() or s.route.origin.lower() in name.lower():
                    origin_pos = coords
                if name.lower() in s.route.destination.lower() or s.route.destination.lower() in name.lower():
                    dest_pos = coords
            if origin_pos:
                dots.append({'lat': origin_pos[0], 'lng': origin_pos[1], 'status': s.status})

        return Response({
            'active_shipments': active,
            'total_shipments': total,
            'active_carriers': carriers,
            'active_trucks': trucks,
            'on_time_rate': on_time_rate,
            'total_tonnes': total_tonnes,
            'delay_rate': delay_pct,
            'avg_driver_rating': round(float(avg_rating), 1),
            'total_deliveries': delivered,
            'map_dots': dots,
        })
