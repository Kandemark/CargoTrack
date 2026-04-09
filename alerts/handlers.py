"""
alerts/handlers.py
Alert handler hierarchy for CargoTrack.

OOP:
    - Abstraction:    BaseAlertHandler defines the send() interface.
    - Inheritance:    EmailAlertHandler, InAppAlertHandler extend base.
    - Polymorphism:   AlertManager calls send() on any handler uniformly.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


@dataclass
class Alert:
    """Value object representing an alert to be dispatched."""
    alert_type:   str          # e.g. "DELAY_RISK", "EXCEPTION", "OVERDUE"
    shipment_id:  int
    tracking_number: str
    message:      str
    severity:     str = "HIGH"  # HIGH | MEDIUM | LOW
    recipient_email: str | None = None


class BaseAlertHandler(ABC):
    """
    Abstract base class for alert notification handlers.

    OOP: Abstraction — defines the contract all handlers must satisfy.
    """

    @abstractmethod
    def send(self, alert: Alert) -> bool:
        """
        Dispatch the alert through this handler's channel.

        Args:
            alert: Alert value object with all notification context.

        Returns:
            bool: True if the alert was sent successfully, False otherwise.
        """
        ...

    def can_handle(self, alert: Alert) -> bool:
        """
        Determine whether this handler should process the given alert.
        Override in subclasses to add filtering logic.

        Args:
            alert: The alert to check.

        Returns:
            bool: True by default — handles all alert types.
        """
        return True


class EmailAlertHandler(BaseAlertHandler):
    """
    Sends delay alerts via email.

    OOP: Inherits BaseAlertHandler — concrete implementation of send().
    """

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
