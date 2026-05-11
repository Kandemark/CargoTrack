"""
domains/_tenants.py — Tenant isolation and country-restriction tools.

Provides:
- ``TenantScopedModelViewSet`` — base ViewSet that auto-scopes querysets to
  the request tenant (organization).
- ``CountryRestrictedQueryset`` — mixin that scopes customs-related querysets
  by the user's licensed country.
- ``CarrierLegVisibility`` — mixin for multi-leg carrier shipment visibility
  (future-proof; currently scopes to primary carrier).
- ``normalize_country_fields()`` — management utility to rewrite free-text
  country fields to canonical EACountry codes.
"""

from __future__ import annotations

import logging
from typing import Optional

from django.db import models
from rest_framework import viewsets

from ._authz import get_user_role
from ._abac import EACountry

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# TenantScopedModelViewSet
# ═══════════════════════════════════════════════════════════════════════════════

class TenantScopedModelViewSet(viewsets.ModelViewSet):
    """Base ViewSet that automatically scopes querysets to the request tenant.

    Subclasses may set:

    - ``tenant_field``: the FK field name on the model that points to
      Organization (default ``"organization"``).
    - ``bypass_roles``: roles that bypass tenant scoping entirely
      (default ``{"ADMIN", "LOGISTICS_MGR"}``).

    If no tenant context is available on the request and the user is not
    in a bypass role, the queryset is returned unscoped — ABAC policies
    will handle the denial at the object level.
    """

    tenant_field: str = "organization"
    bypass_roles: set[str] = {"ADMIN", "LOGISTICS_MGR"}

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = get_user_role(user)

        if role in self.bypass_roles:
            return qs

        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id is None:
            return qs

        # Try the declared tenant_field
        if hasattr(qs.model, self.tenant_field):
            return qs.filter(**{f"{self.tenant_field}_id": tenant_id})

        # Probe common FK patterns for multi-tenant models
        for field_name in ('client__organization', 'shipment__client__organization'):
            if '__' in field_name:
                lookup = f"{field_name}_id"
            else:
                lookup = f"{field_name}_id"
            # Django supports __ lookups directly
            try:
                return qs.filter(**{f"{field_name}_id": tenant_id})
            except Exception:
                continue

        return qs


# ═══════════════════════════════════════════════════════════════════════════════
# CountryRestrictedQueryset
# ═══════════════════════════════════════════════════════════════════════════════

class CountryRestrictedQueryset:
    """Mixin that scopes querysets by the user's country.

    CUSTOMS_BROKER users see only declarations / shipments for their
    registered country.  Other roles are unaffected.
    """

    def scope_by_country(self, queryset: models.QuerySet) -> models.QuerySet:
        user = self.request.user
        role = get_user_role(user)

        if role != "CUSTOMS_BROKER":
            return queryset

        country = getattr(self.request, 'tenant_country', None)
        if country is None:
            return queryset

        # Resolve lazy object if needed
        if hasattr(country, '_wrapped'):
            try:
                country = country._wrapped if country._wrapped is not None else None
            except Exception:
                return queryset

        if country is None:
            return queryset

        # Probe for country-related fields on the model
        model = queryset.model
        for field_name in ('country_of_origin', 'country_code', 'country'):
            if hasattr(model, field_name):
                return queryset.filter(**{field_name: str(country)})

        return queryset


# ═══════════════════════════════════════════════════════════════════════════════
# CarrierLegVisibility
# ═══════════════════════════════════════════════════════════════════════════════

class CarrierLegVisibility:
    """Mixin for carrier-scoped shipment visibility.

    When multi-leg shipments are introduced, carriers will only see the
    leg(s) assigned to them.  Currently scopes to the primary carrier FK.
    """

    def scope_by_carrier_leg(self, queryset: models.QuerySet) -> models.QuerySet:
        user = self.request.user
        role = get_user_role(user)

        if role != "CARRIER":
            return queryset

        carrier_id = getattr(user, 'carrier_id', None)
        if carrier_id is None:
            # Try reverse relation
            try:
                carrier_id = user.carrier.id
            except Exception:
                return queryset

        # Primary carrier filter
        if hasattr(queryset.model, 'carrier_id'):
            qs = queryset.filter(carrier_id=carrier_id)
        elif hasattr(queryset.model, 'carrier'):
            qs = queryset.filter(carrier__id=carrier_id)
        else:
            return queryset

        # Future: also match leg assignments
        # if hasattr(queryset.model, 'legs'):
        #     qs = qs | queryset.filter(legs__carrier_id=carrier_id)

        return qs.distinct() if hasattr(queryset.model, 'legs') else qs


# ═══════════════════════════════════════════════════════════════════════════════
# Country Field Normalization
# ═══════════════════════════════════════════════════════════════════════════════

def normalize_country_fields(dry_run: bool = True) -> dict:
    """Normalize Organization.country and Carrier.country to EACountry codes.

    Returns a dict with counts of rows examined and changed.

    Usage::

        from domains._tenants import normalize_country_fields
        result = normalize_country_fields(dry_run=False)
        # {'organizations_checked': 15, 'organizations_changed': 2,
        #  'carriers_checked': 8, 'carriers_changed': 1}

    Can also be called from a management command for scheduled runs.
    """
    from accounts.models import Organization
    from carriers.models import Carrier

    result = {
        'organizations_checked': 0,
        'organizations_changed': 0,
        'carriers_checked': 0,
        'carriers_changed': 0,
    }

    for org in Organization.objects.all():
        result['organizations_checked'] += 1
        country = EACountry.from_string(org.country)
        if country and country.value != org.country:
            if not dry_run:
                org.country = country.value
                org.save(update_fields=['country'])
            result['organizations_changed'] += 1
            logger.info("Normalize org %s: %s → %s", org.slug, org.country if dry_run else f'... → {country.value}', country.value)

    for carrier in Carrier.objects.all():
        result['carriers_checked'] += 1
        country = EACountry.from_string(carrier.country)
        if country and country.value != carrier.country:
            if not dry_run:
                carrier.country = country.value
                carrier.save(update_fields=['country'])
            result['carriers_changed'] += 1
            logger.info("Normalize carrier %s: %s → %s", carrier.code, carrier.country if dry_run else f'... → {country.value}', country.value)

    return result


__all__ = [
    "TenantScopedModelViewSet",
    "CountryRestrictedQueryset",
    "CarrierLegVisibility",
    "normalize_country_fields",
]
