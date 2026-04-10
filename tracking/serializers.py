"""
tracking/serializers.py — DRF serializers for the tracking app
===============================================================

Serializers
-----------
TrackingEventSerializer
    Full read/write serializer for TrackingEvent.  ``recorded_by`` and
    ``timestamp`` are read-only — the view injects recorded_by from
    ``request.user`` and timestamp defaults to ``timezone.now``.

ShipmentEventCreateSerializer
    Inherits TrackingEventSerializer and additionally marks ``shipment``
    read-only so it is not required in the POST body for the nested
    ``/shipments/<pk>/tracking-events/`` endpoint.  The view injects the
    shipment FK from the URL pk.
"""
from rest_framework import serializers
from .models import TrackingEvent

VALID_EVENT_TYPES = {et for et, _ in TrackingEvent.EVENT_TYPES}


class TrackingEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(
        source='get_event_type_display', read_only=True
    )
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TrackingEvent
        fields = [
            'id', 'shipment',
            'event_type', 'event_type_display',
            'location', 'timestamp', 'notes',
            'recorded_by', 'recorded_by_name',
        ]
        read_only_fields = ['id', 'timestamp', 'recorded_by', 'recorded_by_name']

    def get_recorded_by_name(self, obj) -> str | None:
        if obj.recorded_by_id is None:
            return None
        return obj.recorded_by.get_full_name() or obj.recorded_by.username

    def validate_event_type(self, value):
        if value not in VALID_EVENT_TYPES:
            raise serializers.ValidationError(
                f"Invalid event_type '{value}'. "
                f"Must be one of: {', '.join(sorted(VALID_EVENT_TYPES))}."
            )
        return value

    def validate_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("location cannot be blank.")
        return value.strip()


class ShipmentEventCreateSerializer(TrackingEventSerializer):
    """
    Variant used when creating events via POST /api/v1/shipments/<pk>/tracking-events/.

    The shipment FK is injected by the view from the URL pk and must not be
    supplied in the request body. Marking it read-only here excludes it from
    required-field validation while still including it in the response output.
    """

    class Meta(TrackingEventSerializer.Meta):
        read_only_fields = [
            'id', 'shipment', 'timestamp', 'recorded_by', 'recorded_by_name',
        ]
