"""
cargotrack/permissions.py
Custom DRF permission classes based on the CustomUser.role field.

Usage in any APIView or ViewSet:
    from cargotrack.permissions import IsAdminUser, IsManagerUser, IsClientUser

Hierarchy (widest to narrowest):
    IsClientUser  — any authenticated user regardless of role
    IsManagerUser — LOGISTICS_MGR or ADMIN
    IsAdminUser   — ADMIN only
"""
from rest_framework.permissions import BasePermission

from accounts.models import CustomUser


class IsAdminUser(BasePermission):
    """
    Allow access only to users with the ADMIN role.

    Use this for system-level operations: bulk deletes, user management,
    configuration changes.
    """

    message = "Administrator access required."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == CustomUser.Role.ADMIN
        )


class IsManagerUser(BasePermission):
    """
    Allow access to LOGISTICS_MGR and ADMIN users.

    Use this for write operations on shipments, alerts, and routes:
    create/update shipments, assign carriers, acknowledge alerts.
    """

    message = "Logistics Manager or Administrator access required."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in (
                CustomUser.Role.ADMIN,
                CustomUser.Role.LOGISTICS_MGR,
            )
        )


class IsClientUser(BasePermission):
    """
    Allow access to any authenticated user (CLIENT, CARRIER, LOGISTICS_MGR, ADMIN).

    Use this for read-only endpoints and self-service actions (tracking lookups,
    viewing your own shipments, updating profile).
    """

    message = "Authentication required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
