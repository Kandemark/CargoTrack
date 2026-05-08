"""
cargotrack/cache.py — Cache invalidation helpers.

Import ``invalidate_dashboard_caches`` in any view that mutates shipment,
tracking, alert, or invoice data to bust cached dashboard/analytics responses.

All functions here are synchronous (Django cache backends are sync).
For async views, wrap calls with:  await sync_to_async(invalidate_dashboard_caches)()
"""

from django.core.cache import cache

# Prefix used by AsyncCacheMixin and async_cache decorator
ASYNC_VIEW_PREFIX = 'ct:async_view:*'


def invalidate_dashboard_caches() -> None:
    """Delete all cached dashboard/analytics/shipment pages."""
    # Bust legacy cache_page entries
    cache.delete_pattern('views.decorators.cache.cache_page.*')
    # Bust async cache entries
    cache.delete_pattern(ASYNC_VIEW_PREFIX)


def invalidate_cache_for_path(path_prefix: str) -> None:
    """Delete cache entries for a specific URL prefix."""
    cache.delete_pattern(f'views.decorators.cache.cache_page.*{path_prefix}*')
    cache.delete_pattern(f'ct:async_view:*{path_prefix}*')


def invalidate_cache_for_shipment(shipment_id: int) -> None:
    """Bust caches related to a specific shipment."""
    cache.delete_pattern(f'ct:async_view:*shipments*')
    cache.delete_pattern(f'ct:async_view:*dashboard*')
    cache.delete(f'ct:shipment_detail:{shipment_id}')


def cache_shipment_detail(shipment_id: int, data: dict, ttl: int = 120) -> None:
    """Store a shipment detail in cache for fast retrieval."""
    cache.set(f'ct:shipment_detail:{shipment_id}', data, timeout=ttl)


def get_cached_shipment_detail(shipment_id: int) -> dict | None:
    """Retrieve a cached shipment detail."""
    return cache.get(f'ct:shipment_detail:{shipment_id}')
