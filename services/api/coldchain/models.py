"""coldchain/models.py — Cold chain monitoring for temperature-sensitive cargo."""
from django.conf import settings
from django.db import models
from django.utils import timezone

from shipments.models import Shipment


class ColdChainShipment(models.Model):
    PRODUCT_TYPES = [
        ('FLOWERS', 'Fresh Flowers'),
        ('VEGETABLES', 'Fresh Vegetables'),
        ('FRUITS', 'Fresh Fruits'),
        ('MEAT', 'Chilled / Frozen Meat'),
        ('FISH', 'Chilled / Frozen Fish'),
        ('DAIRY', 'Dairy Products'),
        ('PHARMA', 'Pharmaceuticals'),
        ('VACCINES', 'Vaccines'),
        ('BLOOD', 'Blood Products'),
        ('CHEMICALS', 'Temperature-Sensitive Chemicals'),
        ('OTHER', 'Other Perishable'),
    ]

    shipment = models.OneToOneField(
        'shipments.Shipment', on_delete=models.CASCADE,
        related_name='coldchain',
    )
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPES)
    temp_min_c = models.FloatField()
    temp_max_c = models.FloatField()
    humidity_min_pct = models.FloatField(null=True, blank=True)
    humidity_max_pct = models.FloatField(null=True, blank=True)
    tolerance_minutes = models.PositiveIntegerField(default=30)
    requires_continuous_monitoring = models.BooleanField(default=True)
    monitoring_device_id = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Cold Chain Shipment'
        verbose_name_plural = 'Cold Chain Shipments'

    def __str__(self):
        try:
            tn = self.shipment.tracking_number
        except (Shipment.DoesNotExist, AttributeError):
            tn = f'#{self.shipment_id}'
        return f'ColdChain — {tn} ({self.get_product_type_display()})'


class TemperatureReading(models.Model):
    coldchain_shipment = models.ForeignKey(
        ColdChainShipment, on_delete=models.CASCADE,
        related_name='readings',
    )
    device_id = models.CharField(max_length=100)
    timestamp = models.DateTimeField(db_index=True)
    temperature_c = models.FloatField()
    humidity_pct = models.FloatField(null=True, blank=True)
    battery_level = models.FloatField(null=True, blank=True)
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)
    signal_strength = models.FloatField(null=True, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['coldchain_shipment', 'timestamp']),
            models.Index(fields=['device_id', 'timestamp']),
        ]
        verbose_name = 'Temperature Reading'
        verbose_name_plural = 'Temperature Readings'

    def __str__(self):
        return f'{self.temperature_c}°C @ {self.timestamp.isoformat()}'


class TemperatureExcursion(models.Model):
    SEVERITY_CHOICES = [
        ('WARNING', 'Warning — approaching limit'),
        ('BREACH', 'Breach — out of range'),
        ('CRITICAL', 'Critical — prolonged breach'),
        ('SPOILAGE_ALERT', 'Spoilage Alert — product at risk'),
    ]

    coldchain_shipment = models.ForeignKey(
        ColdChainShipment, on_delete=models.CASCADE,
        related_name='excursions',
    )
    started_at = models.DateTimeField()
    resolved_at = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    peak_temp_c = models.FloatField(null=True, blank=True)
    min_temp_c = models.FloatField(null=True, blank=True)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='BREACH')
    temp_limit_breached = models.CharField(max_length=10)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='acknowledged_excursions',
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Temperature Excursion'
        verbose_name_plural = 'Temperature Excursions'

    def try_auto_resolve(self, current_temp_c, tolerance_minutes, now=None):
        """Auto-resolve if temperature is back in range and tolerance window elapsed."""
        cc = self.coldchain_shipment
        if cc.temp_min_c <= current_temp_c <= cc.temp_max_c:
            from django.utils import timezone
            now = now or timezone.now()
            elapsed = (now - self.started_at).total_seconds() / 60.0
            if elapsed >= tolerance_minutes:
                self.resolved_at = now
                self.duration_minutes = int(elapsed)
                self.save(update_fields=['resolved_at', 'duration_minutes'])
                # Escalate severity if breach was prolonged
                if elapsed > tolerance_minutes * 4:
                    self.severity = 'SPOILAGE_ALERT'
                elif elapsed > tolerance_minutes * 2:
                    self.severity = 'CRITICAL'
                self.save(update_fields=['severity'])
                return True
        return False

    def check_escalation(self, tolerance_minutes):
        """Escalate severity based on duration relative to tolerance window."""
        from django.utils import timezone
        elapsed = (timezone.now() - self.started_at).total_seconds() / 60.0
        old_severity = self.severity
        if elapsed > tolerance_minutes * 4:
            self.severity = 'SPOILAGE_ALERT'
        elif elapsed > tolerance_minutes * 2:
            self.severity = 'CRITICAL'
        elif elapsed > tolerance_minutes:
            self.severity = 'BREACH'
        else:
            self.severity = 'WARNING'
        if self.severity != old_severity:
            self.save(update_fields=['severity'])
            return True
        return False

    def __str__(self):
        try:
            label = str(self.coldchain_shipment)
        except (ColdChainShipment.DoesNotExist, AttributeError):
            label = f'CC#{self.coldchain_shipment_id}'
        return f'{self.severity} — {self.duration_minutes}min — {label}'


