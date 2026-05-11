"""
cargotrack/async_cache.py — Async-compatible view caching.

Replaces django.views.decorators.cache.cache_page (WSGI-only) with
programmatic cache.get/set that works correctly under ASGI/Daphne.

Usage:

    # Function-based async view
    @async_cache(60)
    async def my_view(request):
        ...

    # Class-based view (mixin goes FIRST in MRO)
    class MyView(AsyncCacheMixin, APIView):
        cache_ttl = 120

        def get(self, request):
            return Response(data)

    # Sync function-based view
    @sync_cache(300)
    def my_sync_view(request):
        ...
"""

import functools
import hashlib
import json
import logging

from asgiref.sync import sync_to_async
from django.core.cache import cache
from django.http import HttpRequest, JsonResponse

logger = logging.getLogger(__name__)


def _build_cache_key(request: HttpRequest, prefix: str = "av") -> str:
    """Build a deterministic cache key from the request."""
    raw = f"{prefix}:{request.method}:{request.path}:{request.META.get('QUERY_STRING', '')}"
    if hasattr(request, 'user') and request.user and request.user.is_authenticated:
        raw += f":uid={request.user.id}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:40]
    return f"ct:async_view:{digest}"


def sync_cache(ttl: int):
    """
    Cache decorator for synchronous views.

    Unlike django's cache_page, this uses programmatic cache.get/set
    and works reliably under ASGI regardless of whether the view runs
    in the main thread or a thread pool.
    """
    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapper(request, *args, **kwargs):
            cache_key = _build_cache_key(request)
            cached = cache.get(cache_key)
            if cached is not None:
                return JsonResponse(cached, safe=False) if not isinstance(cached, (dict, list)) else cached

            response = view_func(request, *args, **kwargs)

            # Extract serializable data from DRF Response or JsonResponse
            data = response.data if hasattr(response, 'data') else response.content
            if hasattr(data, 'decode'):
                try:
                    data = json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    data = None

            if data is not None:
                cache.set(cache_key, data, timeout=ttl)
            return response
        return wrapper
    return decorator


def async_cache(ttl: int):
    """
    Cache decorator for async function-based views.

    Uses sync_to_async for cache operations since Django's cache
    backends are synchronous.
    """
    def decorator(view_func):
        @functools.wraps(view_func)
        async def wrapper(request, *args, **kwargs):
            cache_key = _build_cache_key(request)
            cached = await sync_to_async(cache.get)(cache_key)
            if cached is not None:
                if isinstance(cached, (dict, list)):
                    return JsonResponse(cached, safe=False)
                return JsonResponse(cached)

            response = await view_func(request, *args, **kwargs)

            data = response.data if hasattr(response, 'data') else response.content
            if hasattr(data, 'decode'):
                try:
                    data = json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    data = None

            if data is not None:
                await sync_to_async(cache.set)(cache_key, data, timeout=ttl)
            return response
        return wrapper
    return decorator


class AsyncCacheMixin:
    """
    Mixin for class-based views that replaces @cache_page.

    Place FIRST in MRO:
        class MyView(AsyncCacheMixin, APIView):
            cache_ttl = 120

    Works for both sync and async class-based views.
    """

    cache_ttl: int = 60

    def dispatch(self, request, *args, **kwargs):
        cache_key = _build_cache_key(request)
        cached = cache.get(cache_key)
        if cached is not None:
            # DRF Response needs accepted_renderer set (by finalize_response),
            # which hasn't run yet.  Bypass DRF rendering and return a plain
            # JsonResponse — safe for ASGI where _get_response_async calls
            # response.render() explicitly.
            from django.http import JsonResponse
            return JsonResponse(cached, safe=False)

        response = super().dispatch(request, *args, **kwargs)

        if hasattr(response, 'status_code') and 200 <= response.status_code < 300:
            data = response.data if hasattr(response, 'data') else None
            if data is not None:
                cache.set(cache_key, data, timeout=self.cache_ttl)
        return response


class AsyncCacheAPIViewMixin(AsyncCacheMixin):
    """
    Async-compatible version dispatch that uses sync_to_async for cache ops.

    For use with async DRF-style views. Place FIRST in MRO.
    """

    async def dispatch(self, request, *args, **kwargs):
        cache_key = _build_cache_key(request)
        cached = await sync_to_async(cache.get)(cache_key)
        if cached is not None:
            from django.http import JsonResponse
            return JsonResponse(cached, safe=False)

        response = await super().dispatch(request, *args, **kwargs)

        if hasattr(response, 'status_code') and 200 <= response.status_code < 300:
            data = response.data if hasattr(response, 'data') else None
            if data is not None:
                await sync_to_async(cache.set)(cache_key, data, timeout=self.cache_ttl)
        return response
