"""
alerts/models.py
Alert persistence model for CargoTrack.

OOP Concepts:
    - Encapsulation: alert data, severity classification, and acknowledgement
                     state are all managed within this single model.
    - Association:   linked to both the triggering Shipment and the user who
                     acknowledged the alert.
"""
from django.conf import settings
from django.db import models


class Alert(models.Model):
    """
    A persisted notification generated when a shipment's delay risk exceeds
    the configured threshold or a critical event is detected.

    Severity levels map to risk_score bands:
        LOW      — routine notice, risk_score < 0.4
        MEDIUM   — elevated risk,  risk_score 0.4–0.6
        HIGH     — significant risk, risk_score 0.6–0.8
        CRITICAL — immediate action required, risk_score > 0.8
    """

    SEVERITY = [
        ('LOW',      'Low'),
        ('MEDIUM',   'Medium'),
        ('HIGH',     'High'),
        ('CRITICAL', 'Critical'),
    ]

    shipment        = models.ForeignKey(
        'shipments.Shipment',
        on_delete=models.CASCADE,
        related_name='alerts',
    )
    message         = models.TextField()
    risk_score      = models.FloatField()
    severity        = models.CharField(max_length=10, choices=SEVERITY)
    sent_at         = models.DateTimeField(auto_now_add=True)
    acknowledged    = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    def __str__(self) -> str:
        return (
            f"[{self.severity}] Shipment {self.shipment_id} — "
            f"risk={self.risk_score:.2f} ({'ack' if self.acknowledged else 'open'})"
        )

    class Meta:
        ordering = ["-sent_at"]
        indexes = [
            models.Index(fields=["shipment", "sent_at"]),
            models.Index(fields=["acknowledged"]),
        ]


class Notification(models.Model):
    """
    In-app notification created by InAppAlertHandler.send().

    Decoupled from the Alert model so the handler can persist lightweight
    notification records without requiring a full Shipment FK lookup.
    Used by InAppAlertHandler in alerts/handlers.py.
    """

    SEVERITY = [
        ('LOW',      'Low'),
        ('MEDIUM',   'Medium'),
        ('HIGH',     'High'),
        ('CRITICAL', 'Critical'),
    ]

    alert_type      = models.CharField(max_length=50)
    shipment_id     = models.PositiveIntegerField()
    tracking_number = models.CharField(max_length=20)
    message         = models.TextField()
    severity        = models.CharField(max_length=10, choices=SEVERITY, default='HIGH')
    created_at      = models.DateTimeField(auto_now_add=True)
    read            = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"[{self.severity}] {self.alert_type} — shipment #{self.shipment_id}"

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shipment_id"]),
            models.Index(fields=["read"]),
        ]
