"""
shipments/api_views.py — DRF class-based API views.

OOP:
    Inheritance  — each view extends a DRF generic or APIView base.
    Composition  — PredictDelayAPIView loads DelayPredictor (which composes
                   FeatureEngineer) to run inference without owning that logic.
"""
import csv
import datetime
import io
import random
import string

from django.db import models
from django.db.models import Avg, Count, Sum, Q, F
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from cargotrack.cache import invalidate_dashboard_caches
from .models import ComplianceDoc, Document, Route, Shipment
from .serializers import (
    ComplianceDocSerializer,
    DispatchSerializer,
    DocumentSerializer,
    RouteSerializer,
    ShipmentCreateSerializer,
    ShipmentSerializer,
    ShipmentStatusSerializer,
)


# ── DateRangeFilterMixin ──────────────────────────────────────────────────────

class DateRangeFilterMixin:
    """
    Mixin that adds date_from / date_to query-param filtering to any analytics view.

    Usage:
        qs = self.filter_date_range(queryset, 'created_at')
    """

    def filter_date_range(self, queryset, field='created_at'):
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(**{f'{field}__gte': date_from})
        if date_to:
            queryset = queryset.filter(**{f'{field}__lte': date_to})
        return queryset


def _generate_tracking_number() -> str:
    """Return a unique tracking number in the format CT-YYYYMMDD-XXXX."""
    date_str = datetime.date.today().strftime("%Y%m%d")
    while True:
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        candidate = f"CT-{date_str}-{suffix}"
        if not Shipment.objects.filter(tracking_number=candidate).exists():
            return candidate


@method_decorator(cache_page(300), name='dispatch')  # 5-min cache — routes rarely change
class RouteListAPIView(generics.ListAPIView):
    """
    GET /api/v1/routes/

    Returns all available routes without pagination — used to populate the
    route dropdown in the shipment creation form.
    """

    queryset = Route.objects.all()
    serializer_class = RouteSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None


class ShipmentListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /shipments/  — paginated list of all shipments.
    POST /shipments/  — create a new shipment; tracking_number auto-generated.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Shipment.objects.select_related(
            "route", "carrier", "assigned_truck", "assigned_driver",
        ).order_by("-created_at")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ShipmentCreateSerializer
        return ShipmentSerializer

    def perform_create(self, serializer):
        serializer.save(tracking_number=_generate_tracking_number())

    def create(self, request, *args, **kwargs):
        """Return full ShipmentSerializer representation after creation."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        invalidate_dashboard_caches()
        out = ShipmentSerializer(
            serializer.instance,
            context=self.get_serializer_context(),
        )
        return Response(out.data, status=status.HTTP_201_CREATED)


class ShipmentDetailAPIView(generics.RetrieveUpdateAPIView):
    """
    GET   /shipments/<pk>/  — full shipment detail.
    PATCH /shipments/<pk>/  — update the status field only.
    """

    queryset = Shipment.objects.select_related(
        "route", "carrier", "assigned_truck", "assigned_driver",
    ).all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return ShipmentStatusSerializer
        return ShipmentSerializer

    def partial_update(self, request, *args, **kwargs):
        """Accept only the 'status' field; ignore any other supplied keys."""
        allowed = {"status": request.data.get("status")}
        if not allowed["status"]:
            return Response(
                {"error": "'status' field is required for PATCH."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(
            self.get_object(), data=allowed, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        invalidate_dashboard_caches()
        return Response(serializer.data)


class PredictDelayAPIView(APIView):
    """
    POST /shipments/<pk>/predict/

    Body: {"shipment_id": N}   (pk in URL is ignored for backwards compat;
    the body shipment_id is used so the endpoint can also be called standalone.)

    Loads the persisted DelayPredictor, runs feature extraction on the
    requested shipment, returns the predicted label and probability, and
    updates shipment.delay_risk_score in the database.

    Returns 503 if the model file has not been trained yet.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk=None, **kwargs):
        # Accept shipment_id from body OR URL pk
        shipment_id = request.data.get("shipment_id") or pk
        if not shipment_id:
            return Response(
                {"error": "Provide 'shipment_id' in the request body."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        shipment = get_object_or_404(
            Shipment.objects.select_related("route"), pk=shipment_id
        )

        # Load persisted predictor (includes fitted FeatureEngineer)
        try:
            from cargotrack.ml.delay_predictor import DelayPredictor
            dp = DelayPredictor.load()
        except FileNotFoundError:
            return Response(
                {"error": "Model not trained yet. Run 'python manage.py train_model'."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Transform the single shipment using the loaded predictor's engineer
        qs = Shipment.objects.select_related("route").filter(pk=shipment.pk)
        X  = dp.feature_engineer.transform(qs)

        label, prob = dp.predict(X)[0]

        # Persist updated risk score
        shipment.delay_risk_score = round(prob, 4)
        shipment.save(update_fields=["delay_risk_score", "updated_at"])

        # ── Integration (Andrew Maina - Systems Integration) ──────────────────
        # Fire alerts if the risk score crosses the configured threshold.
        # This ties together the ML prediction and the notification system.
        from predictions.base import DelayPrediction
        from alerts.manager import AlertManager

        prediction = DelayPrediction(
            delay_risk_score=prob,
            # If label=1, we assume at least 24h delay as per the model contract.
            predicted_delay_hours=24.0 if label else 0.0,
            shipment_id=shipment.pk
        )

        am = AlertManager()
        am.check_shipment(shipment, prediction)

        return Response({
            "shipment_id":       shipment.pk,
            "tracking_number":   shipment.tracking_number,
            "delay_risk_score":  shipment.delay_risk_score,
            "predicted_delayed": bool(label),
            "confidence":        round(prob, 4),
        })


class ShipmentDocumentListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /api/v1/shipments/<pk>/documents/ — list documents for a shipment.
    POST /api/v1/shipments/<pk>/documents/ — upload a document (multipart/form-data).
    """
    serializer_class   = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes: list  # accept multipart uploads

    def get_queryset(self):
        return Document.objects.filter(shipment_id=self.kwargs['pk'])

    def perform_create(self, serializer):
        shipment = get_object_or_404(Shipment, pk=self.kwargs['pk'])
        serializer.save(shipment=shipment, uploaded_by=self.request.user)


class ComplianceDocListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/compliance/                   — list all compliance docs.
    POST /api/v1/compliance/                   — create a compliance doc.
    GET  /api/v1/shipments/<pk>/compliance/    — docs for a specific shipment.
    """
    serializer_class   = ComplianceDocSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        shipment_pk = self.kwargs.get('pk')
        if shipment_pk:
            return ComplianceDoc.objects.filter(shipment_id=shipment_pk).select_related('shipment')
        qs = ComplianceDoc.objects.select_related('shipment').all()
        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter != 'ALL':
            qs = qs.filter(status=status_filter)
        return qs


class ComplianceDocDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/v1/compliance/<pk>/"""
    serializer_class   = ComplianceDocSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ComplianceDoc.objects.select_related('shipment').all()


class SLAListView(APIView):
    """
    GET /api/v1/sla/ — SLA compliance data derived from shipments.
    Returns per-shipment SLA status based on scheduled vs actual arrival.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        from django.utils import timezone
        import datetime

        shipments = Shipment.objects.select_related('route').filter(
            status__in=['IN_TRANSIT', 'DELIVERED', 'DELAYED', 'CUSTOMS']
        ).order_by('-scheduled_arrival')[:200]

        now = timezone.now()
        results = []
        for s in shipments:
            if s.actual_arrival and s.scheduled_arrival:
                delta = s.actual_arrival - s.scheduled_arrival
                breach_hours = round(delta.total_seconds() / 3600, 1)
                if breach_hours <= 0:
                    sla_status = 'ON_TIME'
                elif breach_hours <= 4:
                    sla_status = 'AT_RISK'
                else:
                    sla_status = 'BREACHED'
            elif s.status == 'DELIVERED':
                breach_hours = 0
                sla_status = 'ON_TIME'
            else:
                remaining = (s.scheduled_arrival - now).total_seconds() / 3600
                if remaining < 0:
                    breach_hours = abs(remaining)
                    sla_status = 'BREACHED'
                elif remaining < 4:
                    breach_hours = 0
                    sla_status = 'AT_RISK'
                else:
                    breach_hours = 0
                    sla_status = 'ON_TIME'

            results.append({
                'id': s.pk,
                'tracking_number': s.tracking_number,
                'carrier': s.carrier_name,
                'route': f"{s.route.origin} → {s.route.destination}",
                'status': s.status,
                'sla_status': sla_status,
                'breach_hours': breach_hours,
                'scheduled_arrival': s.scheduled_arrival,
                'actual_arrival': s.actual_arrival,
            })

        status_filter = request.query_params.get('status')
        if status_filter and status_filter != 'ALL':
            results = [r for r in results if r['sla_status'] == status_filter]

        total = len(results)
        on_time = sum(1 for r in results if r['sla_status'] == 'ON_TIME')
        compliance_pct = round(on_time / total * 100, 1) if total else 100.0

        return Response({
            'compliance_pct': compliance_pct,
            'total': total,
            'on_time': on_time,
            'at_risk': sum(1 for r in results if r['sla_status'] == 'AT_RISK'),
            'breached': sum(1 for r in results if r['sla_status'] == 'BREACHED'),
            'items': results,
        })


@method_decorator(cache_page(120), name='dispatch')  # 2-min cache — aggregated analytics
class AnalyticsView(APIView):
    """
    GET /api/v1/analytics/ — aggregated analytics for dashboards.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        from django.db.models import Count, Sum, Avg
        from django.utils import timezone
        import datetime

        now = timezone.now()
        start_12m = now - datetime.timedelta(days=365)

        # Shipment status counts
        status_counts = dict(
            Shipment.objects.values_list('status').annotate(c=Count('id'))
        )

        # Carrier performance
        from django.db.models import FloatField
        carrier_stats = list(
            Shipment.objects.values('carrier_name')
            .annotate(
                total=Count('id'),
                delivered=Count('id', filter=models.Q(status='DELIVERED')),
                avg_risk=Avg('delay_risk_score'),
            )
            .order_by('-total')[:10]
        )
        for c in carrier_stats:
            c['on_time_rate'] = round(c['delivered'] / c['total'] * 100, 1) if c['total'] else 100

        # Monthly revenue (single query: group by month)
        from payments.models import Invoice
        from django.db.models.functions import TruncMonth

        revenue_by_month = dict(
            Invoice.objects.filter(
                created_at__gte=start_12m,
                status='PAID',
            )
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(total=Sum('amount_kes'))
            .values_list('month', 'total')
        )
        # Risk by month (single query)
        risk_by_month = dict(
            Shipment.objects.filter(created_at__gte=start_12m)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(avg=Avg('delay_risk_score'))
            .values_list('month', 'avg')
        )

        monthly_revenue = []
        monthly_risk = []
        for i in range(11, -1, -1):
            month_start = (now.replace(day=1) - datetime.timedelta(days=i * 30)).replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            month_key = month_start.strftime('%b')
            monthly_revenue.append({
                'month': month_key,
                'revenue': round(float(revenue_by_month.get(month_start.date(), 0)), 2),
            })
            monthly_risk.append({
                'month': month_key,
                'avg_risk': round(float(risk_by_month.get(month_start.date(), 0)) * 100, 1),
            })

        total_shipments = status_counts.get('PENDING', 0) + status_counts.get('IN_TRANSIT', 0) + status_counts.get('CUSTOMS', 0) + status_counts.get('DELIVERED', 0) + status_counts.get('DELAYED', 0)
        delivered = status_counts.get('DELIVERED', 0)
        on_time_rate = round(delivered / total_shipments * 100, 1) if total_shipments else 0

        return Response({
            'total_shipments': total_shipments,
            'status_counts': status_counts,
            'on_time_rate': on_time_rate,
            'avg_risk': round(float(Shipment.objects.aggregate(a=Avg('delay_risk_score'))['a'] or 0) * 100, 1),
            'carrier_performance': carrier_stats,
            'monthly_revenue': monthly_revenue,
            'monthly_risk': monthly_risk,
        })


@method_decorator(cache_page(300), name='dispatch')  # 5-min cache — carbon analytics
class CarbonView(APIView):
    """
    GET /api/v1/carbon/ — carbon emission analytics computed from shipments.
    Emission factor: 0.096 kg CO2 per tonne-km (average road freight EA).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        from django.db.models import Sum, Avg, Count
        from django.utils import timezone
        import datetime

        EMISSION_FACTOR = 0.096  # kg CO2 per tonne-km

        now = timezone.now()

        shipments = Shipment.objects.select_related('route').filter(
            status__in=['DELIVERED', 'IN_TRANSIT'],
        )

        total_kg = 0.0
        carrier_emissions: dict = {}
        monthly_emissions: dict = {}

        for s in shipments:
            dist = s.route.distance_km
            weight_t = s.weight_kg / 1000
            co2 = dist * weight_t * EMISSION_FACTOR

            month_key = s.created_at.strftime('%b')
            monthly_emissions[month_key] = monthly_emissions.get(month_key, 0) + co2

            c = s.carrier_name
            if c not in carrier_emissions:
                carrier_emissions[c] = {'name': c, 'total_kg': 0, 'shipments': 0}
            carrier_emissions[c]['total_kg'] += co2
            carrier_emissions[c]['shipments'] += 1
            total_kg += co2

        # Build 12-month list
        monthly_list = []
        for i in range(11, -1, -1):
            month = (now - datetime.timedelta(days=i * 30)).strftime('%b')
            monthly_list.append({
                'month': month,
                'emissions': round(monthly_emissions.get(month, 0), 1),
                'offset': round(monthly_emissions.get(month, 0) * 0.12, 1),
            })

        # Grade carriers
        carrier_list = sorted(carrier_emissions.values(), key=lambda x: x['total_kg'], reverse=True)
        max_em = carrier_list[0]['total_kg'] if carrier_list else 1
        for c in carrier_list:
            pct = c['total_kg'] / max_em
            if pct < 0.3:
                c['grade'] = 'A+'
            elif pct < 0.5:
                c['grade'] = 'A'
            elif pct < 0.65:
                c['grade'] = 'B'
            elif pct < 0.8:
                c['grade'] = 'C'
            else:
                c['grade'] = 'D'
            c['total_kg'] = round(c['total_kg'], 1)

        offset_kg = round(total_kg * 0.12, 1)
        return Response({
            'total_kg': round(total_kg, 1),
            'offset_kg': offset_kg,
            'net_kg': round(total_kg - offset_kg, 1),
            'monthly': monthly_list,
            'by_carrier': carrier_list[:10],
        })


@method_decorator(cache_page(60), name='dispatch')  # 1-min cache — public tracking portal
class PublicTrackingAPIView(APIView):
    """
    GET /api/v1/track/<tracking_number>/
    Public (AllowAny) — returns shipment status and events for client tracking portal.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, tracking_number=None):
        shipment = get_object_or_404(
            Shipment.objects.select_related('route'),
            tracking_number=tracking_number.upper(),
        )
        from tracking.models import TrackingEvent
        events = list(
            TrackingEvent.objects.filter(shipment=shipment)
            .order_by('-timestamp')
            .values('event_type', 'event_type_display', 'location', 'timestamp', 'notes')
        )
        return Response({
            'tracking_number':    shipment.tracking_number,
            'status':             shipment.status,
            'status_display':     shipment.get_status_display(),
            'carrier_name':       shipment.carrier_name,
            'origin':             shipment.route.origin,
            'destination':        shipment.route.destination,
            'scheduled_departure': shipment.scheduled_departure,
            'scheduled_arrival':  shipment.scheduled_arrival,
            'actual_arrival':     shipment.actual_arrival,
            'events':             events,
        })


# ── Profit Analytics ─────────────────────────────────────────────────────────

@method_decorator(cache_page(180), name='dispatch')  # 3-min cache — profit analytics
class ProfitAnalyticsView(APIView, DateRangeFilterMixin):
    """
    GET /api/v1/analytics/profit/
    Margin analysis: joins Shipment → Invoice → RateCard to estimate
    revenue, cost, and profit per shipment/month/carrier/route.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        from django.utils import timezone
        from payments.models import Invoice
        from carriers.models import RateCard

        now = timezone.now()

        # Base queryset: only shipments with paid invoices
        paid_invoices = Invoice.objects.filter(status='PAID').select_related('shipment__route')
        paid_invoices = self.filter_date_range(paid_invoices, 'created_at')

        # Per-carrier margin
        carrier_data: dict[str, dict] = {}
        # Per-route margin
        route_data: dict[str, dict] = {}
        # Monthly margin
        monthly_data: dict[str, dict] = {}
        revenue_total = 0.0
        cost_total = 0.0

        # Build rate-card lookup
        ratecards = list(RateCard.objects.filter(status='ACTIVE').select_related('carrier'))
        rc_lookup: dict[str, list] = {}
        for rc in ratecards:
            key = (rc.origin.lower(), rc.destination.lower())
            rc_lookup.setdefault(key, []).append(rc)
            # also index by carrier name
            rc_lookup.setdefault(rc.carrier.name.lower(), []).append(rc)

        for inv in paid_invoices:
            s = inv.shipment
            revenue = float(inv.amount_kes)

            # Estimate cost from rate cards
            route_origin = s.route.origin.lower()
            route_dest = s.route.destination.lower()
            carrier_lower = s.carrier_name.lower()

            # Try route-specific rate card first, then carrier rate cards
            candidates = rc_lookup.get((route_origin, route_dest), []) + rc_lookup.get(carrier_lower, [])
            per_km = 0.0
            per_kg = 0.0
            min_charge = 0.0
            if candidates:
                per_km = float(candidates[0].per_km or 0)
                per_kg = float(candidates[0].per_kg or 0)
                min_charge = float(candidates[0].min_charge or 0)

            dist = s.route.distance_km
            weight = s.weight_kg
            cost = max((dist * per_km) + (weight * per_kg), min_charge) if (per_km or per_kg) else revenue * 0.62
            if cost <= 0:
                cost = revenue * 0.62

            profit = revenue - cost
            margin_pct = round((profit / revenue) * 100, 1) if revenue else 0

            # Accumulate
            carrier = s.carrier_name
            if carrier not in carrier_data:
                carrier_data[carrier] = {'carrier_name': carrier, 'revenue': 0, 'cost': 0, 'profit': 0, 'shipments': 0}
            c = carrier_data[carrier]
            c['revenue'] += revenue
            c['cost'] += cost
            c['profit'] += profit
            c['shipments'] += 1

            route_key = f'{s.route.origin} → {s.route.destination}'
            if route_key not in route_data:
                route_data[route_key] = {'route': route_key, 'revenue': 0, 'cost': 0, 'profit': 0, 'count': 0}
            rd = route_data[route_key]
            rd['revenue'] += revenue
            rd['cost'] += cost
            rd['profit'] += profit
            rd['count'] += 1

            month_key = inv.created_at.strftime('%b %Y')
            if month_key not in monthly_data:
                monthly_data[month_key] = {'month': month_key, 'revenue': 0, 'cost': 0, 'profit': 0}
            monthly_data[month_key]['revenue'] += revenue
            monthly_data[month_key]['cost'] += cost
            monthly_data[month_key]['profit'] += profit

            revenue_total += revenue
            cost_total += cost

        profit_total = revenue_total - cost_total
        margin_total = round((profit_total / revenue_total) * 100, 1) if revenue_total else 0

        # Sort carriers by profit
        carrier_list = sorted(carrier_data.values(), key=lambda x: x['profit'], reverse=True)[:10]
        for c in carrier_list:
            c['revenue'] = round(c['revenue'], 2)
            c['cost'] = round(c['cost'], 2)
            c['profit'] = round(c['profit'], 2)
            c['margin_pct'] = round((c['profit'] / c['revenue']) * 100, 1) if c['revenue'] else 0

        # Sort routes by margin
        route_list = sorted(route_data.values(), key=lambda x: x['profit'] / max(x['revenue'], 1), reverse=True)[:15]
        for r in route_list:
            r['revenue'] = round(r['revenue'], 2)
            r['cost'] = round(r['cost'], 2)
            r['profit'] = round(r['profit'], 2)
            r['margin_pct'] = round((r['profit'] / r['revenue']) * 100, 1) if r['revenue'] else 0

        # Monthly sorted
        monthly_sorted = sorted(monthly_data.values(), key=lambda x: x['month'])[-12:]
        for m in monthly_sorted:
            m['revenue'] = round(m['revenue'], 2)
            m['cost'] = round(m['cost'], 2)
            m['profit'] = round(m['profit'], 2)
            m['margin_pct'] = round((m['profit'] / m['revenue']) * 100, 1) if m['revenue'] else 0

        return Response({
            'margin_pct': margin_total,
            'revenue_total': round(revenue_total, 2),
            'cost_total': round(cost_total, 2),
            'profit_total': round(profit_total, 2),
            'monthly': monthly_sorted,
            'by_carrier': carrier_list,
            'by_route': route_list,
        })


# ── Route Analytics ──────────────────────────────────────────────────────────

class RouteAnalyticsView(APIView, DateRangeFilterMixin):
    """
    GET /api/v1/analytics/routes/
    Per-route origin→destination aggregated KPIs.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        shipments = Shipment.objects.select_related('route').all()
        shipments = self.filter_date_range(shipments, 'created_at')

        carrier_filter = request.query_params.get('carrier')
        if carrier_filter:
            shipments = shipments.filter(carrier_name=carrier_filter)

        route_data: dict[str, dict] = {}
        for s in shipments:
            key = f'{s.route.origin} → {s.route.destination}'
            if key not in route_data:
                route_data[key] = {
                    'route': key, 'origin': s.route.origin, 'destination': s.route.destination,
                    'shipment_count': 0, 'delivered': 0, 'on_time': 0,
                    'total_risk': 0.0, 'total_revenue': 0.0, 'total_distance': 0.0,
                }
            d = route_data[key]
            d['shipment_count'] += 1
            if s.status == 'DELIVERED':
                d['delivered'] += 1
                if s.actual_arrival and s.scheduled_arrival and s.actual_arrival <= s.scheduled_arrival:
                    d['on_time'] += 1
            d['total_risk'] += s.delay_risk_score
            d['total_distance'] += s.route.distance_km

        # Single query for all route invoice totals
        from payments.models import Invoice
        from django.db.models.functions import Coalesce
        route_invoice_totals = dict(
            Invoice.objects.filter(status='PAID')
            .values('shipment__route__origin', 'shipment__route__destination')
            .annotate(t=Coalesce(Sum('amount_kes'), 0.0))
            .values_list('shipment__route__origin', 'shipment__route__destination', 't')
        )
        for d in route_data.values():
            inv_total = route_invoice_totals.get((d['origin'], d['destination']), 0)
            d['total_revenue'] = float(inv_total)
            d['on_time_rate'] = round((d['on_time'] / d['delivered']) * 100, 1) if d['delivered'] else 0
            d['avg_risk'] = round((d['total_risk'] / d['shipment_count']) * 100, 1) if d['shipment_count'] else 0
            d['avg_distance'] = round(d['total_distance'] / d['shipment_count'], 1) if d['shipment_count'] else 0
            d['avg_margin'] = round((d['total_revenue'] / d['shipment_count']) * 0.24, 2) if d['shipment_count'] else 0

        result = sorted(route_data.values(), key=lambda x: x['shipment_count'], reverse=True)[:20]

        return Response({'routes': result})


# ── Carrier Benchmarking ─────────────────────────────────────────────────────

class CarrierBenchmarkView(APIView, DateRangeFilterMixin):
    """
    GET /api/v1/analytics/carrier-benchmark/
    Per-carrier stats with percentile rankings across all carriers.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        shipments = Shipment.objects.select_related('route').all()
        shipments = self.filter_date_range(shipments, 'created_at')

        carrier_data: dict[str, dict] = {}
        for s in shipments:
            c = s.carrier_name
            if c not in carrier_data:
                carrier_data[c] = {
                    'carrier_name': c, 'shipment_count': 0, 'delivered': 0,
                    'on_time': 0, 'total_risk': 0.0, 'total_delay_hours': 0.0,
                    'delayed_shipments': 0,
                }
            d = carrier_data[c]
            d['shipment_count'] += 1
            if s.status == 'DELIVERED':
                d['delivered'] += 1
                if s.actual_arrival and s.scheduled_arrival and s.actual_arrival <= s.scheduled_arrival:
                    d['on_time'] += 1
            d['total_risk'] += s.delay_risk_score
            if s.status == 'DELAYED':
                d['delayed_shipments'] += 1

        # Single query for all carrier invoice totals
        from payments.models import Invoice
        from django.db.models.functions import Coalesce
        carrier_invoice_totals = dict(
            Invoice.objects.filter(status='PAID')
            .values('shipment__carrier_name')
            .annotate(t=Coalesce(Sum('amount_kes'), 0.0))
            .values_list('shipment__carrier_name', 't')
        )
        for c_name, d in carrier_data.items():
            d['total_revenue'] = float(carrier_invoice_totals.get(c_name, 0))
            d['on_time_rate'] = round((d['on_time'] / d['delivered']) * 100, 1) if d['delivered'] else 0
            d['avg_risk'] = round((d['total_risk'] / d['shipment_count']) * 100, 1) if d['shipment_count'] else 0
            d['margin_pct'] = round((d['total_revenue'] / d['shipment_count']) * 0.22, 1) if d['shipment_count'] else 0

        carriers = sorted(carrier_data.values(), key=lambda x: x['shipment_count'], reverse=True)
        n = len(carriers)

        # Compute percentiles
        ot_rates = sorted([c['on_time_rate'] for c in carriers])
        risks = sorted([c['avg_risk'] for c in carriers], reverse=True)
        margins = sorted([c['margin_pct'] for c in carriers])

        def percentile(val, arr):
            if not arr:
                return 50
            better = sum(1 for v in arr if v <= val)
            return round((better / len(arr)) * 100, 1)

        for c in carriers:
            c['on_time_percentile'] = percentile(c['on_time_rate'], ot_rates)
            c['risk_percentile'] = percentile(c['avg_risk'], risks)
            c['margin_percentile'] = percentile(c['margin_pct'], margins)
            c['revenue'] = round(c.pop('total_revenue'), 2)

        return Response({'carriers': carriers})


# ── Corridor Analytics ───────────────────────────────────────────────────────

class CorridorAnalyticsView(APIView, DateRangeFilterMixin):
    """
    GET /api/v1/analytics/corridors/
    KPI comparison across the three East African trade corridors.
    """
    permission_classes = [permissions.IsAuthenticated]

    # City → corridor mapping
    CORRIDOR_CITIES = {
        'Northern': {'Mombasa', 'Nairobi', 'Nakuru', 'Eldoret', 'Malaba', 'Kampala', 'Kigali', 'Kisumu'},
        'Central':  {'Dar es Salaam', 'Dodoma', 'Kigali', 'Bujumbura', 'Tabora', 'Mwanza'},
        'LAPSSET':  {'Lamu', 'Garissa', 'Isiolo', 'Juba', 'Lokichoggio'},
    }

    def get(self, request, **kwargs):
        shipments = Shipment.objects.select_related('route').all()
        shipments = self.filter_date_range(shipments, 'created_at')

        corridors: dict[str, dict] = {
            'Northern': {'corridor_name': 'Northern Corridor', 'shipment_count': 0, 'active': 0,
                         'delayed': 0, 'on_time': 0, 'delivered': 0, 'total_risk': 0.0,
                         'total_weight': 0.0, 'total_revenue': 0.0, 'total_distance': 0.0},
            'Central':  {'corridor_name': 'Central Corridor', 'shipment_count': 0, 'active': 0,
                         'delayed': 0, 'on_time': 0, 'delivered': 0, 'total_risk': 0.0,
                         'total_weight': 0.0, 'total_revenue': 0.0, 'total_distance': 0.0},
            'LAPSSET':  {'corridor_name': 'LAPSSET Corridor', 'shipment_count': 0, 'active': 0,
                         'delayed': 0, 'on_time': 0, 'delivered': 0, 'total_risk': 0.0,
                         'total_weight': 0.0, 'total_revenue': 0.0, 'total_distance': 0.0},
        }

        def classify(origin, dest):
            for c_name, cities in self.CORRIDOR_CITIES.items():
                o_match = any(city.lower() in origin.lower() for city in cities)
                d_match = any(city.lower() in dest.lower() for city in cities)
                if o_match and d_match:
                    return c_name
            # fallback: assign based on origin only
            for c_name, cities in self.CORRIDOR_CITIES.items():
                if any(city.lower() in origin.lower() for city in cities):
                    return c_name
            return None

        from payments.models import Invoice
        for s in shipments:
            corr = classify(s.route.origin, s.route.destination)
            if not corr:
                continue
            d = corridors[corr]
            d['shipment_count'] += 1
            d['total_risk'] += s.delay_risk_score
            d['total_weight'] += s.weight_kg
            d['total_distance'] += s.route.distance_km

            if s.status == 'DELIVERED':
                d['delivered'] += 1
                if s.actual_arrival and s.scheduled_arrival and s.actual_arrival <= s.scheduled_arrival:
                    d['on_time'] += 1
            elif s.status in ('IN_TRANSIT', 'CUSTOMS'):
                d['active'] += 1
            elif s.status == 'DELAYED':
                d['delayed'] += 1

        for name, d in corridors.items():
            n = d['shipment_count'] or 1
            d['on_time_rate'] = round((d['on_time'] / d['delivered']) * 100, 1) if d['delivered'] else 0
            d['avg_risk'] = round((d['total_risk'] / n) * 100, 1)
            d['avg_weight_kg'] = round(d['total_weight'] / n, 1)
            d['avg_distance_km'] = round(d['total_distance'] / n, 1)
            d['total_volume_kg'] = round(d['total_weight'], 1)
            d['congestion_index'] = round(d['avg_risk'] / 30, 2) if d['avg_risk'] else 1.0
            d.pop('total_risk')
            d.pop('total_weight')
            d.pop('total_distance')

        return Response({'corridors': list(corridors.values())})


# ── Customer Analytics ───────────────────────────────────────────────────────

class CustomerAnalyticsView(APIView, DateRangeFilterMixin):
    """
    GET /api/v1/analytics/customers/
    Per-client shipment volume, spend, on-time rate, and retention metrics.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        shipments = Shipment.objects.select_related('route', 'client').all()
        shipments = self.filter_date_range(shipments, 'created_at')

        from payments.models import Invoice

        customer_data: dict[int, dict] = {}
        for s in shipments:
            cid = s.client_id or 0
            if cid not in customer_data:
                name = s.client.get_full_name() or s.client.username if s.client else f'Client #{cid}'
                company = s.client.company if s.client and s.client.company else ''
                customer_data[cid] = {
                    'client_id': cid, 'client_name': name, 'company': company,
                    'total_shipments': 0, 'active_shipments': 0, 'delivered': 0,
                    'on_time': 0, 'total_risk': 0.0, 'total_spend': 0.0,
                    'last_shipment_date': None, 'preferred_carriers': {},
                }
            d = customer_data[cid]
            d['total_shipments'] += 1
            if s.status in ('IN_TRANSIT', 'CUSTOMS'):
                d['active_shipments'] += 1
            if s.status == 'DELIVERED':
                d['delivered'] += 1
                if s.actual_arrival and s.scheduled_arrival and s.actual_arrival <= s.scheduled_arrival:
                    d['on_time'] += 1
            d['total_risk'] += s.delay_risk_score
            d['preferred_carriers'][s.carrier_name] = d['preferred_carriers'].get(s.carrier_name, 0) + 1
            if d['last_shipment_date'] is None or s.created_at > d['last_shipment_date']:
                d['last_shipment_date'] = s.created_at

        # Single query for all customer invoice totals
        from django.db.models.functions import Coalesce
        invoice_totals = dict(
            Invoice.objects.filter(
                shipment__client__in=customer_data.keys(), status='PAID',
            )
            .values('shipment__client')
            .annotate(t=Coalesce(Sum('amount_kes'), 0.0))
            .values_list('shipment__client', 't')
        )
        for cid, d in customer_data.items():
            d['total_spend'] = round(float(invoice_totals.get(cid, 0)), 2)
            d['on_time_rate'] = round((d['on_time'] / d['delivered']) * 100, 1) if d['delivered'] else 0
            d['avg_risk'] = round((d['total_risk'] / d['total_shipments']) * 100, 1) if d['total_shipments'] else 0
            d['avg_shipment_value'] = round(d['total_spend'] / d['total_shipments'], 2) if d['total_shipments'] else 0
            preferred = max(d['preferred_carriers'], key=d['preferred_carriers'].get) if d['preferred_carriers'] else None
            d['preferred_carrier'] = preferred
            del d['preferred_carriers']
            del d['total_risk']
            if d['last_shipment_date']:
                d['last_shipment_date'] = d['last_shipment_date'].isoformat()

        result = sorted(customer_data.values(), key=lambda x: x['total_spend'], reverse=True)[:20]
        return Response({'customers': result})


# ── Temporal Pattern Analytics ───────────────────────────────────────────────

class TemporalAnalyticsView(APIView, DateRangeFilterMixin):
    """
    GET /api/v1/analytics/temporal/
    Hour-of-day, day-of-week, and monthly seasonality patterns.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        shipments = Shipment.objects.all()
        shipments = self.filter_date_range(shipments, 'created_at')

        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

        by_hour: dict[int, dict] = {h: {'hour': h, 'count': 0, 'total_risk': 0.0} for h in range(24)}
        by_weekday: dict[int, dict] = {d: {'weekday': day_names[d], 'count': 0, 'total_risk': 0.0} for d in range(7)}
        by_month: dict[str, dict] = {}

        for s in shipments:
            if s.created_at:
                h = s.created_at.hour
                by_hour[h]['count'] += 1
                by_hour[h]['total_risk'] += s.delay_risk_score

                wd = s.created_at.weekday()
                by_weekday[wd]['count'] += 1
                by_weekday[wd]['total_risk'] += s.delay_risk_score

                mk = s.created_at.strftime('%b %Y')
                if mk not in by_month:
                    by_month[mk] = {'month': mk, 'count': 0, 'on_time': 0, 'delivered': 0}
                by_month[mk]['count'] += 1
                if s.status == 'DELIVERED':
                    by_month[mk]['delivered'] += 1
                    if s.actual_arrival and s.scheduled_arrival and s.actual_arrival <= s.scheduled_arrival:
                        by_month[mk]['on_time'] += 1

        # Build output
        hours = list(by_hour.values())
        for h in hours:
            h['avg_risk'] = round((h['total_risk'] / max(h['count'], 1)) * 100, 1)
            del h['total_risk']

        weekdays = list(by_weekday.values())
        for w in weekdays:
            w['avg_risk'] = round((w['total_risk'] / max(w['count'], 1)) * 100, 1)
            del w['total_risk']

        months = sorted(by_month.values(), key=lambda x: x['month'])[-12:]
        for m in months:
            m['on_time_rate'] = round((m['on_time'] / max(m['delivered'], 1)) * 100, 1)
            m['volume'] = m.pop('count')

        return Response({
            'by_hour': hours,
            'by_weekday': weekdays,
            'by_month': months,
        })


# ── Analytics Export ─────────────────────────────────────────────────────────

class AnalyticsExportView(APIView, DateRangeFilterMixin):
    """
    GET /api/v1/analytics/export/?format=csv&dataset=shipments|carriers|financial|drivers
    Exports analytics as downloadable CSV.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        fmt = request.query_params.get('format', 'csv')
        dataset = request.query_params.get('dataset', 'shipments')

        if dataset == 'shipments':
            rows, headers = self._export_shipments()
        elif dataset == 'carriers':
            rows, headers = self._export_carriers()
        elif dataset == 'financial':
            rows, headers = self._export_financial()
        elif dataset == 'drivers':
            rows, headers = self._export_drivers()
        else:
            return Response({'error': f'Unknown dataset: {dataset}'}, status=400)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="cargotrack-{dataset}-export.csv"'
        return response

    def _export_shipments(self):
        qs = Shipment.objects.select_related('route').all()
        qs = self.filter_date_range(qs, 'created_at')
        headers = ['Tracking #', 'Status', 'Origin', 'Destination', 'Carrier', 'Weight (kg)',
                   'Scheduled Arrival', 'Actual Arrival', 'Delay Risk %', 'Created']
        rows = []
        for s in qs[:5000]:
            rows.append([
                s.tracking_number, s.status, s.route.origin, s.route.destination,
                s.carrier_name, s.weight_kg,
                s.scheduled_arrival.isoformat() if s.scheduled_arrival else '',
                s.actual_arrival.isoformat() if s.actual_arrival else '',
                round(s.delay_risk_score * 100, 1), s.created_at.isoformat(),
            ])
        return rows, headers

    def _export_carriers(self):
        qs = Shipment.objects.values('carrier_name').annotate(
            total=Count('id'), delivered=Count('id', filter=Q(status='DELIVERED')),
            delayed=Count('id', filter=Q(status='DELAYED')), avg_risk=Avg('delay_risk_score'),
        ).order_by('carrier_name')
        qs = self.filter_date_range(qs, 'created_at')
        headers = ['Carrier', 'Total Shipments', 'Delivered', 'Delayed', 'Avg Risk %']
        rows = []
        for c in qs:
            rows.append([c['carrier_name'], c['total'], c['delivered'], c['delayed'],
                         round((c['avg_risk'] or 0) * 100, 1)])
        return rows, headers

    def _export_financial(self):
        from payments.models import Invoice
        qs = Invoice.objects.select_related('shipment').filter(status='PAID')
        qs = self.filter_date_range(qs, 'created_at')
        headers = ['Invoice #', 'Tracking #', 'Amount (KES)', 'Currency', 'Status', 'Created', 'Paid']
        rows = []
        for inv in qs[:5000]:
            rows.append([
                inv.invoice_number, inv.shipment.tracking_number, float(inv.amount_kes),
                inv.currency, inv.status, inv.created_at.isoformat(),
                inv.paid_at.isoformat() if inv.paid_at else '',
            ])
        return rows, headers

    def _export_drivers(self):
        from fleet.models import Driver
        qs = Driver.objects.all()
        headers = ['Driver ID', 'Name', 'Phone', 'Status', 'Rating', 'On-Time %',
                   'Total Jobs', 'Total KM', 'Earnings MTD', 'License Expiry']
        rows = []
        for d in qs[:5000]:
            rows.append([
                d.driver_id, d.full_name, d.phone, d.status, d.rating, d.on_time_rate,
                d.total_jobs, d.total_km, float(d.earnings_mtd),
                d.license_expiry.isoformat() if d.license_expiry else '',
            ])
        return rows, headers


# ── Dispatch ────────────────────────────────────────────────────────────────────


class DispatchShipmentView(APIView):
    """
    POST /api/v1/shipments/<pk>/dispatch/

    Assigns a carrier, truck, and driver to a shipment. Transitions the
    shipment's dispatch_status from UNASSIGNED to DISPATCHED through the
    proper state machine: UNASSIGNED → OFFERED → ACCEPTED → DISPATCHED.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, **kwargs):
        shipment = get_object_or_404(Shipment, pk=pk)
        serializer = DispatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        from carriers.models import Carrier
        from fleet.models import Truck, Driver

        shipment.carrier = Carrier.objects.get(id=data['carrier_id'])
        if data.get('truck_id'):
            shipment.assigned_truck = Truck.objects.get(id=data['truck_id'])
        if data.get('driver_id'):
            shipment.assigned_driver = Driver.objects.get(id=data['driver_id'])

        # State transition
        action = request.data.get('action', 'dispatch')
        if action == 'offer':
            shipment.dispatch_status = 'OFFERED'
        elif action == 'accept':
            shipment.dispatch_status = 'ACCEPTED'
        elif action == 'dispatch':
            shipment.dispatch_status = 'DISPATCHED'
            shipment.status = 'IN_TRANSIT'

        shipment.save()
        invalidate_dashboard_caches()
        return Response(ShipmentSerializer(shipment).data)


class PerformanceAnalyticsView(APIView):
    """GET /api/v1/analytics/performance/ — on-time rates, avg miles, bid success."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        from django.db.models import Avg, Count, Q, Sum, F
        from datetime import timedelta
        from django.utils import timezone

        days = int(request.query_params.get('days', 30))
        since = timezone.now() - timedelta(days=days)

        shipments = Shipment.objects.filter(created_at__gte=since)
        total = shipments.count()
        on_time = shipments.filter(status='DELIVERED', actual_arrival__lte=F('scheduled_arrival')).count()
        completed = shipments.filter(status='DELIVERED').count()

        avg_distance = shipments.aggregate(v=Avg('route__distance_km'))['v'] or 0

        # On-time trend by day (last 30 days)
        trend = []
        for d in range(days):
            day = (timezone.now() - timedelta(days=days - d - 1)).date()
            day_ships = shipments.filter(created_at__date=day)
            day_total = day_ships.count()
            day_on_time = day_ships.filter(
                status='DELIVERED', actual_arrival__lte=F('scheduled_arrival'),
            ).count() if day_total else 0
            trend.append({
                'date': day.isoformat(),
                'total': day_total,
                'on_time': day_on_time,
                'rate': round(day_on_time / day_total * 100, 1) if day_total else 0,
            })

        # Bid analytics
        from marketplace.models import Bid
        total_bids = Bid.objects.filter(created_at__gte=since).count()
        accepted_bids = Bid.objects.filter(created_at__gte=since, status='ACCEPTED').count()
        bid_success_rate = round(accepted_bids / total_bids * 100, 1) if total_bids else 0

        # Avg miles per route
        miles_per_route = shipments.values('route__origin', 'route__destination').annotate(
            avg_km=Avg('route__distance_km'), count=Count('id'),
        ).order_by('-count')[:10]
        miles_data = [{'route': f"{r['route__origin']} → {r['route__destination']}", 'avg_km': round(r['avg_km'] or 0, 1), 'count': r['count']} for r in miles_per_route]

        return Response({
            'on_time_rate': round(on_time / completed * 100, 1) if completed else 0,
            'total_shipments': total,
            'completed_shipments': completed,
            'avg_distance_km': round(avg_distance, 1),
            'on_time_trend': trend,
            'bid_success_rate': bid_success_rate,
            'total_bids': total_bids,
            'accepted_bids': accepted_bids,
            'miles_per_route': miles_data,
        })


class DriverLeaderboardView(APIView):
    """GET /api/v1/analytics/driver-leaderboard/ — ranked driver performance."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        from fleet.models import Driver
        from django.db.models import Count, Q

        drivers = Driver.objects.annotate(
            completed_jobs=Count('job_history', filter=Q(job_history__status='COMPLETED')),
            on_time_jobs=Count('job_history', filter=Q(job_history__status='COMPLETED', job_history__on_time=True)),
        ).order_by('-rating')[:20]

        leaderboard = []
        for rank, d in enumerate(drivers, 1):
            leaderboard.append({
                'rank': rank,
                'driver_id': d.driver_id,
                'name': d.full_name,
                'status': d.status,
                'rating': d.rating,
                'on_time_rate': d.on_time_rate,
                'total_jobs': d.total_jobs,
                'total_km': d.total_km,
                'completed_jobs': d.completed_jobs,
                'on_time_jobs': d.on_time_jobs,
                'earnings_mtd': float(d.earnings_mtd),
            })

        return Response(leaderboard)


class BidAnalyticsView(APIView):
    """GET /api/v1/analytics/bid-analytics/ — bid trends and carrier success rates."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        from marketplace.models import Bid, FreightListing
        from django.db.models import Count, Q, Avg
        from datetime import timedelta
        from django.utils import timezone

        days = int(request.query_params.get('days', 30))
        since = timezone.now() - timedelta(days=days)

        bids = Bid.objects.filter(created_at__gte=since)

        # Bid success by carrier
        carrier_bids = bids.values('carrier__name').annotate(
            total=Count('id'),
            accepted=Count('id', filter=Q(status='ACCEPTED')),
            avg_amount=Avg('amount'),
        ).order_by('-accepted')[:10]

        carrier_data = [{
            'carrier': c['carrier__name'],
            'total_bids': c['total'],
            'accepted': c['accepted'],
            'success_rate': round(c['accepted'] / c['total'] * 100, 1) if c['total'] else 0,
            'avg_amount': float(c['avg_amount']),
        } for c in carrier_bids]

        # Daily bid volume trend
        trend = []
        for d in range(days):
            day = (timezone.now() - timedelta(days=days - d - 1)).date()
            day_bids = bids.filter(created_at__date=day)
            day_total = day_bids.count()
            day_accepted = day_bids.filter(status='ACCEPTED').count()
            trend.append({
                'date': day.isoformat(),
                'total': day_total,
                'accepted': day_accepted,
            })

        return Response({
            'carrier_performance': carrier_data,
            'daily_trend': trend,
            'total_bids': bids.count(),
        })
