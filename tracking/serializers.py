"""tracking/serializers.py — DRF serializers."""
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
