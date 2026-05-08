"""
cargotrack/query_profiler.py — N+1 query detection middleware.

Logs warnings when a request makes more than a threshold number of
database queries, helping catch N+1 patterns during development.

Configure via settings:
    QUERY_PROFILER_THRESHOLD = 50  # warn if > 50 queries in a single request
    QUERY_PROFILER_ENABLED = True  # set False to disable entirely
"""

import logging
import time

from django.conf import settings
from django.db import connection

logger = logging.getLogger('cargotrack.queries')

THRESHOLD = getattr(settings, 'QUERY_PROFILER_THRESHOLD', 50)
ENABLED = getattr(settings, 'QUERY_PROFILER_ENABLED', True)


class QueryProfilerMiddleware:
    """
    Middleware that counts database queries per request and logs a warning
    when the count exceeds THRESHOLD.

    In production (DEBUG=False), only counts queries without logging SQL.
    In development (DEBUG=True), also logs the actual SQL of slow requests.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not ENABLED:
            return self.get_response(request)

        start = time.monotonic()
        response = self.get_response(request)
        elapsed = time.monotonic() - start

        query_count = len(connection.queries) if hasattr(connection, 'queries') else 0

        if query_count > THRESHOLD:
            path = request.path
            method = request.method
            logger.warning(
                'N+1 suspect: %s %s — %d queries in %.0fms (threshold=%d)',
                method, path, query_count, elapsed * 1000, THRESHOLD,
            )

            if settings.DEBUG and query_count <= THRESHOLD * 2:
                # Log the actual queries for debugging
                for i, q in enumerate(connection.queries):
                    logger.debug('  [%d] %s (%.2fms)', i + 1, q['sql'][:200], float(q.get('time', 0)) * 1000)

        return response


class SelectRelatedDebugMiddleware:
    """
    Debug-only middleware that flags querysets evaluated without select_related
    or prefetch_related when they traverse foreign keys.

    Only active when DEBUG=True and QUERY_PROFILER_ENABLED=True.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not settings.DEBUG or not ENABLED:
            return self.get_response(request)

        response = self.get_response(request)

        if hasattr(connection, 'queries'):
            # Count queries that look like lazy-load FK lookups
            # Pattern: SELECT ... FROM "table" WHERE "table"."id" = <single_value> LIMIT 1
            single_row_queries = 0
            for q in connection.queries:
                sql = q['sql']
                if 'LIMIT 1' in sql and 'WHERE' in sql:
                    single_row_queries += 1

            if single_row_queries > 10:
                logger.warning(
                    '%s %s — %d potential lazy-load queries detected. '
                    'Consider select_related/prefetch_related.',
                    request.method, request.path, single_row_queries,
                )

        return response
