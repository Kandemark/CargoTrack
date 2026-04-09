from django.contrib import admin
from .models import TrackingEvent


@admin.register(TrackingEvent)
class TrackingEventAdmin(admin.ModelAdmin):
    list_display = ("shipment", "event_type", "location", "timestamp")
    list_filter = ("event_type",)
    search_fields = ("shipment__tracking_number", "location")
    date_hierarchy = "timestamp"
    readonly_fields = ("timestamp",)
