"""
dashboard/apps.py — AppConfig for the dashboard application
============================================================

The dashboard app contains no database models of its own; it aggregates
data from the shipments, tracking, and alerts apps through
``LogisticsDashboard`` (dashboard.py) and exposes read-only KPI endpoints.
"""
from django.apps import AppConfig


class DashboardConfig(AppConfig):
    """AppConfig for the dashboard domain app.

    Attributes:
        default_auto_field: BigAutoField — unused here (no models) but kept
                            consistent with other apps for completeness.
        name: Python dotted path used by Django's app registry.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard"
