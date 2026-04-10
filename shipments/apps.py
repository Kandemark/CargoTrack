"""
shipments/apps.py — AppConfig for the shipments application
============================================================

The shipments app owns the core domain models (Route, Shipment) and
exposes the CRUD REST API for cargo shipment management and delay prediction.
"""
from django.apps import AppConfig


class ShipmentsConfig(AppConfig):
    """AppConfig for the shipments domain app.

    Attributes:
        default_auto_field: BigAutoField (64-bit) prevents ID exhaustion on
                            high-volume shipment tables.
        name: Python dotted path used by Django's app registry.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "shipments"
