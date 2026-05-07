"""
alerts/apps.py — AppConfig for the alerts application
======================================================

The alerts app owns the Alert and Notification models plus the handler
pipeline (handlers.py, manager.py, alert_manager.py).  Alerts are generated
by PredictDelayAPIView and AlertManager when a shipment's delay_risk_score
crosses the thresholds defined in settings.ALERT_THRESHOLDS.
"""
from django.apps import AppConfig


class AlertsConfig(AppConfig):
    """AppConfig for the alerts domain app.

    Attributes:
        default_auto_field: BigAutoField (64-bit) for alert and notification tables.
        name: Python dotted path used by Django's app registry.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "alerts"
