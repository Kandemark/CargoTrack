"""
shipments/models.py
Core domain models for CargoTrack.

OOP Concepts demonstrated:
    - Encapsulation: each model bundles its data fields and behaviour methods.
    - Composition:   Shipment HAS-A Route (FK relationship).
    - Association:   status choices define the shipment lifecycle state machine.
"""
from django.conf import settings
from django.db import models


class Route(models.Model):
    """
    Represents a named origin-to-destination path that shipments travel.

    Composed inside Shipment as a ForeignKey, allowing multiple shipments
    to share the same physical route.
    """

    origin           = models.CharField(max_length=100)
    destination      = models.CharField(max_length=100)
    distance_km      = models.FloatField()
    estimated_hours  = models.FloatField()
    created_at       = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.origin} → {self.destination}"

    class Meta:
        ordering = ["origin", "destination"]


class Shipment(models.Model):
    """
    Central domain model representing a cargo shipment in transit.

    OOP:
        - Encapsulation: all cargo data and lifecycle state in one class.
        - Composition:   owns a Route via ForeignKey.
        - State machine: status and dispatch_status fields define dual state machines.
    """

    STATUS_CHOICES = [
        ('PENDING',    'Pending'),
        ('IN_TRANSIT', 'In Transit'),
        ('CUSTOMS',    'Customs'),
        ('DELIVERED',  'Delivered'),
        ('DELAYED',    'Delayed'),
    ]

    DISPATCH_STATUS_CHOICES = [
        ('UNASSIGNED', 'Unassigned'),
        ('OFFERED',    'Offered'),
        ('ACCEPTED',   'Accepted'),
        ('DISPATCHED', 'Dispatched'),
    ]

    tracking_number      = models.CharField(max_length=20, unique=True)
    route                = models.ForeignKey(
        Route, on_delete=models.CASCADE, related_name='shipments',
    )
    status               = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING',
    )
    dispatch_status      = models.CharField(
        max_length=20, choices=DISPATCH_STATUS_CHOICES, default='UNASSIGNED',
    )
    carrier_name         = models.CharField(max_length=100, blank=True)  # deprecated — kept for migration
    carrier              = models.ForeignKey(
        'carriers.Carrier', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='shipments',
    )
    assigned_truck       = models.ForeignKey(
        'fleet.Truck', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='shipments',
    )
    assigned_driver      = models.ForeignKey(
        'fleet.Driver', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='shipments',
    )
    weight_kg            = models.FloatField()
    scheduled_departure  = models.DateTimeField()
    scheduled_arrival    = models.DateTimeField()
    actual_departure     = models.DateTimeField(null=True, blank=True)
    actual_arrival       = models.DateTimeField(null=True, blank=True)
    client               = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='client_shipments',
    )
    delay_risk_score     = models.FloatField(default=0.0)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.tracking_number

    def save(self, *args, **kwargs):
        # Sync carrier_name for backward compatibility
        if self.carrier and not self.carrier_name:
            self.carrier_name = self.carrier.name
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tracking_number"]),
            models.Index(fields=["status"]),
            models.Index(fields=["dispatch_status"]),
        ]


class Document(models.Model):
    """Shipment-linked document (bill of lading, customs declaration, etc.)."""

    DOC_TYPES = [
        ('BOL',         'Bill of Lading'),
        ('CUSTOMS',     'Customs Declaration'),
        ('PACKING',     'Packing List'),
        ('INSURANCE',   'Insurance Certificate'),
        ('OTHER',       'Other'),
    ]

    shipment    = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='documents')
    file        = models.FileField(upload_to='shipment_docs/%Y/%m/')
    doc_type    = models.CharField(max_length=20, choices=DOC_TYPES, default='OTHER')
    filename    = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name='uploaded_documents',
    )
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.filename and self.file:
            self.filename = self.file.name.split('/')[-1]
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.get_doc_type_display()} — {self.shipment.tracking_number}'


class ComplianceDoc(models.Model):
    DOC_TYPE_CHOICES = [
        ('CERTIFICATE',   'Certificate of Origin'),
        ('PERMIT',        'Import/Export Permit'),
        ('DECLARATION',   'Customs Declaration'),
        ('INVOICE',       'Commercial Invoice'),
        ('MANIFEST',      'Cargo Manifest'),
        ('PHYTOSANITARY', 'Phytosanitary Certificate'),
        ('INSURANCE',     'Insurance Certificate'),
        ('OTHER',         'Other'),
    ]
    STATUS_CHOICES = [
        ('VALID',    'Valid'),
        ('EXPIRED',  'Expired'),
        ('EXPIRING', 'Expiring Soon'),
        ('MISSING',  'Missing'),
        ('PENDING',  'Pending'),
    ]

    shipment    = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='compliance_docs')
    doc_type    = models.CharField(max_length=20, choices=DOC_TYPE_CHOICES)
    reference   = models.CharField(max_length=200, blank=True)
    issued_by   = models.CharField(max_length=200, blank=True)
    issued_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    is_required = models.BooleanField(default=True)
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    notes       = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_doc_type_display()} — {self.shipment.tracking_number}'


class DocumentExtraction(models.Model):
    """
    OCR extraction result for a shipment document.

    Stores the raw OCR text, classified document type, confidence scores,
    and structured extracted fields (JSON). Linked to the Document model
    so extraction can be re-run without re-uploading.
    """
    document = models.OneToOneField(
        Document, on_delete=models.CASCADE, related_name='extraction',
    )
    doc_type = models.CharField(max_length=20, choices=Document.DOC_TYPES)
    type_confidence = models.FloatField(default=0.0)
    ocr_confidence = models.FloatField(default=0.0)
    raw_text = models.TextField(blank=True)
    extracted_fields = models.JSONField(default=dict, blank=True)
    suggested_review = models.BooleanField(default=False)
    matched_keywords = models.JSONField(default=list, blank=True)
    processing_time_ms = models.FloatField(default=0.0)
    word_count = models.IntegerField(default=0)
    page_count = models.IntegerField(default=1)
    preprocess_steps = models.JSONField(default=list, blank=True)
    error_message = models.TextField(blank=True)

    # Allow re-extraction with different settings
    tesseract_lang = models.CharField(max_length=20, default='eng')
    extracted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-extracted_at']
        verbose_name = 'Document Extraction'
        verbose_name_plural = 'Document Extractions'

    def __str__(self):
        return f'OCR — {self.get_doc_type_display()} ({self.type_confidence:.0%})'

    @property
    def is_high_confidence(self) -> bool:
        return self.type_confidence >= 0.7 and self.ocr_confidence >= 60
