from django.http import JsonResponse
from django.utils import timezone
from django.views import View


class HealthCheckView(View):
    def get(self, request, *args, **kwargs):
        return JsonResponse(
            {
                "status": "ok",
                "service": "CargoTrack API",
                "timestamp": timezone.now().isoformat(),
                "version": "v1",
            }
        )
