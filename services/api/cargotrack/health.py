from django.conf import settings
from django.db import connections
from django.http import JsonResponse
from django.utils import timezone
from django.views import View


class HealthCheckView(View):
    """GET /api/health/ — liveness and readiness probe.

    Returns 200 with component status.  Individual component failures are
    reported in the JSON body so orchestrators can distinguish between a
    healthy instance and one that should be removed from rotation.
    """

    def get(self, request, *args, **kwargs):
        db_ok, db_error = self._check_db()
        redis_ok, redis_error = self._check_redis()

        all_ok = db_ok and redis_ok
        status_code = 200 if all_ok else 503

        return JsonResponse(
            {
                "status": "ok" if all_ok else "degraded",
                "service": "CargoTrack API",
                "timestamp": timezone.now().isoformat(),
                "version": "v1",
                "components": {
                    "database": {"healthy": db_ok, "error": db_error},
                    "redis": {"healthy": redis_ok, "error": redis_error},
                },
            },
            status=status_code,
        )

    @staticmethod
    def _check_db():
        try:
            conn = connections["default"]
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
            return True, None
        except Exception as exc:
            return False, str(exc)

    @staticmethod
    def _check_redis():
        try:
            from django.core.cache import cache
            cache.set("health_check", "1", timeout=5)
            if cache.get("health_check") == "1":
                return True, None
            return False, "Cache read-back mismatch"
        except Exception as exc:
            return False, str(exc)
