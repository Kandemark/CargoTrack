"""
alerts/admin.py — Django admin registration for the alerts app
==============================================================

AlertAdmin provides operations staff with a severity-filtered view of all
open and acknowledged alerts.  sent_at and acknowledged_by are read-only to
preserve the audit trail.
"""
from django.contrib import admin
from .models import Alert


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    """Admin view for Alert — surfaces risk scores and acknowledgement state."""

    list_display  = ("shipment", "severity", "risk_score", "sent_at", "acknowledged")
    list_filter   = ("severity", "acknowledged")    # sidebar filter by severity / status
    search_fields = ("shipment__tracking_number", "message")
    date_hierarchy = "sent_at"                      # year → month → day breadcrumb
    # Auto-managed fields; prevent manual edits that would corrupt the audit trail
    readonly_fields = ("sent_at", "acknowledged_by")
