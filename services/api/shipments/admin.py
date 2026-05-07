"""
shipments/admin.py — Django admin registration for shipments models
====================================================================

Registers Route and Shipment models with the Django admin site.
ShipmentAdmin surfaces the delay_risk_score and provides a date-based
drill-down so operations staff can audit shipment activity by day/month.
"""
from django.contrib import admin
from .models import Route, Shipment


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    """Admin view for Route — origin/destination lookup table."""

    list_display  = ("origin", "destination", "distance_km", "estimated_hours")
    search_fields = ("origin", "destination")


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    """Admin view for Shipment with date drill-down and risk-score visibility."""

    # Key columns for operations review
    list_display  = ("tracking_number", "status", "carrier_name", "route",
                     "scheduled_departure", "delay_risk_score")
    list_filter   = ("status",)                     # sidebar filter by status
    search_fields = ("tracking_number", "carrier_name")
    # Prevent accidental manual edits to auto-managed timestamp fields
    readonly_fields = ("created_at", "updated_at")
    # Clickable year → month → day breadcrumb for time-based audits
    date_hierarchy = "created_at"