class ColdChainSLA(models.Model):
    """SLA breach tracking for cold chain shipments."""
    coldchain_shipment = models.OneToOneField(
        ColdChainShipment, on_delete=models.CASCADE,
        related_name='sla',
    )
    max_excursion_minutes = models.PositiveIntegerField(default=120)
    max_excursions = models.PositiveIntegerField(default=3)
    total_excursion_minutes = models.PositiveIntegerField(default=0)
    total_excursions = models.PositiveIntegerField(default=0)
    is_breached = models.BooleanField(default=False)
    breached_at = models.DateTimeField(null=True, blank=True)
    notification_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Cold Chain SLA'
        verbose_name_plural = 'Cold Chain SLAs'

    def check_breach(self):
        if self.total_excursion_minutes > self.max_excursion_minutes or self.total_excursions > self.max_excursions:
            if not self.is_breached:
                self.is_breached = True
                self.breached_at = timezone.now()
                self.save(update_fields=['is_breached', 'breached_at'])
                return True
        return False

    def __str__(self):
        try:
            label = str(self.coldchain_shipment)
        except (ColdChainShipment.DoesNotExist, AttributeError):
            label = f'CC#{self.coldchain_shipment_id}'
        return f'SLA — {label}'


class ColdChainCertificate(models.Model):
    coldchain_shipment = models.OneToOneField(
        ColdChainShipment, on_delete=models.CASCADE,
        related_name='certificate',
    )
    issued_at = models.DateTimeField(auto_now_add=True)
    total_readings = models.PositiveIntegerField()
    excursions_count = models.PositiveIntegerField(default=0)
    total_excursion_minutes = models.PositiveIntegerField(default=0)
    min_temp_recorded_c = models.FloatField()
    max_temp_recorded_c = models.FloatField()
    avg_temp_c = models.FloatField()
    is_compliant = models.BooleanField()
    pdf_report = models.FileField(upload_to='coldchain_certs/%Y/%m/', blank=True)
    digital_signature = models.TextField(blank=True)

    class Meta:
        ordering = ['-issued_at']
        verbose_name = 'Cold Chain Certificate'
        verbose_name_plural = 'Cold Chain Certificates'

    def __str__(self):
        status = 'COMPLIANT' if self.is_compliant else 'NON-COMPLIANT'
        try:
            label = str(self.coldchain_shipment)
        except (ColdChainShipment.DoesNotExist, AttributeError):
            label = f'CC#{self.coldchain_shipment_id}'
        return f'{status} — {label}'


# ── Signals — Excursion → Alert Integration ──────────────────────────────────

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=TemperatureExcursion)
def on_excursion_created(sender, instance, created, **kwargs):
    """When an excursion is first detected, create an Alert and Notification."""
    if not created:
        return
    _create_excursion_alert(instance)


def _create_excursion_alert(excursion):
    mapping = {
        'WARNING': 'LOW',
        'BREACH': 'MEDIUM',
        'CRITICAL': 'HIGH',
        'SPOILAGE_ALERT': 'CRITICAL',
    }
    from alerts.models import Alert, Notification as AlertNotification
    cc = excursion.coldchain_shipment

    Alert.objects.create(
        shipment=cc.shipment,
        message=(
            f'Cold chain excursion on {cc.shipment.tracking_number}: '
            f'{excursion.get_severity_display()} — '
            f'temp breached {excursion.temp_limit_breached} '
            f'(current: {excursion.peak_temp_c}°C, '
            f'allowed: {cc.temp_min_c}–{cc.temp_max_c}°C). '
            f'Product: {cc.get_product_type_display()}.'
        ),
        risk_score={'WARNING': 0.3, 'BREACH': 0.55, 'CRITICAL': 0.75, 'SPOILAGE_ALERT': 0.95}.get(excursion.severity, 0.5),
        severity=mapping.get(excursion.severity, 'MEDIUM'),
    )

    if cc.shipment.client_id:
        AlertNotification.objects.create(
            alert_type='COLD_CHAIN_EXCURSION',
            shipment_id=cc.shipment_id,
            tracking_number=cc.shipment.tracking_number,
            message=(
                f'Temperature excursion detected: {excursion.get_severity_display()}. '
                f'Shipment {cc.shipment.tracking_number} '
                f'({cc.get_product_type_display()}). '
                f'Peak temp: {excursion.peak_temp_c}°C.'
            ),
            severity=mapping.get(excursion.severity, 'HIGH'),
        )
