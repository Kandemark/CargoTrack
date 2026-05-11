"""
Middleware — HTTP and WebSocket middleware for CargoTrack.

- ``TenantMiddleware`` — extracts organization context from JWT or user profile,
  attaches ``request.tenant_id``, ``request.tenant_country``, and
  ``request.tenant_org_type`` for downstream queryset scoping.

- ``WebSocketAuthMiddleware`` — JWT authentication for Channels WebSocket
  connections (query-string token).
"""

from __future__ import annotations

import logging
from urllib.parse import parse_qs

from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.utils.functional import SimpleLazyObject
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# HTTP Tenant Middleware
# ═══════════════════════════════════════════════════════════════════════════════

class TenantMiddleware:
    """Extracts tenant (organization) context from request and attaches it.

    Resolution order:
    1. JWT claim ``org_id`` (set by Keycloak or custom claims)
    2. ``request.user.organization_id`` (fallback for SimpleJWT dev mode)

    Attributes attached to ``request``:
    - ``request.tenant_id``          — int or None
    - ``request.tenant_country``     — EACountry or None
    - ``request.tenant_org_type``    — str or None

    Must be placed **after** ``AuthenticationMiddleware`` in the
    ``MIDDLEWARE`` list so that ``request.user`` is already resolved.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        self._resolve_tenant(request)
        return self.get_response(request)

    def _resolve_tenant(self, request):
        request.tenant_id = None
        request.tenant_country = None
        request.tenant_org_type = None

        # 1. Try JWT claim
        org_id = None
        if hasattr(request, 'auth') and request.auth:
            try:
                payload = request.auth.payload if hasattr(request.auth, 'payload') else request.auth
                org_id = payload.get('org_id')
            except Exception:
                pass

        # 2. Fall back to user.organization
        if not org_id and hasattr(request, 'user') and hasattr(request.user, 'is_authenticated') and request.user.is_authenticated:
            org_id = getattr(request.user, 'organization_id', None)

        if not org_id:
            return

        request.tenant_id = org_id

        # Resolve country / org_type from the database (lazy to avoid extra query
        # when not needed — downstream code accesses these attributes on demand).
        request._tenant_org_id = org_id
        request.tenant_country = SimpleLazyObject(lambda: self._resolve_country(org_id))
        request.tenant_org_type = SimpleLazyObject(lambda: self._resolve_org_type(org_id))

    @staticmethod
    def _resolve_country(org_id: int) -> str | None:
        try:
            from accounts.models import Organization
            org = Organization.objects.only('country').get(pk=org_id)
            from domains._abac import EACountry
            country = EACountry.from_string(org.country)
            return country.value if country else None
        except Exception:
            return None

    @staticmethod
    def _resolve_org_type(org_id: int) -> str | None:
        try:
            from accounts.models import Organization
            org = Organization.objects.only('org_type').get(pk=org_id)
            return org.org_type
        except Exception:
            return None


# ═══════════════════════════════════════════════════════════════════════════════
# WebSocket Auth Middleware (existing)
# ═══════════════════════════════════════════════════════════════════════════════


@database_sync_to_async
def get_user_from_token(token_str: str):
    """Validate JWT access token and return the user, or AnonymousUser."""
    try:
        token = AccessToken(token_str)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        return User.objects.get(id=token['user_id'])
    except (InvalidToken, TokenError, KeyError, Exception):
        return AnonymousUser()


class WebSocketAuthMiddleware(BaseMiddleware):
    """
    Extracts JWT token from WebSocket query string and populates scope['user'].

    Clients connect with:  ws://host/ws/notifications/?token=<jwt-access-token>
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        if token_list:
            scope['user'] = await get_user_from_token(token_list[0])
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)
