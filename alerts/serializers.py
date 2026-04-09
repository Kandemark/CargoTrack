"""alerts/serializers.py"""
from rest_framework import serializers
from .models import Alert


class AlertSerializer(serializers.ModelSerializer):
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    shipment_tracking = serializers.CharField(
        source='shipment.tracking_number', read_only=True
    )

    class Meta:
        model = Alert
        fields = [
            'id',
            'shipment',
            'shipment_tracking',
            'message',
            'risk_score',
            'severity',
            'severity_display',
            'sent_at',
            'acknowledged',
            # acknowledged_by is intentionally excluded — leaks user PII
        ]
        read_only_fields = ['shipment', 'message', 'risk_score', 'severity', 'sent_at']

    def validate_risk_score(self, value):
        if not (0.0 <= value <= 1.0):
            raise serializers.ValidationError("risk_score must be between 0.0 and 1.0.")
        return value


class AlertAcknowledgeSerializer(serializers.ModelSerializer):
    """Write-only serializer for the acknowledge action."""

    class Meta:
        model = Alert
        fields = ['acknowledged']
