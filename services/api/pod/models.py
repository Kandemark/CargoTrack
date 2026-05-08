"""pod/models.py — Digital Proof of Delivery with signature, photos, verification, and disputes."""
import hashlib
import secrets
from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from cargotrack.encryption import EncryptedTextField


class ProofOfDelivery(models.Model):
    CONDITION_CHOICES = [
        ('GOOD', 'Good — delivered intact'),
        ('DAMAGED', 'Damaged — visible damage noted'),
        ('SHORT', 'Short — quantity mismatch'),
        ('REFUSED', 'Refused — receiver rejected'),
    ]
    VERIFICATION_STATUS = [
        ('UNVERIFIED', 'Awaiting client verification'),
        ('VERIFIED', 'Client verified — accepted'),
        ('DISPUTED', 'Client disputed — under review'),
    ]

    shipment = models.OneToOneField(
        'shipments.Shipment', on_delete=models.CASCADE,
        related_name='proof_of_delivery',
    )
    verification_code = models.CharField(max_length=12, unique=True, blank=True)
    delivered_at = models.DateTimeField()
    received_by_name = models.CharField(max_length=200)
    received_by_phone = EncryptedTextField(max_length=30, blank=True)
    received_by_signature = models.TextField(blank=True)
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='GOOD')
    verification_status = models.CharField(
        max_length=20, choices=VERIFICATION_STATUS, default='UNVERIFIED',
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='verified_pods',
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    captured_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='captured_pods',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Proof of Delivery'
        verbose_name_plural = 'Proofs of Delivery'

    def save(self, *args, **kwargs):
        if not self.verification_code:
            self.verification_code = f'CT-POD-{secrets.token_hex(4).upper()}'
        super().save(*args, **kwargs)

    def generate_qr_url(self):
        base = getattr(settings, 'POD_VERIFICATION_BASE_URL', 'https://app.cargotrack.io')
        return f'{base}/verify-pod?code={self.verification_code}'

    def __str__(self):
        try:
            tn = self.shipment.tracking_number
        except Exception:
            tn = f'#{self.shipment_id}'
        return f'POD — {tn}'


class PODPhoto(models.Model):
    PHOTO_TYPES = [
        ('PACKAGE', 'Package / Cargo'),
        ('DAMAGE', 'Damage'),
        ('LOCATION', 'Location / Address'),
        ('SIGNATURE', 'Signature'),
        ('ID_CARD', 'Receiver ID'),
        ('OTHER', 'Other'),
    ]

    pod = models.ForeignKey(
        ProofOfDelivery, on_delete=models.CASCADE, related_name='photos',
    )
    image = models.ImageField(upload_to='pod_photos/%Y/%m/')
    photo_type = models.CharField(max_length=20, choices=PHOTO_TYPES, default='PACKAGE')
    caption = models.CharField(max_length=300, blank=True)
    taken_at = models.DateTimeField(null=True, blank=True)
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['taken_at']
        verbose_name = 'POD Photo'
        verbose_name_plural = 'POD Photos'

    def __str__(self):
        return f'{self.get_photo_type_display()} — POD #{self.pod_id}'


class PODDispute(models.Model):
    DISPUTE_REASONS = [
        ('DAMAGED', 'Goods damaged on arrival'),
        ('SHORTAGE', 'Quantity shortage'),
        ('WRONG_GOODS', 'Wrong goods delivered'),
        ('LATE', 'Delivered after deadline'),
        ('CONDITION', 'Poor handling / condition'),
        ('DOCUMENTATION', 'Missing or incorrect documents'),
        ('OTHER', 'Other'),
    ]
    RESOLUTION_STATUS = [
        ('OPEN', 'Open'),
        ('UNDER_REVIEW', 'Under Review'),
        ('AWAITING_EVIDENCE', 'Awaiting Evidence'),
        ('RESOLVED_REFUND', 'Resolved — Refund Issued'),
        ('RESOLVED_REDELIVERY', 'Resolved — Redelivery Scheduled'),
        ('RESOLVED_ACCEPTED', 'Resolved — Accepted as-is'),
        ('CLOSED', 'Closed'),
    ]

    pod = models.OneToOneField(
        ProofOfDelivery, on_delete=models.CASCADE, related_name='dispute',
    )
    dispute_reason = models.CharField(max_length=20, choices=DISPUTE_REASONS)
    description = models.TextField()
    raised_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='raised_disputes',
    )
    raised_at = models.DateTimeField(auto_now_add=True)
    resolution_status = models.CharField(
        max_length=20, choices=RESOLUTION_STATUS, default='OPEN',
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_disputes',
    )
    resolution_notes = models.TextField(blank=True)
    resolution_amount = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text='Refund or compensation amount if applicable',
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-raised_at']
        verbose_name = 'POD Dispute'
        verbose_name_plural = 'POD Disputes'

    def __str__(self):
        return f'Dispute — POD #{self.pod_id} — {self.get_dispute_reason_display()}'


# ── Signals ──────────────────────────────────────────────────────────────────

@receiver(post_save, sender=ProofOfDelivery)
def on_pod_captured(sender, instance, created, **kwargs):
    """When a POD is first captured, auto-update the shipment status to DELIVERED."""
    if not created:
        return
    shipment = instance.shipment
    shipment.status = 'DELIVERED'
    shipment.actual_arrival = instance.delivered_at
    shipment.save(update_fields=['status', 'actual_arrival'])
    _create_pod_notification(instance, shipment)


@receiver(post_save, sender=PODDispute)
def on_dispute_raised(sender, instance, created, **kwargs):
    """When a dispute is raised, update the POD verification status."""
    if not created:
        return
    instance.pod.verification_status = 'DISPUTED'
    instance.pod.save(update_fields=['verification_status'])


def _create_pod_notification(pod, shipment):
    """Create an in-app notification for the shipment client when POD is captured."""
    from accounts.models import Notification
    if shipment.client_id:
        Notification.objects.create(
            user_id=shipment.client_id,
            type='SHIPMENT',
            title=f'Delivery confirmed — {shipment.tracking_number}',
            message=(
                f'Your shipment {shipment.tracking_number} has been delivered.\n'
                f'Condition: {pod.get_condition_display()}\n'
                f'Received by: {pod.received_by_name}\n'
                f'Please verify the delivery at {pod.generate_qr_url()}'
            ),
            severity='HIGH',
            related_url=f'/shipments/{shipment.tracking_number}',
        )
