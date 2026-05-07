"""marketplace/serializers.py — DRF serializers for freight listings and bids."""
from rest_framework import serializers
from .models import FreightListing, Bid


class BidSerializer(serializers.ModelSerializer):
    carrier_name = serializers.CharField(source='carrier.name', read_only=True)
    truck_info = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()

    class Meta:
        model = Bid
        fields = [
            'id', 'listing', 'carrier', 'carrier_name', 'truck', 'truck_info',
            'driver', 'driver_name', 'amount', 'notes', 'status',
            'estimated_days', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'carrier_name', 'truck_info', 'driver_name',
                            'status', 'created_at', 'updated_at']

    def get_truck_info(self, obj):
        if obj.truck:
            return {'id': obj.truck.id, 'fleet_id': obj.truck.fleet_id, 'plate': obj.truck.plate}
        return None

    def get_driver_name(self, obj):
        if obj.driver:
            return obj.driver.full_name
        return None


class BidCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bid
        fields = ['listing', 'amount', 'truck', 'driver', 'notes', 'estimated_days']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Bid amount must be positive.")
        return value


class BidAcceptSerializer(serializers.Serializer):
    """Used by the listing owner to accept a bid."""
    pass  # bid accepted via the URL path, no body needed


class FreightListingSerializer(serializers.ModelSerializer):
    posted_by_name = serializers.CharField(source='posted_by.get_full_name', read_only=True)
    cargo_type_display = serializers.CharField(source='get_cargo_type_display', read_only=True)
    bid_count = serializers.SerializerMethodField()
    bids = BidSerializer(many=True, read_only=True)
    lowest_bid = serializers.SerializerMethodField()

    class Meta:
        model = FreightListing
        fields = [
            'id', 'posted_by', 'posted_by_name', 'cargo_type', 'cargo_type_display',
            'weight_kg', 'volume_m3', 'origin', 'destination',
            'pickup_date', 'delivery_date',
            'budget_min', 'budget_max', 'description',
            'requires_hazmat', 'requires_reefer',
            'status', 'bid_count', 'lowest_bid',
            'bids', 'awarded_shipment',
            'created_at', 'updated_at', 'expires_at',
        ]
        read_only_fields = ['id', 'posted_by', 'posted_by_name', 'cargo_type_display',
                            'status', 'bid_count', 'lowest_bid', 'awarded_shipment',
                            'created_at', 'updated_at']

    def get_bid_count(self, obj):
        return obj.bids.count()

    def get_lowest_bid(self, obj):
        lowest = obj.bids.filter(status='PENDING').order_by('amount').first()
        return float(lowest.amount) if lowest else None


class FreightListingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FreightListing
        fields = [
            'cargo_type', 'weight_kg', 'volume_m3', 'origin', 'destination',
            'pickup_date', 'delivery_date', 'budget_min', 'budget_max',
            'description', 'requires_hazmat', 'requires_reefer', 'expires_at',
        ]

    def validate_weight_kg(self, value):
        if value <= 0:
            raise serializers.ValidationError("Weight must be positive.")
        return value
