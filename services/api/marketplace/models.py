"""marketplace/models.py — FreightListing and Bid models for the job board."""
from django.conf import settings
from django.db import models


class FreightListing(models.Model):
    """A freight job posted to the marketplace by a client or logistics manager."""

    CARGO_TYPES = [
        ('GENERAL',     'General Cargo'),
        ('PERISHABLE',  'Perishable'),
        ('HAZARDOUS',   'Hazardous Materials'),
        ('FRAGILE',     'Fragile'),
        ('BULK',        'Bulk'),
        ('CONTAINER',   'Containerized'),
        ('LIQUID',      'Liquid'),
        ('VEHICLES',    'Vehicles'),
        ('LIVESTOCK',   'Livestock'),
        ('OTHER',       'Other'),
    ]

    STATUS_CHOICES = [
        ('OPEN',        'Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('AWARDED',     'Awarded'),
        ('COMPLETED',   'Completed'),
        ('CANCELLED',   'Cancelled'),
        ('EXPIRED',     'Expired'),
    ]

    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='freight_listings',
    )
    cargo_type = models.CharField(max_length=20, choices=CARGO_TYPES, default='GENERAL')
    weight_kg = models.FloatField()
    volume_m3 = models.FloatField(null=True, blank=True)
    origin = models.CharField(max_length=200)
    destination = models.CharField(max_length=200)
    pickup_date = models.DateField()
    delivery_date = models.DateField()
    budget_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    budget_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    description = models.TextField(blank=True)
    requires_hazmat = models.BooleanField(default=False)
    requires_reefer = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    awarded_shipment = models.ForeignKey(
        'shipments.Shipment', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='freight_awarded_from',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Freight #{self.pk}: {self.origin} → {self.destination}'


class Bid(models.Model):
    """A carrier's bid on a freight listing."""

    STATUS_CHOICES = [
        ('PENDING',  'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('REJECTED', 'Rejected'),
        ('WITHDRAWN','Withdrawn'),
    ]

    listing = models.ForeignKey(
        FreightListing, on_delete=models.CASCADE, related_name='bids',
    )
    carrier = models.ForeignKey(
        'carriers.Carrier', on_delete=models.CASCADE, related_name='bids',
    )
    truck = models.ForeignKey(
        'fleet.Truck', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='bids',
    )
    driver = models.ForeignKey(
        'fleet.Driver', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='bids',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    estimated_days = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['listing', 'carrier'],
                name='unique_bid_per_carrier_per_listing',
            ),
        ]

    def __str__(self):
        return f'Bid #{self.pk} by {self.carrier.name} — {self.amount}'
