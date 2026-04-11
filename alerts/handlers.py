"""
alerts/handlers.py
Alert handler hierarchy for CargoTrack.

OOP:
    - Abstraction:    BaseAlertHandler defines the send() interface.
    - Inheritance:    EmailAlertHandler, InAppAlertHandler extend base.
    - Polymorphism:   AlertManager calls send() on any handler uniformly.
"""
import logging
from django.core.mail import send_mail
from django.conf import settings
from cargotrack.base_classes import BaseAlertHandler, Alert

logger = logging.getLogger(__name__)


class EmailAlertHandler(BaseAlertHandler):
    """
    Sends delay alerts via email.

    OOP: Inherits BaseAlertHandler — concrete implementation of send().
    """

    def get_handler_name(self) -> str:
        return 'Email'

    def send(self, alert: Alert) -> bool:
        """
        Send an email notification for the given alert.

        Args:
            alert: Alert containing recipient email and message.

        Returns:
            bool: True on success, False on failure.
        """
        if not alert.recipient_email:
            logger.warning("EmailAlertHandler: no recipient email for alert %s", alert.alert_type)
            return False
        try:
            send_mail(
                subject=f"[CargoTrack] {alert.severity} Alert — {alert.tracking_number}",
                message=alert.message,
                from_email=settings.DEFAULT_FROM_EMAIL if hasattr(settings, "DEFAULT_FROM_EMAIL") else "noreply@cargotrack.local",
                recipient_list=[alert.recipient_email],
                fail_silently=False,
            )
            logger.info("Email alert sent to %s for shipment %s", alert.recipient_email, alert.tracking_number)
            return True
        except Exception as exc:
            logger.error("EmailAlertHandler failed: %s", exc)
            return False


class InAppAlertHandler(BaseAlertHandler):
    """
    Stores alert as an in-app notification (persisted to DB).

    OOP: Inherits BaseAlertHandler — alternative implementation of send().
    """

    def get_handler_name(self) -> str:
        return 'InApp'

    def send(self, alert: Alert) -> bool:
        """
        Persist an in-app notification to the database.

        Args:
            alert: Alert to store.

        Returns:
            bool: True on success, False on failure.
        """
        try:
            from .models import Notification
            Notification.objects.create(
                alert_type=alert.alert_type,
                shipment_id=alert.shipment_id,
                tracking_number=alert.tracking_number,
                message=alert.message,
                severity=alert.severity,
            )
            logger.info("In-app notification created for shipment %s", alert.tracking_number)
            return True
        except Exception as exc:
            logger.error("InAppAlertHandler failed: %s", exc)
            return False
