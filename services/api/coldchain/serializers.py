"""coldchain/serializers.py"""
from rest_framework import serializers

from .models import (
    ColdChainShipment, TemperatureReading,
    TemperatureExcursion, ColdChainCertificate,
)


class TemperatureReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemperatureReading
        fields = [
            'id', 'device_id', 'timestamp', 'temperature_c',
            'humidity_pct', 'battery_level', 'location_lat', 'location_lng',
            'signal_strength',
        ]
        read_only_fields = ['id']


class TemperatureExcursionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemperatureExcursion
        fields = [
            'id', 'coldchain_shipment', 'started_at', 'resolved_at',
            'duration_minutes', 'peak_temp_c', 'min_temp_c', 'severity',
            'temp_limit_breached', 'acknowledged_by', 'acknowledged_at',
            'resolution_notes', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ColdChainCertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ColdChainCertificate
        fields = [
            'id', 'coldchain_shipment', 'issued_at', 'total_readings',
            'excursions_count', 'total_excursion_minutes',
            'min_temp_recorded_c', 'max_temp_recorded_c', 'avg_temp_c',
            'is_compliant', 'pdf_report',
        ]
        read_only_fields = ['id', 'issued_at']


class ColdChainShipmentSerializer(serializers.ModelSerializer):
    recent_readings = serializers.SerializerMethodField()
    active_excursion = serializers.SerializerMethodField()
    certificate = ColdChainCertificateSerializer(read_only=True)

    class Meta:
        model = ColdChainShipment
        fields = [
            'id', 'shipment', 'product_type', 'temp_min_c', 'temp_max_c',
            'humidity_min_pct', 'humidity_max_pct', 'tolerance_minutes',
            'requires_continuous_monitoring', 'monitoring_device_id',
            'notes', 'recent_readings', 'active_excursion', 'certificate',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_recent_readings(self, obj):
        recent = obj.readings.order_by('-timestamp')[:20]
        return TemperatureReadingSerializer(recent, many=True).data

    def get_active_excursion(self, obj):
        active = obj.excursions.filter(resolved_at__isnull=True).first()
        if active:
            return TemperatureExcursionSerializer(active).data
        return None
