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
        """
        from shipments.models import Shipment
        from alerts.models import Alert

        qs = Shipment.objects.all()
        return {
            'total_shipments': qs.count(),
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

        return list(
            TrackingEvent.objects
            .select_related('shipment')
            .order_by('-timestamp')[:limit]
            .values(
                'shipment__tracking_number',
                'event_type',
                'location',
                'timestamp',
            )
        )

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
