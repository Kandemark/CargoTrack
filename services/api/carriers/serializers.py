"""
carriers/serializers.py — DRF serializers for Carrier and RateCard.
"""
from rest_framework import serializers
from .models import Carrier, RateCard


class RateCardSerializer(serializers.ModelSerializer):
    carrier_name = serializers.CharField(source='carrier.name', read_only=True)

    class Meta:
        model = RateCard
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')


class CarrierSerializer(serializers.ModelSerializer):
    rate_cards = RateCardSerializer(many=True, read_only=True)

    class Meta:
        model = Carrier
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')
