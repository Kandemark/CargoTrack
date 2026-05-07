"""
alerts/serializers.py — DRF serializers for the alerts app
===========================================================

Serializers
-----------
AlertSerializer
    Full read serializer for Alert objects; exposes ``acknowledged`` as the
    only writable field so clients can dismiss alerts.  ``acknowledged_by``
    is intentionally excluded to avoid leaking user PII through the API.

AlertAcknowledgeSerializer
    Minimal write-only serializer used by AlertAcknowledgeAPIView; accepts
    only the ``acknowledged`` boolean field.
"""
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
