"""pod/serializers.py"""
from rest_framework import serializers

from .models import ProofOfDelivery, PODPhoto, PODDispute


class PODPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PODPhoto
        fields = [
            'id', 'image', 'photo_type', 'caption',
            'taken_at', 'location_lat', 'location_lng',
        ]
        read_only_fields = ['id']


class PODDisputeSerializer(serializers.ModelSerializer):
    raised_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = PODDispute
        fields = [
            'id', 'pod', 'dispute_reason', 'description', 'raised_by',
            'raised_by_name', 'raised_at', 'resolution_status',
            'assigned_to', 'assigned_to_name', 'resolution_notes',
            'resolution_amount', 'resolved_at', 'updated_at',
        ]
        read_only_fields = ['id', 'raised_by', 'raised_at', 'updated_at']

    def get_raised_by_name(self, obj):
        if obj.raised_by:
            return obj.raised_by.get_full_name() or obj.raised_by.username
        return None

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None


class ProofOfDeliverySerializer(serializers.ModelSerializer):
    photos = PODPhotoSerializer(many=True, read_only=True)
    dispute = PODDisputeSerializer(read_only=True)
    verification_url = serializers.SerializerMethodField()
    tracking_number = serializers.SerializerMethodField()

    class Meta:
        model = ProofOfDelivery
        fields = [
            'id', 'shipment', 'tracking_number', 'verification_code',
            'verification_url', 'delivered_at', 'received_by_name',
            'received_by_phone', 'received_by_signature',
            'location_lat', 'location_lng', 'condition',
            'verification_status', 'verified_by', 'verified_at',
            'notes', 'captured_by', 'photos', 'dispute', 'created_at',
        ]
        read_only_fields = [
            'id', 'verification_code', 'verification_url',
            'verification_status', 'verified_by', 'verified_at',
            'captured_by', 'created_at',
        ]

    def get_verification_url(self, obj):
        return obj.generate_qr_url()

    def get_tracking_number(self, obj):
        if obj.shipment_id:
            return obj.shipment.tracking_number
        return None
