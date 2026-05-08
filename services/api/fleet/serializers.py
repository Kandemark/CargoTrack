"""
fleet/serializers.py — DRF serializers for Fleet domain.
"""
from rest_framework import serializers
from .models import Driver, DriverJobHistory, DriverExpense, Truck, TruckMaintenanceLog


class DriverExpenseSerializer(serializers.ModelSerializer):
    driver_name = serializers.SerializerMethodField()

    class Meta:
        model = DriverExpense
        fields = [
            'id', 'driver', 'driver_name', 'shipment', 'expense_type',
            'amount', 'currency', 'receipt_image', 'description',
            'location', 'latitude', 'longitude', 'reimbursed',
            'reimbursed_at', 'captured_at', 'synced_at',
        ]
        read_only_fields = ('id', 'driver_name', 'synced_at', 'reimbursed', 'reimbursed_at')

    def get_driver_name(self, obj):
        return obj.driver.full_name if obj.driver_id else None


class TruckMaintenanceLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TruckMaintenanceLog
        fields = '__all__'
        read_only_fields = ('created_at',)


class TruckSerializer(serializers.ModelSerializer):
    assigned_driver_name = serializers.SerializerMethodField()
    driver_phone         = serializers.SerializerMethodField()
    maintenance_logs = TruckMaintenanceLogSerializer(many=True, read_only=True)
    total_miles_driven   = serializers.SerializerMethodField()
    hours_in_operation   = serializers.SerializerMethodField()
    fleet_utilisation    = serializers.SerializerMethodField()
    current_load_description = serializers.SerializerMethodField()

    class Meta:
        model = Truck
        fields = [
            'id', 'fleet_id', 'make', 'model', 'year', 'plate', 'vin', 'color',
            'payload_tonnes', 'engine_cc', 'fuel_type', 'fuel_capacity_l',
            'status', 'odometer_km', 'load_pct',
            'current_location', 'latitude', 'longitude',
            'last_service_date', 'next_service_date', 'next_service_km',
            'assigned_driver', 'assigned_driver_name', 'driver_phone',
            'maintenance_logs',
            'total_miles_driven', 'hours_in_operation',
            'fleet_utilisation', 'current_load_description',
            'created_at', 'updated_at',
        ]
        read_only_fields = ('created_at', 'updated_at', 'assigned_driver_name')

    def get_assigned_driver_name(self, obj):
        if obj.assigned_driver:
            return obj.assigned_driver.full_name
        return None

    def get_driver_phone(self, obj):
        if obj.assigned_driver:
            return obj.assigned_driver.phone
        return None

    def get_total_miles_driven(self, obj):
        return round(obj.odometer_km * 0.621371, 1)  # km to miles

    def get_hours_in_operation(self, obj):
        from django.db.models import Sum
        from .models import DriverJobHistory
        total = DriverJobHistory.objects.filter(
            driver__assigned_truck=obj,
        ).aggregate(total_km=Sum('distance_km'))
        km = total['total_km'] or obj.odometer_km
        return round(km / 50, 1)  # rough estimate: 50km/h avg

    def get_fleet_utilisation(self, obj):
        if obj.status == 'ACTIVE':
            return round(obj.load_pct / 100, 2)
        return 0.0

    def get_current_load_description(self, obj):
        if obj.status == 'ACTIVE' and obj.load_pct > 0:
            return f'{obj.load_pct:.0f}% loaded — {obj.payload_tonnes} t capacity'
        return 'Empty / No active load'


class TruckListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — omits nested logs."""
    assigned_driver_name = serializers.SerializerMethodField()

    class Meta:
        model = Truck
        fields = [
            'id', 'fleet_id', 'make', 'model', 'year', 'plate',
            'status', 'odometer_km', 'load_pct', 'current_location',
            'last_service_date', 'next_service_date',
            'assigned_driver', 'assigned_driver_name',
        ]

    def get_assigned_driver_name(self, obj):
        if obj.assigned_driver:
            return obj.assigned_driver.full_name
        return None


class DriverJobHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverJobHistory
        fields = '__all__'
        read_only_fields = ('created_at',)


class DriverSerializer(serializers.ModelSerializer):
    full_name    = serializers.ReadOnlyField()
    job_history  = DriverJobHistorySerializer(many=True, read_only=True)
    truck_info   = serializers.SerializerMethodField()

    class Meta:
        model = Driver
        fields = [
            'id', 'driver_id', 'first_name', 'last_name', 'full_name',
            'phone', 'email', 'avatar_url',
            'license_number', 'license_class', 'license_expiry',
            'status', 'date_joined', 'years_experience',
            'rating', 'on_time_rate', 'total_jobs', 'total_km', 'earnings_mtd',
            'active_route', 'current_location', 'latitude', 'longitude',
            'certifications', 'job_history', 'truck_info',
            'created_at', 'updated_at',
        ]
        read_only_fields = ('created_at', 'updated_at', 'full_name')

    def get_truck_info(self, obj):
        truck = getattr(obj, 'assigned_truck', None)
        if truck:
            return {'id': truck.id, 'fleet_id': truck.fleet_id, 'plate': truck.plate}
        return None


class DriverListSerializer(serializers.ModelSerializer):
    full_name  = serializers.ReadOnlyField()
    truck_info = serializers.SerializerMethodField()

    class Meta:
        model = Driver
        fields = [
            'id', 'driver_id', 'full_name', 'phone', 'email', 'avatar_url',
            'status', 'rating', 'on_time_rate', 'total_jobs',
            'active_route', 'current_location', 'truck_info',
        ]

    def get_truck_info(self, obj):
        truck = getattr(obj, 'assigned_truck', None)
        if truck:
            return {'fleet_id': truck.fleet_id, 'plate': truck.plate}
        return None
