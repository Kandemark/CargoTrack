from django.contrib import admin
from .models import Route, Shipment


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("origin", "destination", "distance_km", "estimated_hours")
    search_fields = ("origin", "destination")


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ("tracking_number", "status", "carrier_name", "route",
                    "scheduled_departure", "delay_risk_score")
    list_filter = ("status",)
    search_fields = ("tracking_number", "carrier_name")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"
