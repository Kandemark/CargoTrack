"""
accounts/models.py
Custom user model and profile model for CargoTrack.

OOP:
    - Encapsulation: user role and permissions bundled in CustomUser.
    - Composition:   UserProfile extends CustomUser via OneToOneField,
                     adding the RBAC role from cargotrack.roles.UserRole.
"""
import hashlib
import secrets

from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models

from cargotrack.encryption import EncryptedTextField


class CustomUser(AbstractUser):
    """
    Extended user model with CargoTrack-specific roles.

    Roles:
        ADMIN           — full system access
        LOGISTICS_MGR   — create/manage shipments, assign carriers
        CLIENT          — read-only tracking access
        CARRIER         — log tracking events for assigned shipments
    """

    class Role(models.TextChoices):
        ADMIN           = "ADMIN",           "Administrator"
        LOGISTICS_MGR   = "LOGISTICS_MGR",   "Logistics Manager"
        CLIENT          = "CLIENT",          "Client / Shipper"
        CARRIER         = "CARRIER",         "Carrier / Driver"
        DISPATCHER      = "DISPATCHER",      "Dispatcher"
        CUSTOMS_BROKER  = "CUSTOMS_BROKER",  "Customs Broker"
        WAREHOUSE_MGR   = "WAREHOUSE_MGR",   "Warehouse Manager"
        PORT_AGENT      = "PORT_AGENT",      "Port Agent"
        FINANCE_OFFICER = "FINANCE_OFFICER", "Finance Officer"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CLIENT,
    )
    phone = EncryptedTextField(max_length=20, blank=True)
    organization = models.ForeignKey(
        'Organization', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='members',
    )
    onboarding_completed = models.BooleanField(default=False)
    totp_secret = EncryptedTextField(max_length=64, blank=True)
    totp_enabled = models.BooleanField(default=False)
    totp_backup_codes = models.JSONField(default=list, blank=True)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # ── role helpers ──────────────────────────────────────────────────────────

    @property
    def is_admin(self) -> bool:
        """Return True if user has ADMIN role."""
        return self.role == self.Role.ADMIN

    @property
    def is_logistics_manager(self) -> bool:
        """Return True if user has LOGISTICS_MGR role."""
        return self.role == self.Role.LOGISTICS_MGR

    @property
    def is_client(self) -> bool:
        """Return True if user has CLIENT role."""
        return self.role == self.Role.CLIENT

    @property
    def is_carrier(self) -> bool:
        """Return True if user has CARRIER role."""
        return self.role == self.Role.CARRIER

    @property
    def is_dispatcher(self) -> bool:
        """Return True if user has DISPATCHER role."""
        return self.role == self.Role.DISPATCHER

    @property
    def is_customs_broker(self) -> bool:
        """Return True if user has CUSTOMS_BROKER role."""
        return self.role == self.Role.CUSTOMS_BROKER

    @property
    def is_warehouse_manager(self) -> bool:
        """Return True if user has WAREHOUSE_MGR role."""
        return self.role == self.Role.WAREHOUSE_MGR

    @property
    def is_port_agent(self) -> bool:
        """Return True if user has PORT_AGENT role."""
        return self.role == self.Role.PORT_AGENT

    @property
    def is_finance_officer(self) -> bool:
        """Return True if user has FINANCE_OFFICER role."""
        return self.role == self.Role.FINANCE_OFFICER

    def can_create_shipments(self) -> bool:
        """Return True if user is allowed to create shipments."""
        return self.role in (
            self.Role.ADMIN, self.Role.LOGISTICS_MGR,
            self.Role.DISPATCHER, self.Role.WAREHOUSE_MGR,
        )

    def can_log_events(self) -> bool:
        """Return True if user is allowed to log tracking events."""
        return self.role in (
            self.Role.ADMIN, self.Role.LOGISTICS_MGR,
            self.Role.CARRIER, self.Role.DISPATCHER, self.Role.PORT_AGENT,
        )

    def can_manage_finances(self) -> bool:
        """Return True if user is allowed to manage invoices and payments."""
        return self.role in (
            self.Role.ADMIN, self.Role.FINANCE_OFFICER, self.Role.LOGISTICS_MGR,
        )

    def can_clear_customs(self) -> bool:
        """Return True if user is allowed to process customs clearance."""
        return self.role in (
            self.Role.ADMIN, self.Role.CUSTOMS_BROKER, self.Role.PORT_AGENT,
        )

    @property
    def is_locked_out(self) -> bool:
        """Return True if the account is temporarily locked due to failed attempts."""
        if not self.locked_until:
            return False
        from django.utils import timezone
        if timezone.now() >= self.locked_until:
            self.failed_login_attempts = 0
            self.locked_until = None
            self.save(update_fields=['failed_login_attempts', 'locked_until'])
            return False
        return True

    def record_failed_login(self):
        """Increment failed attempt counter; lock account at threshold."""
        MAX_ATTEMPTS = 5
        LOCKOUT_MINUTES = 15
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= MAX_ATTEMPTS:
            from django.utils import timezone
            import datetime
            self.locked_until = timezone.now() + datetime.timedelta(minutes=LOCKOUT_MINUTES)
        self.save(update_fields=['failed_login_attempts', 'locked_until'])

    def clear_failed_logins(self):
        """Reset failed login counter after successful authentication."""
        if self.failed_login_attempts > 0 or self.locked_until is not None:
            self.failed_login_attempts = 0
            self.locked_until = None
            self.save(update_fields=['failed_login_attempts', 'locked_until'])

    def __str__(self) -> str:
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-date_joined"]


