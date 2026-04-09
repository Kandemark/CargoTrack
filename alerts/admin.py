from django.contrib import admin
from .models import Alert


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ("shipment", "severity", "risk_score", "sent_at", "acknowledged")
    list_filter = ("severity", "acknowledged")
    search_fields = ("shipment__tracking_number", "message")
    date_hierarchy = "sent_at"
