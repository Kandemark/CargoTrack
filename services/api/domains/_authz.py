"""
domains/_authz.py — Granular Authorization Layer for CargoTrack.

Logistics platforms require fine-grained permissions — a driver, a customs
broker, and a finance officer all interact with the same shipment but at
different points in its lifecycle with different privileges.

Design
~~~~~~
**Permission** (enum)          — 30+ granular permissions organised by domain.
**RolePermissions** (dict)     — Maps each role to its permission set.
**has_permission(user, perm)** — The single entry point for permission checks.
**HasPermission** (DRF class)  — Resource-level view permission.
**HasObjectPermission**        — Object-level (per-instance) permission mixin.
**Scoping mixins**             — Org / carrier / driver queryset filters.

Architecture
────────────
::

    Request → DRF Permission Class → has_permission(user, perm)
                                          │
                          ┌───────────────┴───────────────┐
                          │  roles.py (legacy constants)   │
                          │  CustomUser.Role (canonical)   │
                          │  Keycloak groups (when OIDC)   │
                          └───────────────────────────────┘

The permission enum is the single source of truth.  All role/permission
mappings are derived from it, making it easy to audit who can do what.
"""
from __future__ import annotations

import logging
from enum import Enum
from typing import Any, Optional

from django.db.models import QuerySet

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Permission Enum
# ═══════════════════════════════════════════════════════════════════════════════


class Permission(str, Enum):
    """Granular permissions, organised by domain.

    Naming convention: ``<domain>.<action>`` — e.g. ``shipments.create``.
    """

    # ── Shipments ────────────────────────────────────────────────────────
    SHIPMENTS_VIEW     = "shipments.view"       # List / retrieve shipments
    SHIPMENTS_CREATE   = "shipments.create"     # Create a new shipment
    SHIPMENTS_UPDATE   = "shipments.update"     # Modify shipment details
    SHIPMENTS_DELETE   = "shipments.delete"     # Cancel a shipment
    SHIPMENTS_DISPATCH = "shipments.dispatch"   # Assign truck + driver
    SHIPMENTS_TRACK    = "shipments.track"       # Log tracking events

    # ── Routes ───────────────────────────────────────────────────────────
    ROUTES_VIEW   = "routes.view"
    ROUTES_MANAGE = "routes.manage"

    # ── Contracts & Rates ────────────────────────────────────────────────
    RATES_VIEW      = "rates.view"
    RATES_MANAGE    = "rates.manage"
    CONTRACTS_VIEW  = "contracts.view"
    CONTRACTS_MANAGE = "contracts.manage"

    # ── Finance ──────────────────────────────────────────────────────────
    FINANCE_VIEW    = "finance.view"
    FINANCE_MANAGE  = "finance.manage"     # Create invoices, process payments
    FINANCE_APPROVE = "finance.approve"    # Approve payments / refunds

    # ── Customs & Borders ────────────────────────────────────────────────
    CUSTOMS_VIEW   = "customs.view"
    CUSTOMS_SUBMIT = "customs.submit"      # Lodge declarations
    CUSTOMS_CLEAR  = "customs.clear"       # Clear through customs

    # ── Fleet ────────────────────────────────────────────────────────────
    FLEET_VIEW   = "fleet.view"
    FLEET_MANAGE = "fleet.manage"          # Manage trucks & drivers
    FLEET_ASSIGN = "fleet.assign"          # Assign to shipments

    # ── Port Operations ──────────────────────────────────────────────────
    PORTS_VIEW   = "ports.view"
    PORTS_MANAGE = "ports.manage"          # Track containers, manage demurrage

    # ── Cold Chain ───────────────────────────────────────────────────────
    COLDCHAIN_VIEW   = "coldchain.view"
    COLDCHAIN_MANAGE = "coldchain.manage"  # Configure monitoring

    # ── Documents ────────────────────────────────────────────────────────
    DOCUMENTS_VIEW   = "documents.view"
    DOCUMENTS_UPLOAD = "documents.upload"  # Upload + OCR extraction
    DOCUMENTS_VERIFY = "documents.verify"  # POD verification

    # ── Analytics ────────────────────────────────────────────────────────
    ANALYTICS_VIEW   = "analytics.view"
    ANALYTICS_EXPORT = "analytics.export"

    # ── Communications ───────────────────────────────────────────────────
    CHAT_SEND   = "chat.send"
    CHAT_MANAGE = "chat.manage"

    # ── Marketplace ──────────────────────────────────────────────────────
    MARKETPLACE_VIEW   = "marketplace.view"
    MARKETPLACE_BID    = "marketplace.bid"
    MARKETPLACE_MANAGE = "marketplace.manage"

    # ── Predictions ──────────────────────────────────────────────────────
    PREDICTIONS_VIEW = "predictions.view"

    # ── Administration ───────────────────────────────────────────────────
    ADMIN_USERS  = "admin.users"           # Create / disable users
    ADMIN_SYSTEM = "admin.system"          # System config, integrations
    ADMIN_AUDIT  = "admin.audit"           # View audit logs


