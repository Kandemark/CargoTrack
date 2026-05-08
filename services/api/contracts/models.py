"""
contracts/models.py — Contract and rate management for CargoTrack.

Supports:
    - Annual rate cards per carrier/corridor
    - Contract pricing with validity windows
    - Spot market vs contract rate reconciliation
    - Approval workflows for rate changes
    - Volume-based tiered pricing
"""
from django.conf import settings
from django.db import models


class RateCard(models.Model):
    """A rate card defines pricing for a carrier on specific corridors."""
    name = models.CharField(max_length=100)
    carrier = models.ForeignKey(
        "carriers.Carrier", on_delete=models.CASCADE, related_name="rate_cards"
    )
    effective_from = models.DateField()
    effective_until = models.DateField()
    currency = models.CharField(max_length=3, default="USD")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-effective_from"]

    def __str__(self):
        return f"{self.carrier.name} — {self.name} ({self.effective_from})"


class RateLine(models.Model):
    """Individual rate within a rate card for a specific corridor and vehicle type."""
    RATE_TYPES = [
        ("PER_KG", "Per Kilogram"),
        ("PER_TON", "Per Metric Ton"),
        ("PER_KM", "Per Kilometer"),
        ("PER_TRIP", "Per Trip (flat)"),
        ("PER_CONTAINER", "Per Container"),
        ("PER_CBM", "Per Cubic Meter"),
    ]

    rate_card = models.ForeignKey(RateCard, on_delete=models.CASCADE, related_name="lines")
    origin = models.CharField(max_length=100)
    destination = models.CharField(max_length=100)
    corridor = models.CharField(max_length=200, blank=True)  # e.g. "Mombasa-Nairobi"
    vehicle_type = models.CharField(max_length=50, blank=True)  # e.g. "40ft flatbed"
    rate_type = models.CharField(max_length=20, choices=RATE_TYPES, default="PER_KG")
    base_rate = models.DecimalField(max_digits=10, decimal_places=2)
    minimum_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fuel_surcharge_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    border_crossing_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    customs_clearance_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    loading_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    extra_stop_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["origin", "destination"]
        indexes = [
            models.Index(fields=["origin", "destination"]),
            models.Index(fields=["corridor"]),
        ]

    def __str__(self):
        return f"{self.origin} → {self.destination}: {self.base_rate} {self.get_rate_type_display()}"


class TieredRate(models.Model):
    """Volume-based tiered pricing: lower rates for higher volume commitment."""
    rate_line = models.ForeignKey(RateLine, on_delete=models.CASCADE, related_name="tiers")
    min_volume_kg = models.DecimalField(max_digits=10, decimal_places=2)
    max_volume_kg = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2)  # e.g. 5.00 = 5% off
    min_shipments_per_month = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["min_volume_kg"]

    def __str__(self):
        return f"{self.min_volume_kg}+ kg: {self.discount_pct}% discount"


class Contract(models.Model):
    """A contract between a shipper and a carrier with negotiated rates."""
    CONTRACT_STATUS = [
        ("DRAFT", "Draft"),
        ("PENDING_APPROVAL", "Pending Approval"),
        ("ACTIVE", "Active"),
        ("SUSPENDED", "Suspended"),
        ("EXPIRED", "Expired"),
        ("TERMINATED", "Terminated"),
    ]

    contract_number = models.CharField(max_length=20, unique=True)
    shipper = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shipper_contracts"
    )
    carrier = models.ForeignKey(
        "carriers.Carrier", on_delete=models.CASCADE, related_name="carrier_contracts"
    )
    rate_card = models.ForeignKey(
        RateCard, on_delete=models.SET_NULL, null=True, blank=True, related_name="contracts"
    )
    status = models.CharField(max_length=20, choices=CONTRACT_STATUS, default="DRAFT")
    effective_from = models.DateField()
    effective_until = models.DateField()
    minimum_volume_kg = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    committed_shipments = models.PositiveIntegerField(default=0)  # from contract clause
    actual_shipments = models.PositiveIntegerField(default=0)      # reconciliation counter
    penalty_per_missed_shipment = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    signed_by_shipper = models.BooleanField(default=False)
    signed_by_carrier = models.BooleanField(default=False)
    signed_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.contract_number}: {self.shipper} ↔ {self.carrier.name}"

    @property
    def is_fully_signed(self):
        return self.signed_by_shipper and self.signed_by_carrier

    @property
    def utilization_pct(self):
        if self.committed_shipments > 0:
            return round(self.actual_shipments / self.committed_shipments * 100, 1)
        return 0


class ShipmentRateLookup(models.Model):
    """
    Tracks which rate was applied to a specific shipment for reconciliation.
    Links the contract/rate card rate to the actual billed amount.
    """
    shipment = models.OneToOneField(
        "shipments.Shipment", on_delete=models.CASCADE, related_name="rate_lookup"
    )
    rate_line = models.ForeignKey(
        RateLine, on_delete=models.SET_NULL, null=True, blank=True, related_name="shipment_lookups"
    )
    contract = models.ForeignKey(
        Contract, on_delete=models.SET_NULL, null=True, blank=True, related_name="shipment_lookups"
    )
    rate_type = models.CharField(max_length=10, default="CONTRACT")  # CONTRACT or SPOT
    calculated_rate = models.DecimalField(max_digits=10, decimal_places=2)
    applied_surcharges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_charge = models.DecimalField(max_digits=10, decimal_places=2)
    spot_market_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    savings_vs_spot = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Rate for {self.shipment.tracking_number}: {self.total_charge}"
