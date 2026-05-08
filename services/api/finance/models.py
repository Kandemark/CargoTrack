"""
finance/models.py — Multi-currency financial entities for CargoTrack.

EAC (East African Community) currencies:
    KES — Kenyan Shilling
    TZS — Tanzanian Shilling
    UGX — Ugandan Shilling
    RWF — Rwandan Franc
    BIF — Burundian Franc
    USD — US Dollar (common reference)
    EUR — Euro
    GBP — British Pound

Each country has its own VAT, withholding tax, and excise rules.
"""
from django.db import models


class Currency(models.Model):
    """ISO 4217 currency with EAC-specific metadata."""
    code = models.CharField(max_length=3, unique=True)
    name = models.CharField(max_length=50)
    symbol = models.CharField(max_length=5)
    decimal_places = models.PositiveSmallIntegerField(default=2)
    is_active = models.BooleanField(default=True)
    is_eac = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "Currencies"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} ({self.name})"


class ExchangeRate(models.Model):
    """Daily exchange rate against base currency (USD)."""
    from_currency = models.ForeignKey(
        Currency, on_delete=models.CASCADE, related_name="rates_from"
    )
    to_currency = models.ForeignKey(
        Currency, on_delete=models.CASCADE, related_name="rates_to"
    )
    rate = models.DecimalField(max_digits=18, decimal_places=6)
    source = models.CharField(max_length=50, default="manual")  # CBK, BOT, BOU, BNR, BRB, xe.com
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["from_currency", "to_currency", "-date"]),
        ]
        ordering = ["-date"]

    def __str__(self):
        return f"1 {self.from_currency.code} = {self.rate} {self.to_currency.code} ({self.date})"


class TaxRule(models.Model):
    """Country-specific tax configuration."""
    TAX_TYPES = [
        ("VAT", "Value Added Tax"),
        ("WHT", "Withholding Tax"),
        ("EXCISE", "Excise Duty"),
        ("IMPORT_DUTY", "Import Duty"),
        ("FUEL_SURCHARGE", "Fuel Surcharge"),
        ("INFRASTRUCTURE_LEVY", "Infrastructure Levy"),
        ("RAILWAY_LEVY", "Railway Development Levy"),
    ]

    country_code = models.CharField(max_length=2)  # KE, TZ, UG, RW, BI
    tax_type = models.CharField(max_length=20, choices=TAX_TYPES)
    name = models.CharField(max_length=100)
    rate = models.DecimalField(max_digits=6, decimal_places=4)  # e.g., 0.1600 = 16%
    applies_to = models.CharField(max_length=100, blank=True)  # service type filter
    effective_from = models.DateField()
    effective_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["country_code", "tax_type"]

    def __str__(self):
        return f"{self.country_code} {self.get_tax_type_display()}: {self.rate * 100}%"


class FuelSurcharge(models.Model):
    """Dynamic fuel surcharge configuration per country."""
    country_code = models.CharField(max_length=2)
    base_fuel_price_per_litre = models.DecimalField(max_digits=8, decimal_places=2)
    current_fuel_price_per_litre = models.DecimalField(max_digits=8, decimal_places=2)
    surcharge_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    # Thresholds: apply surcharge when current price exceeds base by this %
    trigger_threshold_pct = models.DecimalField(max_digits=4, decimal_places=1, default=5.0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["country_code"]

    def __str__(self):
        return f"{self.country_code} fuel surcharge: {self.surcharge_percentage}%"


class Invoice(models.Model):
    """Multi-currency invoice record."""
    INVOICE_STATUS = [
        ("DRAFT", "Draft"),
        ("ISSUED", "Issued"),
        ("PAID", "Paid"),
        ("OVERDUE", "Overdue"),
        ("CANCELLED", "Cancelled"),
        ("VOID", "Void"),
    ]

    invoice_number = models.CharField(max_length=20, unique=True)
    shipment = models.ForeignKey(
        "shipments.Shipment", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="invoices"
    )
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, choices=INVOICE_STATUS, default="DRAFT")
    issued_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    paid_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.invoice_number} — {self.total} {self.currency.code}"


class InvoiceLineItem(models.Model):
    """Individual line item on an invoice."""
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="line_items")
    description = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rule = models.ForeignKey(TaxRule, on_delete=models.SET_NULL, null=True, blank=True)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.description}: {self.line_total}"

    def save(self, *args, **kwargs):
        if not self.line_total:
            self.line_total = self.quantity * self.unit_price
        super().save(*args, **kwargs)
