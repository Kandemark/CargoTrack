"""
accounts/models.py
Custom user model and profile model for CargoTrack.

OOP:
    - Encapsulation: user role and permissions bundled in CustomUser.
    - Composition:   UserProfile extends CustomUser via OneToOneField,
                     adding the RBAC role from cargotrack.roles.UserRole.
"""
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models


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
        ADMIN         = "ADMIN",         "Administrator"
        LOGISTICS_MGR = "LOGISTICS_MGR", "Logistics Manager"
        CLIENT        = "CLIENT",        "Client / Shipper"
        CARRIER       = "CARRIER",       "Carrier / Driver"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CLIENT,
    )
    phone = models.CharField(max_length=20, blank=True)
    company = models.CharField(max_length=120, blank=True)
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

    def can_create_shipments(self) -> bool:
        """Return True if user is allowed to create shipments."""
        return self.role in (self.Role.ADMIN, self.Role.LOGISTICS_MGR)

    def can_log_events(self) -> bool:
        """Return True if user is allowed to log tracking events."""
        return self.role in (self.Role.ADMIN, self.Role.LOGISTICS_MGR, self.Role.CARRIER)

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
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.user.username}"

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"