# ═══════════════════════════════════════════════════════════════════════════════
# Role → Permission Mapping
# ═══════════════════════════════════════════════════════════════════════════════

# These align with ``accounts.models.CustomUser.Role``.
RolePermissions: dict[str, set[Permission]] = {
    # ── Full platform access ────────────────────────────────────────────
    "ADMIN": {
        Permission.SHIPMENTS_VIEW, Permission.SHIPMENTS_CREATE,
        Permission.SHIPMENTS_UPDATE, Permission.SHIPMENTS_DELETE,
        Permission.SHIPMENTS_DISPATCH, Permission.SHIPMENTS_TRACK,
        Permission.ROUTES_VIEW, Permission.ROUTES_MANAGE,
        Permission.RATES_VIEW, Permission.RATES_MANAGE,
        Permission.CONTRACTS_VIEW, Permission.CONTRACTS_MANAGE,
        Permission.FINANCE_VIEW, Permission.FINANCE_MANAGE, Permission.FINANCE_APPROVE,
        Permission.CUSTOMS_VIEW, Permission.CUSTOMS_SUBMIT, Permission.CUSTOMS_CLEAR,
        Permission.FLEET_VIEW, Permission.FLEET_MANAGE, Permission.FLEET_ASSIGN,
        Permission.PORTS_VIEW, Permission.PORTS_MANAGE,
        Permission.COLDCHAIN_VIEW, Permission.COLDCHAIN_MANAGE,
        Permission.DOCUMENTS_VIEW, Permission.DOCUMENTS_UPLOAD, Permission.DOCUMENTS_VERIFY,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT, Permission.PREDICTIONS_VIEW,
        Permission.CHAT_SEND, Permission.CHAT_MANAGE,
        Permission.MARKETPLACE_VIEW, Permission.MARKETPLACE_BID, Permission.MARKETPLACE_MANAGE,
        Permission.ADMIN_USERS, Permission.ADMIN_SYSTEM, Permission.ADMIN_AUDIT,
    },

    # ── Logistics Manager ────────────────────────────────────────────────
    "LOGISTICS_MGR": {
        Permission.SHIPMENTS_VIEW, Permission.SHIPMENTS_CREATE,
        Permission.SHIPMENTS_UPDATE, Permission.SHIPMENTS_DISPATCH,
        Permission.SHIPMENTS_TRACK,
        Permission.ROUTES_VIEW,
        Permission.RATES_VIEW,
        Permission.CONTRACTS_VIEW, Permission.CONTRACTS_MANAGE,
        Permission.FINANCE_VIEW,
        Permission.CUSTOMS_VIEW, Permission.CUSTOMS_SUBMIT,
        Permission.FLEET_VIEW, Permission.FLEET_MANAGE, Permission.FLEET_ASSIGN,
        Permission.PORTS_VIEW,
        Permission.COLDCHAIN_VIEW, Permission.COLDCHAIN_MANAGE,
        Permission.DOCUMENTS_VIEW, Permission.DOCUMENTS_UPLOAD,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT, Permission.PREDICTIONS_VIEW,
        Permission.CHAT_SEND, Permission.CHAT_MANAGE,
        Permission.MARKETPLACE_VIEW, Permission.MARKETPLACE_MANAGE,
    },

    # ── Dispatcher ───────────────────────────────────────────────────────
    "DISPATCHER": {
        Permission.SHIPMENTS_VIEW, Permission.SHIPMENTS_CREATE,
        Permission.SHIPMENTS_UPDATE, Permission.SHIPMENTS_DISPATCH,
        Permission.SHIPMENTS_TRACK,
        Permission.ROUTES_VIEW,
        Permission.RATES_VIEW, Permission.CONTRACTS_VIEW,
        Permission.FLEET_VIEW, Permission.FLEET_ASSIGN,
        Permission.ANALYTICS_VIEW, Permission.PREDICTIONS_VIEW,
        Permission.CHAT_SEND,
        Permission.MARKETPLACE_VIEW,
    },

    # ── Client / Shipper ─────────────────────────────────────────────────
    "CLIENT": {
        Permission.SHIPMENTS_VIEW, Permission.SHIPMENTS_CREATE,
        Permission.ROUTES_VIEW,
        Permission.RATES_VIEW, Permission.CONTRACTS_VIEW,
        Permission.FINANCE_VIEW,
        Permission.CUSTOMS_VIEW,
        Permission.PORTS_VIEW,
        Permission.COLDCHAIN_VIEW,
        Permission.ANALYTICS_VIEW, Permission.PREDICTIONS_VIEW,
        Permission.CHAT_SEND,
        Permission.MARKETPLACE_VIEW, Permission.MARKETPLACE_MANAGE,
    },

    # ── Carrier ──────────────────────────────────────────────────────────
    "CARRIER": {
        Permission.SHIPMENTS_VIEW, Permission.SHIPMENTS_TRACK,
        Permission.ROUTES_VIEW,
        Permission.RATES_VIEW, Permission.RATES_MANAGE,
        Permission.CONTRACTS_VIEW,
        Permission.FINANCE_VIEW,
        Permission.CUSTOMS_VIEW,
        Permission.FLEET_VIEW, Permission.FLEET_MANAGE,
        Permission.PORTS_VIEW,
        Permission.COLDCHAIN_VIEW,
        Permission.ANALYTICS_VIEW, Permission.PREDICTIONS_VIEW,
        Permission.CHAT_SEND,
        Permission.MARKETPLACE_VIEW, Permission.MARKETPLACE_BID,
    },

    # ── Driver ───────────────────────────────────────────────────────────
    "DRIVER": {
        Permission.SHIPMENTS_VIEW, Permission.SHIPMENTS_TRACK,
        Permission.DOCUMENTS_VIEW, Permission.DOCUMENTS_UPLOAD,
        Permission.CHAT_SEND,
    },

    # ── Customs Broker ───────────────────────────────────────────────────
    "CUSTOMS_BROKER": {
        Permission.SHIPMENTS_VIEW,
        Permission.RATES_VIEW,
        Permission.CUSTOMS_VIEW, Permission.CUSTOMS_SUBMIT,
        Permission.CUSTOMS_CLEAR,
        Permission.ANALYTICS_VIEW, Permission.PREDICTIONS_VIEW,
        Permission.CHAT_SEND,
        Permission.MARKETPLACE_VIEW,
    },

    # ── Warehouse Manager ────────────────────────────────────────────────
    "WAREHOUSE_MGR": {
        Permission.SHIPMENTS_VIEW, Permission.SHIPMENTS_CREATE,
        Permission.SHIPMENTS_DISPATCH,
        Permission.FLEET_VIEW,
        Permission.COLDCHAIN_VIEW, Permission.COLDCHAIN_MANAGE,
        Permission.DOCUMENTS_VIEW, Permission.DOCUMENTS_UPLOAD,
        Permission.DOCUMENTS_VERIFY,
        Permission.ANALYTICS_VIEW, Permission.PREDICTIONS_VIEW,
        Permission.CHAT_SEND,
        Permission.MARKETPLACE_VIEW,
    },

    # ── Port Agent ───────────────────────────────────────────────────────
    "PORT_AGENT": {
        Permission.SHIPMENTS_VIEW, Permission.SHIPMENTS_TRACK,
        Permission.RATES_VIEW,
        Permission.CUSTOMS_VIEW, Permission.CUSTOMS_SUBMIT,
        Permission.PORTS_VIEW, Permission.PORTS_MANAGE,
        Permission.ANALYTICS_VIEW, Permission.PREDICTIONS_VIEW,
        Permission.CHAT_SEND,
    },

    # ── Finance Officer ──────────────────────────────────────────────────
    "FINANCE_OFFICER": {
        Permission.SHIPMENTS_VIEW,
        Permission.RATES_VIEW,
        Permission.CONTRACTS_VIEW,
        Permission.FINANCE_VIEW, Permission.FINANCE_MANAGE,
        Permission.ANALYTICS_VIEW, Permission.PREDICTIONS_VIEW,
        Permission.CHAT_SEND,
        Permission.MARKETPLACE_VIEW,
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# Permission Checker
# ═══════════════════════════════════════════════════════════════════════════════


def get_user_role(user: Any) -> str:
    """Extract the canonical role string from a user object, robustly.

    Handles Django User, AnonymousUser, and the case where ``role`` is a
    TextChoices instance rather than a plain string.
    """
    if user is None or not user.is_authenticated:
        return ""

    role = getattr(user, "role", None)
    if role is None:
        return ""
    # CustomUser.Role is a TextChoices — get the value, not the instance
    return str(getattr(role, "value", role))


def get_permissions_for_user(user: Any) -> set[Permission]:
    """Return the set of Permissions granted to a user based on their role."""
    role = get_user_role(user)
    return RolePermissions.get(role, set())


def has_permission(user: Any, permission: Permission) -> bool:
    """Check whether *user* holds *permission*.

    Usage::

        from domains._authz import Permission, has_permission

        if not has_permission(request.user, Permission.SHIPMENTS_CREATE):
            return Response(status=403)

    Superusers always get everything (Django admin escape hatch).
    """
    if user is None or not user.is_authenticated:
        return False
    if getattr(user, "is_superuser", False):
        return True
    if getattr(user, "is_staff", False) and getattr(user, "is_admin", False):
        return True

    return permission in get_permissions_for_user(user)


def require_permission(permission: Permission):
    """Decorator for function-based views — raises 403 if user lacks permission.

    Usage::

        @require_permission(Permission.SHIPMENTS_CREATE)
        def create_shipment_view(request):
            ...
    """
    from functools import wraps

    from django.http import HttpResponseForbidden

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not has_permission(request.user, permission):
                return HttpResponseForbidden(
                    f"Permission denied: {permission.value}"
                )
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def assert_permission(user: Any, permission: Permission) -> None:
    """Raise ``PermissionError`` if *user* lacks *permission*.

    For use in domain services (not views)::

        from domains._authz import Permission, assert_permission
        assert_permission(user, Permission.RATES_MANAGE)
        # ... update rate card ...
    """
    if not has_permission(user, permission):
        raise PermissionError(
            f"User lacks permission: {permission.value}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# DRF Permission Classes
# ═══════════════════════════════════════════════════════════════════════════════


class HasPermission:
    """DRF permission class — grants access if user holds *any* listed permission.

    Usage::

        class CreateShipmentView(APIView):
            permission_classes = [HasPermission(Permission.SHIPMENTS_CREATE)]

        class FinanceView(APIView):
            permission_classes = [
                HasPermission(Permission.FINANCE_VIEW, Permission.FINANCE_MANAGE),
            ]
    """

    def __init__(self, *permissions: Permission):
        self._permissions = permissions

    def __call__(self):
        # DRF expects permission_classes to be instantiated
        return self

    def has_permission(self, request, _view) -> bool:
        return any(
            has_permission(request.user, p) for p in self._permissions
        )

    def has_object_permission(self, _request, _view, _obj) -> bool:
        # Default: same as resource-level.  Override for object-level.
        return True  # Defer to scoping mixins


class HasObjectPermission:
    """Mixin that uses the ABAC engine for object-level permission checks.

    The view must set ``resource_type`` as a class attribute::

        class ShipmentDetailView(HasObjectPermission, APIView):
            resource_type = "shipment"
            permission_classes = [HasPermission(Permission.SHIPMENTS_VIEW)]

    If ``resource_type`` is not set, the check is delegated to
    ``check_object_permission(self, request, obj)`` which subclasses
    can override for custom logic.
    """

    resource_type: str = ""

    def check_object_permission(self, request, obj) -> bool:
        if not self.resource_type:
            return True

        import logging
        logger = logging.getLogger(__name__)

        try:
            from ._abac import (
                extract_subject_attributes,
                extract_resource_attributes,
                extract_environment_attributes,
                default_engine,
            )

            subject = extract_subject_attributes(request.user)
            resource = extract_resource_attributes(obj, self.resource_type)
            environment = extract_environment_attributes(request)

            decision = default_engine.evaluate(subject, resource, environment)

            if not decision.allowed:
                logger.warning(
                    "ABAC object denial: user=%d resource=%s/%d policy=%s reason=%s",
                    request.user.pk, self.resource_type,
                    getattr(obj, 'pk', 0),
                    decision.matched_policy, decision.reason,
                )

                if "AUDIT_LOG" in decision.obligations:
                    try:
                        from accounts.models import AuditEntry
                        AuditEntry.objects.create(
                            user=request.user if request.user.is_authenticated else None,
                            action='ACCESS_DENIED',
                            resource=f'{self.resource_type}/{getattr(obj, "pk", "?")}',
                            description=f'ABAC: {decision.reason}',
                            ip_address=request.META.get('REMOTE_ADDR', ''),
                            result='FAILURE',
                            metadata={
                                'policy': decision.matched_policy,
                                'reason': decision.reason,
                                'obligations': list(decision.obligations),
                            },
                        )
                    except Exception:
                        logger.exception("Failed to write ABAC denial audit entry")

            return decision.allowed

        except Exception:
            import logging
            logger = logging.getLogger(__name__)
            logger.exception(
                "ABAC evaluation failed for %s/%s",
                self.resource_type, getattr(obj, 'pk', 0),
            )
            return False


# ═══════════════════════════════════════════════════════════════════════════════
# Queryset Scoping Mixins (Multi-Tenant Object-Level)
# ═══════════════════════════════════════════════════════════════════════════════


class OrgScopedQueryset:
    """Scope querysets to the user's organisation.

    For use in ``get_queryset()``::

        class ShipmentListView(OrgScopedQueryset, ListAPIView):
            def get_queryset(self):
                return self.scope_by_org(Shipment.objects.all())
    """

    def scope_by_org(self, queryset: QuerySet) -> QuerySet:
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()

        role = get_user_role(user)
        # Admin and logistics managers see everything
        if role in ("ADMIN", "LOGISTICS_MGR"):
            return queryset

        org_id = getattr(user, "organization_id", None)
        if org_id:
            # Try common FK names
            if hasattr(queryset.model, "client"):
                return queryset.filter(client__organization_id=org_id)
            if hasattr(queryset.model, "organization"):
                return queryset.filter(organization_id=org_id)
            if hasattr(queryset.model, "client_id"):
                # Filter by clients in the same org
                from accounts.models import CustomUser
                org_client_ids = CustomUser.objects.filter(
                    organization_id=org_id,
                ).values_list("id", flat=True)
                return queryset.filter(client_id__in=org_client_ids)

        return queryset


class CarrierScopedQueryset:
    """Scope querysets to the user's carrier.

    Carrier users can only see shipments / rate cards belonging to their carrier.
    """

    def scope_by_carrier(self, queryset: QuerySet) -> QuerySet:
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()

        role = get_user_role(user)
        if role in ("ADMIN", "LOGISTICS_MGR", "DISPATCHER"):
            return queryset

        if role == "CARRIER":
            carrier_id = getattr(user, "carrier_id", None)
            if carrier_id:
                if hasattr(queryset.model, "carrier"):
                    return queryset.filter(carrier_id=carrier_id)
                if hasattr(queryset.model, "carrier_id"):
                    return queryset.filter(carrier_id=carrier_id)

        return queryset


class DriverScopedQueryset:
    """Scope querysets to the driver's own assignments."""

    def scope_by_driver(self, queryset: QuerySet) -> QuerySet:
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()

        role = get_user_role(user)
        if role == "DRIVER":
            if hasattr(queryset.model, "assigned_driver"):
                return queryset.filter(assigned_driver__user_id=user.id)
            if hasattr(queryset.model, "assigned_driver_id"):
                return queryset.filter(assigned_driver_id=user.driver_profile_id)

        return queryset


# ═══════════════════════════════════════════════════════════════════════════════
# Shortcut — per-resource permission classes (pre-built for URL router)
# ═══════════════════════════════════════════════════════════════════════════════

CanViewShipments     = HasPermission(Permission.SHIPMENTS_VIEW)
CanCreateShipments   = HasPermission(Permission.SHIPMENTS_CREATE)
CanUpdateShipments   = HasPermission(Permission.SHIPMENTS_UPDATE)
CanDispatchShipments = HasPermission(Permission.SHIPMENTS_DISPATCH)
CanDeleteShipments   = HasPermission(Permission.SHIPMENTS_DELETE)
CanTrackShipments    = HasPermission(Permission.SHIPMENTS_TRACK)

CanViewRates      = HasPermission(Permission.RATES_VIEW)
CanManageRates    = HasPermission(Permission.RATES_MANAGE)
CanManageRoutes   = HasPermission(Permission.ROUTES_MANAGE)
CanViewContracts  = HasPermission(Permission.CONTRACTS_VIEW)
CanManageContracts = HasPermission(Permission.CONTRACTS_MANAGE)

CanViewFinance     = HasPermission(Permission.FINANCE_VIEW)
CanManageFinance   = HasPermission(Permission.FINANCE_MANAGE)
CanApproveFinance  = HasPermission(Permission.FINANCE_APPROVE)

CanViewCustoms     = HasPermission(Permission.CUSTOMS_VIEW)
CanSubmitCustoms   = HasPermission(Permission.CUSTOMS_SUBMIT)
CanClearCustoms    = HasPermission(Permission.CUSTOMS_CLEAR)

CanViewFleet       = HasPermission(Permission.FLEET_VIEW)
CanManageFleet     = HasPermission(Permission.FLEET_MANAGE)
CanAssignFleet     = HasPermission(Permission.FLEET_ASSIGN)

CanViewPorts       = HasPermission(Permission.PORTS_VIEW)
CanManagePorts     = HasPermission(Permission.PORTS_MANAGE)

CanViewColdChain   = HasPermission(Permission.COLDCHAIN_VIEW)
CanManageColdChain = HasPermission(Permission.COLDCHAIN_MANAGE)

CanViewDocuments   = HasPermission(Permission.DOCUMENTS_VIEW)
CanUploadDocuments = HasPermission(Permission.DOCUMENTS_UPLOAD)
CanVerifyDocuments = HasPermission(Permission.DOCUMENTS_VERIFY)

CanViewAnalytics   = HasPermission(Permission.ANALYTICS_VIEW)
CanExportAnalytics = HasPermission(Permission.ANALYTICS_EXPORT)

CanSendChat    = HasPermission(Permission.CHAT_SEND)
CanManageChat  = HasPermission(Permission.CHAT_MANAGE)

CanViewMarketplace   = HasPermission(Permission.MARKETPLACE_VIEW)
CanBidMarketplace    = HasPermission(Permission.MARKETPLACE_BID)
CanManageMarketplace = HasPermission(Permission.MARKETPLACE_MANAGE)

CanViewPredictions = HasPermission(Permission.PREDICTIONS_VIEW)

CanAdministerUsers   = HasPermission(Permission.ADMIN_USERS)
CanAdministerSystem  = HasPermission(Permission.ADMIN_SYSTEM)
CanViewAudit         = HasPermission(Permission.ADMIN_AUDIT)


# ═══════════════════════════════════════════════════════════════════════════════
# Permission audit helper
# ═══════════════════════════════════════════════════════════════════════════════

def audit_user_permissions(user: Any) -> dict:
    """Return a complete map of what *user* can do.

    Useful for the frontend to conditionally render UI elements.
    """
    perms = get_permissions_for_user(user)
    return {
        perm.value: True for perm in Permission
        if perm in perms
    }


def audit_all_role_permissions() -> dict[str, list[str]]:
    """Return every role → sorted list of permission strings.  For debugging."""
    return {
        role: sorted(p.value for p in perms)
        for role, perms in sorted(RolePermissions.items())
    }
