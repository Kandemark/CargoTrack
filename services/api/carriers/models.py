"""
carriers/models.py — Carrier and RateCard models for CargoTrack.
"""
from django.db import models

from cargotrack.encryption import EncryptedTextField


class Carrier(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE',    'Active'),
        ('INACTIVE',  'Inactive'),
        ('SUSPENDED', 'Suspended'),
    ]

    code             = models.CharField(max_length=20, unique=True)
    name             = models.CharField(max_length=200)
    status           = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    organization = models.ForeignKey(
        'accounts.Organization', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='carriers',
    )
    contact_name     = models.CharField(max_length=200, blank=True)
    phone            = EncryptedTextField(max_length=30, blank=True)
    email            = EncryptedTextField(max_length=254, blank=True)
    country          = models.CharField(max_length=100, default='Kenya')
    headquarters     = models.CharField(max_length=200, blank=True)

    on_time_rate     = models.FloatField(default=100.0)
    rating           = models.FloatField(default=5.0)
    active_shipments = models.PositiveIntegerField(default=0)
    total_shipments  = models.PositiveIntegerField(default=0)
    high_risk_count  = models.PositiveIntegerField(default=0)

    contract_start   = models.DateField(null=True, blank=True)
    contract_end     = models.DateField(null=True, blank=True)
    specialties      = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.code} — {self.name}'


class RateCard(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE',    'Active'),
        ('EXPIRING',  'Expiring Soon'),
        ('EXPIRED',   'Expired'),
        ('DRAFT',     'Draft'),
    ]
    CURRENCY_CHOICES = [
        ('KES', 'Kenyan Shilling'),
        ('USD', 'US Dollar'),
        ('TZS', 'Tanzanian Shilling'),
        ('UGX', 'Ugandan Shilling'),
        ('RWF', 'Rwandan Franc'),
    ]

    carrier       = models.ForeignKey(Carrier, on_delete=models.CASCADE, related_name='rate_cards')
    name          = models.CharField(max_length=200)
    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    origin        = models.CharField(max_length=100)
    destination   = models.CharField(max_length=100)
    cargo_type    = models.CharField(max_length=100, default='General')

    per_kg        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    per_km        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    min_charge    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency      = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='KES')

    is_hazmat     = models.BooleanField(default=False)
    is_reefer     = models.BooleanField(default=False)

    valid_from    = models.DateField()
    valid_until   = models.DateField()

    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} — {self.carrier.name}'
