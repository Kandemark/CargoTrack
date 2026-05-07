"""
fleet/models.py — Truck and Driver domain models for CargoTrack fleet management.
"""
from django.conf import settings
from django.db import models

from cargotrack.encryption import EncryptedTextField


class Truck(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE',       'Active'),
        ('IDLE',         'Idle'),
        ('MAINTENANCE',  'Maintenance'),
        ('OFF_DUTY',     'Off Duty'),
        ('DECOMMISSIONED', 'Decommissioned'),
    ]
    FUEL_TYPES = [
        ('DIESEL',   'Diesel'),
        ('PETROL',   'Petrol'),
        ('ELECTRIC', 'Electric'),
        ('HYBRID',   'Hybrid'),
        ('LPG',      'LPG'),
    ]

    # Identity
    fleet_id     = models.CharField(max_length=20, unique=True)   # TX-101
    make         = models.CharField(max_length=100)
    model        = models.CharField(max_length=100)
    year         = models.PositiveIntegerField()
    plate        = models.CharField(max_length=20, unique=True)
    vin          = models.CharField(max_length=50, unique=True, blank=True)
    color        = models.CharField(max_length=50, blank=True)

    # Specs
    payload_tonnes   = models.FloatField(default=0)
    engine_cc        = models.PositiveIntegerField(default=0)
    fuel_type        = models.CharField(max_length=10, choices=FUEL_TYPES, default='DIESEL')
    fuel_capacity_l  = models.FloatField(default=0)

    # Operations
    status            = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IDLE')
    odometer_km       = models.FloatField(default=0)
    load_pct          = models.FloatField(default=0)        # 0–100 current load percentage
    current_location  = models.CharField(max_length=200, blank=True)
    latitude          = models.FloatField(null=True, blank=True)
    longitude         = models.FloatField(null=True, blank=True)

    # Maintenance
    last_service_date = models.DateField(null=True, blank=True)
    next_service_date = models.DateField(null=True, blank=True)
    next_service_km   = models.FloatField(null=True, blank=True)

    # Organization
    organization = models.ForeignKey(
        'accounts.Organization', on_delete=models.CASCADE,
        related_name='trucks', null=True, blank=True,
    )

    # Assignment
    assigned_driver   = models.OneToOneField(
        'Driver', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_truck',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['fleet_id']

    def __str__(self):
        return f'{self.fleet_id} — {self.year} {self.make} {self.model}'


class Driver(models.Model):
    STATUS_CHOICES = [
        ('AVAILABLE',   'Available'),
        ('ON_ROUTE',    'On Route'),
        ('OFF_DUTY',    'Off Duty'),
        ('ON_LEAVE',    'On Leave'),
        ('SUSPENDED',   'Suspended'),
    ]
    LICENSE_CLASSES = [
        ('CE',  'Class CE — Heavy Articulated'),
        ('C',   'Class C — Rigid HGV'),
        ('B',   'Class B — Light Goods'),
        ('ADR', 'ADR — Hazardous Materials'),
    ]

    # Identity
    driver_id    = models.CharField(max_length=20, unique=True)   # DRV-001
    user         = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='driver_profile',
    )
    organization = models.ForeignKey(
        'accounts.Organization', on_delete=models.CASCADE,
        related_name='drivers', null=True, blank=True,
    )
    first_name   = models.CharField(max_length=100)
    last_name    = models.CharField(max_length=100)
    phone        = EncryptedTextField(max_length=30)
    email        = EncryptedTextField(max_length=254, blank=True)
    avatar_url   = models.URLField(blank=True)

    # License
    license_number  = EncryptedTextField(max_length=50, blank=True)
    license_class   = models.CharField(max_length=10, choices=LICENSE_CLASSES, default='C')
    license_expiry  = models.DateField(null=True, blank=True)

    # Status
    status           = models.CharField(max_length=20, choices=STATUS_CHOICES, default='AVAILABLE')
    date_joined      = models.DateField(null=True, blank=True)
    years_experience = models.PositiveIntegerField(default=0)

    # Performance (denormalised for fast dashboard reads)
    rating          = models.FloatField(default=5.0)
    on_time_rate    = models.FloatField(default=100.0)   # percentage
    total_jobs      = models.PositiveIntegerField(default=0)
    total_km        = models.FloatField(default=0)
    earnings_mtd    = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Active assignment
    active_route     = models.CharField(max_length=200, blank=True)
    current_location = models.CharField(max_length=200, blank=True)
    latitude         = models.FloatField(null=True, blank=True)
    longitude        = models.FloatField(null=True, blank=True)

    certifications   = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['driver_id']

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'

    def __str__(self):
        return f'{self.driver_id} — {self.full_name}'


class DriverJobHistory(models.Model):
    """Lightweight per-driver job log for analytics."""
    driver      = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name='job_history')
    shipment    = models.ForeignKey(
        'shipments.Shipment', on_delete=models.SET_NULL, null=True, blank=True,
    )
    route_label  = models.CharField(max_length=200)
    distance_km  = models.FloatField(default=0)
    status       = models.CharField(max_length=20, default='COMPLETED')
    on_time      = models.BooleanField(default=True)
    earnings_kes = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-completed_at']


class ScaleTicket(models.Model):
    """Digital weighbridge/scale ticket captured by driver on mobile."""
    truck = models.ForeignKey(Truck, on_delete=models.CASCADE, related_name='scale_tickets')
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, related_name='scale_tickets')
    weight_kg = models.FloatField()
    image_url = models.URLField(blank=True)  # scale ticket photo URL
    location = models.CharField(max_length=200, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    notes = models.TextField(blank=True)
    captured_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-captured_at']

    def __str__(self):
        return f'Scale #{self.pk} — {self.weight_kg} kg @ {self.truck.fleet_id}'


class TruckMaintenanceLog(models.Model):
    """Service and repair history for a truck."""
    TYPES = [
        ('ROUTINE',      'Routine Service'),
        ('REPAIR',       'Repair'),
        ('INSPECTION',   'Inspection'),
        ('TYRE',         'Tyre Change'),
        ('EMERGENCY',    'Emergency Breakdown'),
    ]
    truck        = models.ForeignKey(Truck, on_delete=models.CASCADE, related_name='maintenance_logs')
    log_type     = models.CharField(max_length=20, choices=TYPES, default='ROUTINE')
    description  = models.TextField(blank=True)
    cost_kes     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    odometer_km  = models.FloatField(default=0)
    performed_by = models.CharField(max_length=200, blank=True)
    performed_at = models.DateTimeField()
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-performed_at']
