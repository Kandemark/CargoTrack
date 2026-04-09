"""
cargotrack/context_processors.py
Injects global context into every template.
"""
from alerts.models import Alert


def notifications(request):
    """Add unacknowledged alert count to every template context."""
    if request.user.is_authenticated:
        count = Alert.objects.filter(acknowledged=False).count()
    else:
        count = 0
    return {"unread_notifications_count": count}