class UserProfile(models.Model):
    """
    One-to-one profile record attached to every CargoTrack user.

    Exists as an extension point for future profile fields. Role, phone,
    and company are stored directly on CustomUser to avoid duplication.

    Auto-created by accounts.signals.create_user_profile whenever a new
    User instance is saved.
    """

    user       = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    notification_prefs = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.user.username}"

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"


class APIKey(models.Model):
    """
    Per-user API key for programmatic access.

    The full key (ct_<48 hex chars>) is shown once on creation and never stored
    in plain text. Only the SHA-256 hash and a short display prefix are kept.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='api_keys',
    )
    name       = models.CharField(max_length=100)
    prefix     = models.CharField(max_length=8, db_index=True)
    hashed_key = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used  = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'API Key'
        verbose_name_plural = 'API Keys'

    def __str__(self) -> str:
        return f"{self.user.username} — {self.name} ({self.prefix}…)"

    @classmethod
    def generate(cls, user: 'CustomUser', name: str) -> tuple['APIKey', str]:
        raw    = f"ct_{secrets.token_hex(24)}"
        prefix = raw[:8]
        hashed = hashlib.sha256(raw.encode()).hexdigest()
        key    = cls.objects.create(user=user, name=name, prefix=prefix, hashed_key=hashed)
        return key, raw


class Notification(models.Model):
    TYPE_CHOICES = [
        ('ALERT',    'Alert'),
        ('SHIPMENT', 'Shipment'),
        ('PAYMENT',  'Payment'),
        ('SYSTEM',   'System'),
        ('SECURITY', 'Security'),
    ]
    SEVERITY_CHOICES = [
        ('HIGH',   'High'),
        ('MEDIUM', 'Medium'),
        ('LOW',    'Low'),
        ('INFO',   'Info'),
    ]

    user         = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='notifications', null=True, blank=True,
    )
    type         = models.CharField(max_length=20, choices=TYPE_CHOICES, default='SYSTEM')
    title        = models.CharField(max_length=300)
    message      = models.TextField()
    severity     = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='INFO')
    is_read      = models.BooleanField(default=False)
    is_dismissed = models.BooleanField(default=False)
    related_url  = models.CharField(max_length=500, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification'

    def __str__(self):
        return f'{self.type} — {self.title}'


class AuditEntry(models.Model):
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('LOGIN',  'Login'),
        ('EXPORT', 'Export'),
        ('VIEW',   'View'),
    ]
    RESULT_CHOICES = [
        ('SUCCESS', 'Success'),
        ('FAILURE', 'Failure'),
        ('WARNING', 'Warning'),
    ]

    user        = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='audit_entries',
    )
    action      = models.CharField(max_length=20, choices=ACTION_CHOICES)
    resource    = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    result      = models.CharField(max_length=10, choices=RESULT_CHOICES, default='SUCCESS')
    metadata    = models.JSONField(default=dict, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Audit Entry'
        verbose_name_plural = 'Audit Entries'

    def __str__(self):
        return f'{self.action} {self.resource} — {self.result}'


class Integration(models.Model):
    CATEGORY_CHOICES = [
        ('CUSTOMS',  'Customs'),
        ('PORT',     'Port'),
        ('CARRIER',  'Carrier'),
        ('PAYMENTS', 'Payments'),
        ('FINANCE',  'Finance'),
        ('MAPS',     'Maps'),
        ('COMMS',    'Communications'),
    ]
    STATUS_CHOICES = [
        ('CONNECTED',    'Connected'),
        ('DISCONNECTED', 'Disconnected'),
        ('ERROR',        'Error'),
    ]

    name          = models.CharField(max_length=200)
    category      = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DISCONNECTED')
    api_url       = models.URLField(blank=True)
    api_usage_pct = models.FloatField(default=0.0)
    has_webhook   = models.BooleanField(default=False)
    last_sync     = models.DateTimeField(null=True, blank=True)
    config        = models.JSONField(default=dict, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Integration'

    def __str__(self):
        return f'{self.name} ({self.category})'


class Organization(models.Model):
    """Company, carrier firm, brokerage, or independent operator."""
    ORG_TYPES = [
        ('FREIGHT_FORWARDER', 'Freight Forwarder'),
        ('CARRIER_COMPANY', 'Carrier Company'),
        ('SHIPPER', 'Shipper / Importer'),
        ('BROKERAGE', 'Customs Brokerage'),
        ('INDEPENDENT', 'Independent / Freelancer'),
    ]

    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=200, unique=True)
    org_type = models.CharField(max_length=20, choices=ORG_TYPES, default='SHIPPER')
    logo_url = models.URLField(blank=True)
    website = models.URLField(blank=True)
    address = models.TextField(blank=True)
    country = models.CharField(max_length=100, default='Kenya')
    tax_id = EncryptedTextField(max_length=50, blank=True)
    is_verified = models.BooleanField(default=False)
    invite_code = models.CharField(max_length=20, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Organization'
        verbose_name_plural = 'Organizations'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        if not self.invite_code:
            import secrets
            self.invite_code = secrets.token_hex(8).upper()
        super().save(*args, **kwargs)
