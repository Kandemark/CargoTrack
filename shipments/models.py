"""
shipments/models.py
Core domain models for CargoTrack.

OOP Concepts demonstrated:
    - Encapsulation: each model bundles its data fields and behaviour methods.
    - Composition:   Shipment HAS-A Route (FK relationship).
    - Association:   status choices define the shipment lifecycle state machine.
"""
from django.conf import settings
from django.db import models


class Route(models.Model):
    """
    Represents a named origin-to-destination path that shipments travel.

    Composed inside Shipment as a ForeignKey, allowing multiple shipments
    to share the same physical route.
    """

    origin           = models.CharField(max_length=100)
    destination      = models.CharField(max_length=100)
    distance_km      = models.FloatField()
    estimated_hours  = models.FloatField()
    created_at       = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.origin} → {self.destination}"

    class Meta:
        ordering = ["origin", "destination"]


class Shipment(models.Model):
    """
    Central domain model representing a cargo shipment in transit.

    OOP:
        - Encapsulation: all cargo data and lifecycle state in one class.
        - Composition:   owns a Route via ForeignKey.
        - State machine: status field transitions through STATUS_CHOICES.
    """

    STATUS_CHOICES = [
        ('PENDING',    'Pending'),
        ('IN_TRANSIT', 'In Transit'),
        ('CUSTOMS',    'Customs'),
        ('DELIVERED',  'Delivered'),
        ('DELAYED',    'Delayed'),
    ]

    tracking_number      = models.CharField(max_length=20, unique=True)
    route                = models.ForeignKey(
        Route, on_delete=models.CASCADE, related_name='shipments'
    )
    status               = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING'
    )
    carrier_name         = models.CharField(max_length=100)
    weight_kg            = models.FloatField()
    scheduled_departure  = models.DateTimeField()
    scheduled_arrival    = models.DateTimeField()
    actual_departure     = models.DateTimeField(null=True, blank=True)
    actual_arrival       = models.DateTimeField(null=True, blank=True)
    client               = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='client_shipments',
    )
    delay_risk_score     = models.FloatField(default=0.0)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.tracking_number

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tracking_number"]),
            models.Index(fields=["status"]),
        ]
