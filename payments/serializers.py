"""payments/serializers.py"""
from rest_framework import serializers

from .models import Invoice, Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id', 'provider', 'provider_reference', 'amount',
            'currency', 'status', 'phone_number', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class InvoiceSerializer(serializers.ModelSerializer):
    payments = PaymentSerializer(many=True, read_only=True)
    shipment_tracking = serializers.CharField(source='shipment.tracking_number', read_only=True)
    status_display    = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'shipment', 'shipment_tracking',
            'amount_kes', 'currency', 'status', 'status_display', 'description',
            'created_at', 'paid_at', 'payments',
        ]
        read_only_fields = ['id', 'invoice_number', 'created_at', 'paid_at']


class InvoiceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ['shipment', 'amount_kes', 'currency', 'description']


class PayInitiateSerializer(serializers.Serializer):
    provider     = serializers.ChoiceField(choices=['MPESA', 'AIRTEL', 'MTN', 'FLUTTERWAVE', 'STRIPE', 'PESAPAL'])
    phone_number = serializers.CharField(max_length=20, required=False, default='')
    card_token   = serializers.CharField(required=False, default='')
