"""
payments/models.py — Invoice and Payment models for CargoTrack.

Each Shipment may have one or more Invoices (e.g. re-invoicing after correction).
Each Invoice may have multiple Payment attempts (retries, partial refunds).
"""
from django.conf import settings
from django.db import models

from cargotrack.encryption import EncryptedTextField
from shipments.models import Shipment


class Invoice(models.Model):
    CURRENCY_CHOICES = [
        ('KES', 'Kenyan Shilling'),
        ('USD', 'US Dollar'),
        ('UGX', 'Ugandan Shilling'),
        ('RWF', 'Rwandan Franc'),
        ('TZS', 'Tanzanian Shilling'),
    ]
    STATUS_CHOICES = [
        ('PENDING',  'Pending'),
        ('PAID',     'Paid'),
        ('FAILED',   'Failed'),
        ('REFUNDED', 'Refunded'),
    ]

    # Invoice number format: CT-2026-0001
    invoice_number = models.CharField(max_length=20, unique=True, editable=False)

    shipment = models.ForeignKey(
        Shipment, on_delete=models.CASCADE, related_name='invoices',
    )
    amount_kes  = models.DecimalField(max_digits=14, decimal_places=2)
    currency    = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='KES')
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    description = models.TextField(blank=True)

    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name='invoices_created',
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    paid_at     = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            from datetime import date
            year = date.today().year
            last = Invoice.objects.filter(
                invoice_number__startswith=f'CT-{year}-'
            ).order_by('-invoice_number').first()
            if last:
                seq = int(last.invoice_number.split('-')[-1]) + 1
            else:
                seq = 1
            self.invoice_number = f'CT-{year}-{seq:04d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.invoice_number} · {self.shipment.tracking_number}'


class Payment(models.Model):
    PROVIDER_CHOICES = [
        ('MPESA',       'M-Pesa'),
        ('AIRTEL',      'Airtel Money'),
        ('MTN',         'MTN MoMo'),
        ('FLUTTERWAVE', 'Flutterwave'),
        ('STRIPE',      'Stripe'),
        ('PESAPAL',     'Pesapal'),
    ]
    STATUS_CHOICES = [
        ('PENDING',   'Pending'),
        ('SUCCESS',   'Success'),
        ('FAILED',    'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]

    invoice            = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    provider           = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    provider_reference = models.CharField(max_length=200, blank=True)
    amount             = models.DecimalField(max_digits=14, decimal_places=2)
    currency           = models.CharField(max_length=3, default='KES')
    status             = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    raw_webhook        = models.JSONField(default=dict, blank=True)
    phone_number       = EncryptedTextField(max_length=20, blank=True)
    created_at         = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.provider} · {self.invoice.invoice_number} · {self.status}'
