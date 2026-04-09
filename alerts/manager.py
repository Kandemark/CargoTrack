"""
alerts/manager.py
AlertManager orchestrates multiple alert handlers.

OOP:
    - Composition:   AlertManager aggregates a list of BaseAlertHandler instances.
    - Strategy:      Handlers are pluggable — swap without changing AlertManager.
    - Observer-like: check_shipment() fires alerts when threshold is crossed.
"""
import logging
from django.conf import settings
from .handlers import Alert, BaseAlertHandler, EmailAlertHandler, InAppAlertHandler
from predictions.base import DelayPrediction

logger = logging.getLogger(__name__)


class AlertManager:
    """
    Orchestrates delay alerts across multiple notification channels.

    Maintains a registry of BaseAlertHandler instances and broadcasts
    Alert objects to all registered handlers when conditions are met.

    OOP:
        - Composition: holds a list of handler objects (not inheritance).
        - Strategy Pattern: handlers are interchangeable at runtime.

    Usage::

        manager = AlertManager()
        manager.register_handler(EmailAlertHandler())
        manager.register_handler(InAppAlertHandler())
        manager.check_shipment(shipment, prediction)
    """

    def __init__(self):
        self._handlers: list[BaseAlertHandler] = []
        self.threshold: float = getattr(settings, "DELAY_ALERT_THRESHOLD", 0.7)

        # Register default handlers
        self.register_handler(InAppAlertHandler())
        self.register_handler(EmailAlertHandler())

    # ── handler registry ──────────────────────────────────────────────────────

    def register_handler(self, handler: BaseAlertHandler) -> None:
        """
        Add a handler to the alert pipeline.

        Args:
            handler: Any object that inherits from BaseAlertHandler.
        """
        if not isinstance(handler, BaseAlertHandler):
            raise TypeError(f"Handler must be a BaseAlertHandler subclass, got {type(handler)}")
        self._handlers.append(handler)
        logger.debug("Registered alert handler: %s", handler.__class__.__name__)

    def remove_handler(self, handler_class: type) -> None:
        """Remove all handlers of a given class."""
        self._handlers = [h for h in self._handlers if not isinstance(h, handler_class)]

    # ── core logic ────────────────────────────────────────────────────────────

    def check_shipment(self, shipment, prediction: DelayPrediction) -> bool:
        """
        Evaluate a prediction and fire alerts if delay risk is high.

        Args:
            shipment:   Shipment model instance.
            prediction: DelayPrediction result from DelayPredictor.

        Returns:
            bool: True if any alerts were fired, False otherwise.
        """
        if not prediction.is_high_risk:
            return False

        recipient = None
        if shipment.client and shipment.client.email:
            recipient = shipment.client.email

        message = (
            f"Shipment {shipment.tracking_number} has a {prediction.delay_probability:.0%} "
            f"probability of delay. Estimated delay: {prediction.predicted_delay_hours:.1f} hours.
"
            f"Route: {shipment.route}
"
            f"Carrier: {shipment.carrier or 'Unassigned'}"
        )

        alert = Alert(
            alert_type="DELAY_RISK",
            shipment_id=shipment.id,
            tracking_number=shipment.tracking_number,
            message=message,
            severity="HIGH" if prediction.delay_probability >= 0.85 else "MEDIUM",
            recipient_email=recipient,
        )
        return self.fire_alert(alert)

    def fire_alert(self, alert: Alert) -> bool:
        """
        Broadcast an alert to all registered handlers.

        Args:
            alert: Fully constructed Alert value object.

        Returns:
            bool: True if at least one handler sent successfully.
        """
        if not self._handlers:
            logger.warning("AlertManager: no handlers registered.")
            return False
        results = []
        for handler in self._handlers:
            if handler.can_handle(alert):
                success = handler.send(alert)
                results.append(success)
                logger.debug("%s → %s", handler.__class__.__name__, "OK" if success else "FAIL")
        return any(results)
