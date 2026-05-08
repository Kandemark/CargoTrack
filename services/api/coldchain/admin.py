from django.contrib import admin

from .models import (
    ColdChainShipment, TemperatureReading,
    TemperatureExcursion, ColdChainCertificate,
)


class TemperatureReadingInline(admin.TabularInline):
    model = TemperatureReading
    extra = 0
    fields = ('timestamp', 'temperature_c', 'humidity_pct', 'device_id')
    readonly_fields = fields
    can_delete = False
    max_num = 50

    def has_add_permission(self, request, obj=None):
        return False


class TemperatureExcursionInline(admin.TabularInline):
    model = TemperatureExcursion
    extra = 0
    fields = ('severity', 'started_at', 'duration_minutes', 'temp_limit_breached')
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ColdChainShipment)
class ColdChainShipmentAdmin(admin.ModelAdmin):
    list_display = (
        'shipment', 'product_type', 'temp_min_c', 'temp_max_c',
        'monitoring_device_id', 'requires_continuous_monitoring',
    )
    list_filter = ('product_type', 'requires_continuous_monitoring')
    search_fields = ('shipment__tracking_number', 'monitoring_device_id')
    inlines = [TemperatureExcursionInline, TemperatureReadingInline]


@admin.register(TemperatureReading)
class TemperatureReadingAdmin(admin.ModelAdmin):
    list_display = ('coldchain_shipment', 'timestamp', 'temperature_c', 'humidity_pct', 'device_id')
    list_filter = ('device_id', 'timestamp')
    date_hierarchy = 'timestamp'


@admin.register(TemperatureExcursion)
class TemperatureExcursionAdmin(admin.ModelAdmin):
    list_display = ('coldchain_shipment', 'severity', 'started_at', 'duration_minutes', 'acknowledged_at')
    list_filter = ('severity', 'acknowledged_at')


@admin.register(ColdChainCertificate)
class ColdChainCertificateAdmin(admin.ModelAdmin):
    list_display = ('coldchain_shipment', 'is_compliant', 'avg_temp_c', 'excursions_count', 'issued_at')
    list_filter = ('is_compliant',)
