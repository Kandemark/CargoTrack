"""
alerts/alert_manager.py

AlertManager and concrete BaseAlertHandler implementations.

OOP:
    Inheritance  — InAppAlertHandler and EmailAlertHandler both extend
                   BaseAlertHandler (ABC), satisfying its send() and
                   get_handler_name() abstract method contracts.
    Polymorphism — AlertManager.fire() calls handler.send() on every
                   registered handler without knowing their concrete types.
    Strategy     — handlers are pluggable; swap or add channels at runtime
                   via register_handler() without changing AlertManager.
    Observer-like — AlertManager acts as the subject; handlers are observers
                   that react when a risk threshold is crossed.
"""

import logging

from django.conf import settings

from cargotrack.base_classes import BaseAlertHandler

logger = logging.getLogger(__name__)


class InAppAlertHandler(BaseAlertHandler):
    """
    Concrete handler that persists an Alert record to the database.

    Inherits from BaseAlertHandler (ABC) and implements both abstract methods.
    The database write is deferred inside send() so Django's ORM is only
    touched at call time, not at import time.
    """

    def get_handler_name(self) -> str:
        """Return the channel identifier used in logs and reports."""
        return 'InApp'

    def send(self, shipment_id: int, message: str, risk_score: float) -> bool:
        """
        Create an Alert record in the database for the given shipment.

        Args:
            shipment_id: PK of the Shipment that triggered the alert.
            message:     Human-readable alert description.
            risk_score:  Delay probability in [0.0, 1.0].

        Returns:
            True on successful DB write; False on any exception.
        """
        from shipments.models import Shipment
        from alerts.models import Alert
        try:
            shipment = Shipment.objects.get(pk=shipment_id)
            severity = self._score_to_severity(risk_score)
            Alert.objects.create(
                shipment=shipment,
                message=message,
                risk_score=risk_score,
                severity=severity,
            )
            logger.info(
                "InAppAlertHandler: created %s alert for shipment #%s (risk=%.2f)",
                severity, shipment_id, risk_score,
            )
            return True
        except Exception as e:
            logger.error("InAppAlertHandler failed: %s", e)
            return False

    @staticmethod
    def _score_to_severity(score: float) -> str:
        """Map a risk score to a SEVERITY choice label using settings.ALERT_THRESHOLDS."""
        thresholds = getattr(settings, 'ALERT_THRESHOLDS', {
            'CRITICAL': 0.85, 'HIGH': 0.70, 'MEDIUM': 0.50,
        })
        if score >= thresholds.get('CRITICAL', 0.85):
            return 'CRITICAL'
        if score >= thresholds.get('HIGH', 0.70):
            return 'HIGH'
        if score >= thresholds.get('MEDIUM', 0.50):
            return 'MEDIUM'
        return 'LOW'


class EmailAlertHandler(BaseAlertHandler):
    """
    Concrete handler that logs an email alert via Django's logger.

    In production, replace the logger call with Django's send_mail() or a
    third-party email backend.  The interface contract (send / get_handler_name)
    stays identical regardless of the underlying transport.
    """

    def get_handler_name(self) -> str:
        """Return the channel identifier used in logs and reports."""
        return 'Email'

    def send(self, shipment_id: int, message: str, risk_score: float) -> bool:
        """
        Emit an email-style alert via the Python logger.

        Args:
            shipment_id: PK of the Shipment that triggered the alert.
            message:     Human-readable alert description.
            risk_score:  Delay probability in [0.0, 1.0].

        Returns:
            Always True — logging cannot fail silently in a way we need to
            surface to the caller.
        """
        logger.info(
            "[EMAIL ALERT] Shipment #%s | Risk: %.2f | %s",
            shipment_id, risk_score, message,
        )
        return True


class AlertManager:
    """
    Orchestrates multiple BaseAlertHandler instances.

    Fires all registered handlers when a shipment's risk score meets or
    exceeds the configured threshold.

    OOP — Strategy pattern:
        Handlers are registered at runtime and called through the uniform
        BaseAlertHandler interface.  Swapping a handler (e.g. SMS instead of
        Email) requires no change to AlertManager itself.

    Usage::

        am = AlertManager(threshold=0.70)
        am.register_handler(InAppAlertHandler())
        am.register_handler(EmailAlertHandler())
        result = am.fire(shipment_id=1, risk_score=0.85)
    """

    DEFAULT_THRESHOLD = 0.70

    def __init__(self, threshold: float = DEFAULT_THRESHOLD) -> None:
        self.threshold = threshold
        self._handlers: list[BaseAlertHandler] = []

    def register_handler(self, handler: BaseAlertHandler) -> None:
        """
        Add a handler to the alert pipeline.

        Args:
            handler: Any concrete BaseAlertHandler subclass instance.
        """
        self._handlers.append(handler)

    def fire(self, shipment_id: int, risk_score: float) -> dict:
        """
        Broadcast an alert to all registered handlers if the threshold is met.

        Args:
            shipment_id: PK of the shipment being evaluated.
            risk_score:  Delay probability in [0.0, 1.0].

        Returns:
            dict with keys:
                fired           (bool)       — whether handlers were invoked.
                handlers_called (list[str])  — names of invoked handlers.
                results         (list[bool]) — success flag per handler.
        """
        if risk_score < self.threshold:
            return {'fired': False, 'handlers_called': [], 'results': []}

        message = (
            f"Delay risk alert: {risk_score:.0%} probability of delay "
            f"for shipment #{shipment_id}."
        )

        names:   list[str]  = []
        results: list[bool] = []

        for handler in self._handlers:
            names.append(handler.get_handler_name())
            results.append(handler.send(shipment_id, message, risk_score))

        return {'fired': True, 'handlers_called': names, 'results': results}
