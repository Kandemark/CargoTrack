"""
cargotrack/ml/feature_engineer.py

Feature extraction and label-encoding for the CargoTrack delay predictor.

OOP:
    Composition  — FeatureEngineer is composed *inside* DelayPredictor;
                   it is not a subclass of any predictor base.
    Encapsulation — encoder state (_origin_encoder, _dest_encoder) is kept
                    private and only populated through fit().
"""

from __future__ import annotations

import pandas as pd


class FeatureEngineer:
    """
    Extracts and transforms features from Shipment QuerySets for the
    DelayPredictor ML pipeline.

    Composed inside DelayPredictor (composition, not inheritance).

    Typical usage::

        fe = FeatureEngineer()
        X_train = fe.fit_transform(train_qs)   # fit encoders + build DataFrame
        X_test  = fe.transform(test_qs)        # apply already-fitted encoders

    Attributes:
        _origin_encoder (dict): Maps route origin strings to integer codes.
                                Populated by fit(). Unseen values map to 0.
        _dest_encoder   (dict): Same for route destinations.
    """

    FEATURE_COLUMNS = [
        'distance_km',
        'estimated_hours',
        'weight_kg',
        'hour_of_departure',
        'day_of_week',
        'month',
        'route_origin_encoded',
        'route_destination_encoded',
        'num_tracking_events',
        'has_customs_stop',
    ]

    def __init__(self) -> None:
        self._origin_encoder: dict[str, int] = {}
        self._dest_encoder:   dict[str, int] = {}

    @staticmethod
    def _prepare_shipments(shipments_qs):
        """
        Return a concrete shipment list from a QuerySet or iterable input.
        """
        if hasattr(shipments_qs, 'select_related'):
            return list(shipments_qs.select_related('route'))
        return list(shipments_qs)

    # ── public interface ──────────────────────────────────────────────────────

    def fit(self, shipments_qs) -> 'FeatureEngineer':
        """
        Fit label encoders on the route origins and destinations found in
        *shipments_qs*.

        Integer codes are assigned in the order values are first seen,
        starting from 1.  Code 0 is reserved for unseen values at transform
        time so the predictor never receives an out-of-vocabulary key.

        Args:
            shipments_qs: Django QuerySet of Shipment objects (may be
                          evaluated lazily — fit() calls select_related once).

        Returns:
            self, so fit() can be chained: ``fe.fit(qs).transform(qs)``.
        """
        origins      = set()
        destinations = set()

        for shipment in self._prepare_shipments(shipments_qs):
            origins.add(shipment.route.origin)
            destinations.add(shipment.route.destination)

        # Assign codes 1..N in sorted order for deterministic behaviour
        self._origin_encoder = {
            origin: code
            for code, origin in enumerate(sorted(origins), start=1)
        }
        self._dest_encoder = {
            dest: code
            for code, dest in enumerate(sorted(destinations), start=1)
        }

        return self

    def transform(self, shipments_qs) -> pd.DataFrame:
        """
        Build a feature DataFrame from *shipments_qs*.

        Each row corresponds to one Shipment.  The columns are exactly
        ``FEATURE_COLUMNS``:

        ========================  ============================================
        Column                    Source
        ========================  ============================================
        distance_km               shipment.route.distance_km
        estimated_hours           shipment.route.estimated_hours
        weight_kg                 shipment.weight_kg
        hour_of_departure         shipment.scheduled_departure.hour  (0–23)
        day_of_week               scheduled_departure weekday (0=Mon…6=Sun)
        month                     scheduled_departure month (1–12)
        route_origin_encoded      integer from _origin_encoder (0 = unseen)
        route_destination_encoded integer from _dest_encoder   (0 = unseen)
        num_tracking_events       count of related TrackingEvent rows
        has_customs_stop          1 if any event has event_type CUSTOMS_ENTRY
        ========================  ============================================

        Args:
            shipments_qs: Django QuerySet of Shipment objects.

        Returns:
            pd.DataFrame with shape (n_shipments, len(FEATURE_COLUMNS)).
        """
        from tracking.models import TrackingEvent

        # Prefetch tracking events in two bulk queries instead of N+1
        shipment_list = self._prepare_shipments(shipments_qs)
        if not shipment_list:
            return pd.DataFrame(columns=self.FEATURE_COLUMNS)

        shipment_ids = [s.pk for s in shipment_list]

        # Build {shipment_id: count} and {shipment_id: has_customs} maps
        all_events = TrackingEvent.objects.filter(
            shipment_id__in=shipment_ids
        ).values('shipment_id', 'event_type')

        event_counts:   dict[int, int]  = {}
        customs_flags:  dict[int, int]  = {}
        for ev in all_events:
            sid = ev['shipment_id']
            event_counts[sid]  = event_counts.get(sid, 0) + 1
            if ev['event_type'] == 'CUSTOMS_ENTRY':
                customs_flags[sid] = 1

        rows = []
        for shipment in shipment_list:
            dep = shipment.scheduled_departure
            sid = shipment.pk

            rows.append({
                'distance_km':               shipment.route.distance_km,
                'estimated_hours':           shipment.route.estimated_hours,
                'weight_kg':                 shipment.weight_kg,
                'hour_of_departure':         dep.hour,
                'day_of_week':               dep.weekday(),   # 0=Monday
                'month':                     dep.month,
                'route_origin_encoded':      self._origin_encoder.get(
                                                 shipment.route.origin, 0),
                'route_destination_encoded': self._dest_encoder.get(
                                                 shipment.route.destination, 0),
                'num_tracking_events':       event_counts.get(sid, 0),
                'has_customs_stop':          customs_flags.get(sid, 0),
            })

        return pd.DataFrame(rows, columns=self.FEATURE_COLUMNS)

    def fit_transform(self, shipments_qs) -> pd.DataFrame:
        """
        Convenience method: fit encoders then return the transformed DataFrame.

        Equivalent to ``self.fit(shipments_qs).transform(shipments_qs)`` but
        evaluates the queryset only twice (once inside fit, once in transform).

        Args:
            shipments_qs: Django QuerySet of Shipment objects.

        Returns:
            pd.DataFrame with shape (n_shipments, len(FEATURE_COLUMNS)).
        """
        return self.fit(shipments_qs).transform(shipments_qs)
