"""
demurrage/models.py — Demurrage, detention, and port storage charge tracking.

Demurrage:  Charges when import containers remain at port/terminal beyond free days.
Detention:  Charges when containers remain with consignee beyond free days.
Storage:    Charges for cargo sitting in port warehouse beyond free period.
Per Diem:   Daily rate for demurrage/detention.

EAC Port free time defaults (2024 typical values):
    Mombasa (KE):      4 free days import, 7 days export storage
    Dar es Salaam (TZ): 7 free days import, 14 days transit
    Nairobi ICD (KE):  3 free days after arrival
    Kampala ICD (UG):  3 free days after arrival
    Kigali ICD (RW):   3 free days after arrival
"""
from django.db import models
from django.utils import timezone
from shipments.models import Shipment


class PortFreeTimeConfig(models.Model):
    """Free time configuration per port/terminal and container type."""
    port_name = models.CharField(max_length=100)
    port_code = models.CharField(max_length=10, unique=True)  # UN/LOCODE
    import_free_days = models.PositiveSmallIntegerField(default=4)
    export_free_days = models.PositiveSmallIntegerField(default=7)
    transit_free_days = models.PositiveSmallIntegerField(default=7)
    storage_free_days = models.PositiveSmallIntegerField(default=3)
    applies_to_20ft = models.BooleanField(default=True)
    applies_to_40ft = models.BooleanField(default=True)
    applies_to_reefer = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["port_name"]

    def __str__(self):
        return f"{self.port_name} ({self.port_code}): {self.import_free_days}d import, {self.export_free_days}d export"


class DemurrageRate(models.Model):
    """Daily demurrage/detention rates per port, container type, and day range."""
    CHARGE_TYPES = [
        ("DEMURRAGE", "Demurrage (terminal)"),
        ("DETENTION", "Detention (consignee)"),
        ("STORAGE", "Port Storage"),
    ]
    CONTAINER_TYPES = [
        ("20FT_DRY", "20ft Dry"),
        ("40FT_DRY", "40ft Dry"),
        ("20FT_REEFER", "20ft Reefer"),
        ("40FT_REEFER", "40ft Reefer"),
    ]

    port_config = models.ForeignKey(
        PortFreeTimeConfig, on_delete=models.CASCADE, related_name="rates"
    )
    charge_type = models.CharField(max_length=20, choices=CHARGE_TYPES)
    container_type = models.CharField(max_length=20, choices=CONTAINER_TYPES)
    day_from = models.PositiveSmallIntegerField()  # e.g., day 5
    day_to = models.PositiveSmallIntegerField()    # e.g., day 10
    daily_rate_usd = models.DecimalField(max_digits=8, decimal_places=2)
    effective_from = models.DateField()
    effective_until = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["port_config", "charge_type", "day_from"]

    def __str__(self):
        return f"{self.port_config.port_name} {self.get_charge_type_display()} {self.container_type}: ${self.daily_rate_usd}/day (days {self.day_from}-{self.day_to})"


class ContainerTracking(models.Model):
    """Tracks an individual container through the demurrage lifecycle."""
    SHIPMENT_TYPES = [
        ("IMPORT", "Import"),
        ("EXPORT", "Export"),
        ("TRANSIT", "Transit"),
    ]

    shipment = models.ForeignKey(
        Shipment, on_delete=models.CASCADE, related_name="containers"
    )
    container_number = models.CharField(max_length=20)
    container_type = models.CharField(
        max_length=20, choices=DemurrageRate.CONTAINER_TYPES, default="20FT_DRY"
    )
    shipment_type = models.CharField(max_length=10, choices=SHIPMENT_TYPES)
    port_of_discharge = models.CharField(max_length=10)  # UN/LOCODE
    vessel_arrival_date = models.DateField(null=True, blank=True)
    container_discharged_date = models.DateField(null=True, blank=True)
    free_days_expiry = models.DateField(null=True, blank=True)
    container_returned_date = models.DateField(null=True, blank=True)
    demurrage_days_accrued = models.PositiveSmallIntegerField(default=0)
    demurrage_total_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    detention_days_accrued = models.PositiveSmallIntegerField(default=0)
    detention_total_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_resolved = models.BooleanField(default=False)
    responsible_party = models.CharField(max_length=50, blank=True)  # carrier, consignee, customs
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["container_number"]),
            models.Index(fields=["is_resolved", "free_days_expiry"]),
        ]

    def __str__(self):
        return f"{self.container_number} — {self.get_shipment_type_display()} — ${self.demurrage_total_usd} demurrage + ${self.detention_total_usd} detention"


class DemurrageAccrual(models.Model):
    """Daily accrual record per container for audit trail."""
    container = models.ForeignKey(
        ContainerTracking, on_delete=models.CASCADE, related_name="accruals"
    )
    accrual_date = models.DateField()
    days_after_free_time = models.PositiveSmallIntegerField()
    charge_type = models.CharField(max_length=20, choices=DemurrageRate.CHARGE_TYPES)
    daily_rate_usd = models.DecimalField(max_digits=8, decimal_places=2)
    running_total_usd = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["accrual_date"]
        unique_together = [["container", "accrual_date", "charge_type"]]

    def __str__(self):
        return f"{self.container.container_number}: {self.accrual_date} — ${self.daily_rate_usd} ({self.charge_type})"
