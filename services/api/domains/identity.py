"""
Domain: Identity & Notifications
─────────────────────────────────
User accounts, authentication (JWT via SimpleJWT + Keycloak OIDC), role-based
access control, notification delivery, and alert management.

Aggregate Roots
~~~~~~~~~~~~~~~
**User** (``accounts.models.User``)
    Custom user model with EAC-specific profile fields.

    Invariants:
    - ``email`` is unique (used as username).
    - Every user has exactly one role (shipper, carrier_admin, driver, etc.).
    - A user's organization determines data visibility (multi-tenant).

**Alert** (``alerts.models.Alert``)
    A triggered alert on a shipment (delay, excursion, geo-fence breach, etc.).

    Invariants:
    - Every alert references exactly one shipment.
    - ``risk_score`` ∈ [0.0, 1.0].
    - An alert must be acknowledged before it can be resolved.

Owns
~~~~
- ``accounts``            Django app — CustomUser, JWT views, notifications
- ``alerts``              Django app — Alert + Notification models

Depends on
~~~~~~~~~~
- ``domains.shipments``   Shipment FK on alerts & notifications
- (Keycloak)              External OIDC provider (planned)
"""

from accounts.api_views import (
    AuditEntryCreateView,
    AuditEntryListView,
    IntegrationDetailView,
    IntegrationListView,
    NotificationDismissView,
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
)

__all__ = [
    "AuditEntryCreateView",
    "AuditEntryListView",
    "IntegrationDetailView",
    "IntegrationListView",
    "NotificationDismissView",
    "NotificationListView",
    "NotificationMarkAllReadView",
    "NotificationMarkReadView",
]
