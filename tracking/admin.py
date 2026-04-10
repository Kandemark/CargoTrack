"""
tracking/admin.py — Django admin registration for the tracking app
==================================================================

TrackingEventAdmin provides a date-hierarchical view of all tracking events
so operations staff can audit the movement history of any shipment by day.
"""
from django.contrib import admin
from .models import TrackingEvent


@admin.register(TrackingEvent)
class TrackingEventAdmin(admin.ModelAdmin):
    """Admin view for TrackingEvent with date drill-down and event-type filter."""

    list_display  = ("shipment", "event_type", "location", "timestamp")
    list_filter   = ("event_type",)                     # sidebar filter by type
    search_fields = ("shipment__tracking_number", "location")
    date_hierarchy = "timestamp"                        # year → month → day breadcrumb
    # timestamp is set automatically by the model default; prevent manual edits
    readonly_fields = ("timestamp",)
