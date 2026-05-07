"""
tracking/apps.py — AppConfig for the tracking application
==========================================================

The tracking app owns the TrackingEvent model, which implements the
ShipmentEvent ABC from cargotrack.base_classes.  Every location update,
customs hold, and status change in transit is recorded here.
"""
from django.apps import AppConfig


class TrackingConfig(AppConfig):
    """AppConfig for the tracking domain app.

    Attributes:
        default_auto_field: BigAutoField (64-bit) for high-volume event tables.
        name: Python dotted path used by Django's app registry.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "tracking"
