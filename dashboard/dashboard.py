"""
dashboard/dashboard.py

LogisticsDashboard aggregates KPI data for the dashboard views.

OOP:
    Encapsulation — all QuerySet and aggregation logic lives here so that
                    views remain thin and do nothing but call these methods
                    and return the result. Tests can instantiate
                    LogisticsDashboard directly without an HTTP request.
"""

from django.db import models
from django.db.models import Avg, Count, Q


class LogisticsDashboard:
    """
    Aggregates KPI data for the dashboard view.
    Encapsulates all QuerySet logic so views stay thin.
    """

    def get_summary_stats(self) -> dict:
        """
        Compute fleet-wide summary statistics.

        Returns:
            dict with keys:
                total_shipments      (int)   — all shipments in the system.
                by_status            (dict)  — {status: count} breakdown.
                avg_delay_risk       (float) — mean delay_risk_score, 3 d.p.
                high_risk_count      (int)   — shipments with risk > 0.7.
                unacknowledged_alerts(int)   — open (unacked) Alert records.
                total_revenue_mtd    (float) — paid invoice revenue this month (KES).
                total_cost_mtd       (float) — estimated cost this month (KES).
        """
        from shipments.models import Shipment
        from alerts.models import Alert
        from django.utils import timezone
        from payments.models import Invoice
        from carriers.models import RateCard

        qs = Shipment.objects.all()
        delivered = qs.filter(status='DELIVERED').count()
        delayed = qs.filter(status='DELAYED').count()
        active = qs.exclude(status='DELIVERED').count()
        on_time = qs.filter(
            status='DELIVERED',
            actual_arrival__isnull=False,
            actual_arrival__lte=models.F('scheduled_arrival'),
        ).count()
        on_time_rate = round((on_time / delivered) * 100, 1) if delivered else 100.0
        carrier_count = qs.values('carrier_name').distinct().count()

        # Revenue & cost MTD
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        mtd_invoices = Invoice.objects.filter(status='PAID', created_at__gte=month_start).select_related('shipment__route')
        total_revenue_mtd = float(sum(inv.amount_kes for inv in mtd_invoices))

        ratecards = list(RateCard.objects.filter(status='ACTIVE').select_related('carrier'))
        rc_lookup: dict = {}
        for rc in ratecards:
            key = (rc.origin.lower(), rc.destination.lower())
            rc_lookup.setdefault(key, []).append(rc)
            rc_lookup.setdefault(rc.carrier.name.lower(), []).append(rc)

        total_cost_mtd = 0.0
        for inv in mtd_invoices:
            s = inv.shipment
            origin = s.route.origin.lower()
            dest = s.route.destination.lower()
            carrier_lower = s.carrier_name.lower()
            candidates = rc_lookup.get((origin, dest), []) + rc_lookup.get(carrier_lower, [])
            per_km = per_kg = min_charge = 0.0
            if candidates:
                per_km = float(candidates[0].per_km or 0)
                per_kg = float(candidates[0].per_kg or 0)
                min_charge = float(candidates[0].min_charge or 0)
            dist = s.route.distance_km
            weight = s.weight_kg
            cost = max((dist * per_km) + (weight * per_kg), min_charge) if (per_km or per_kg) else float(inv.amount_kes) * 0.62
            if cost <= 0:
                cost = float(inv.amount_kes) * 0.62
            total_cost_mtd += cost

        return {
            'total_shipments': qs.count(),
            'active_shipments': active,
            'delivered_shipments': delivered,
            'delayed_shipments': delayed,
            'on_time_rate': on_time_rate,
            'exception_count': delayed,
            'carrier_count': carrier_count,
            'open_alerts': Alert.objects.filter(acknowledged=False).count(),
            'by_status': dict(
                qs.values_list('status')
                  .annotate(c=Count('id'))
                  .values_list('status', 'c')
            ),
            'avg_delay_risk': round(
                qs.aggregate(a=Avg('delay_risk_score'))['a'] or 0, 3
            ),
            'high_risk_count': qs.filter(delay_risk_score__gt=0.7).count(),
            'unacknowledged_alerts': Alert.objects.filter(acknowledged=False).count(),
            'total_revenue_mtd': round(total_revenue_mtd, 2),
            'total_cost_mtd': round(total_cost_mtd, 2),
        }

    def get_recent_events(self, limit: int = 10) -> list:
        """
        Return the most recent TrackingEvents as a list of plain dicts.

        Args:
            limit: Maximum number of events to return (default 10).

        Returns:
            list of dicts with keys: shipment__tracking_number, event_type,
            location, timestamp.
        """
        from tracking.models import TrackingEvent

        events = TrackingEvent.objects.select_related('shipment', 'recorded_by').order_by('-timestamp')[:limit]
        return [
            {
                'id': event.id,
                'shipment': event.shipment_id,
                'shipment_tracking': event.shipment.tracking_number,
                'event_type': event.event_type,
                'event_type_display': event.get_event_type_display(),
                'location': event.location,
                'timestamp': event.timestamp,
                'notes': event.notes,
                'recorded_by': event.recorded_by_id,
                'recorded_by_name': (
                    event.recorded_by.get_full_name() or event.recorded_by.username
                    if event.recorded_by else None
                ),
            }
            for event in events
        ]

    def get_carrier_performance(self) -> list:
        """
        Return per-carrier statistics sorted by shipment volume descending.

        on_time_rate is expressed as a float in [0.0, 1.0] — the fraction of
        that carrier's DELIVERED shipments whose actual_arrival was at or
        before scheduled_arrival.

        Returns:
            list of dicts with keys: carrier_name, shipment_count, avg_risk,
            on_time (count of on-time deliveries).
        """
        from shipments.models import Shipment

        return list(
            Shipment.objects
            .values('carrier_name')
            .annotate(
                shipment_count=Count('id'),
                avg_risk=Avg('delay_risk_score'),
                on_time=Count(
                    'id',
                    filter=Q(
                        status='DELIVERED',
                        actual_arrival__lte=models.F('scheduled_arrival'),
                    ),
                ),
            )
            .order_by('-shipment_count')
        )
