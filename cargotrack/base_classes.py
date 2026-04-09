"""
cargotrack/base_classes.py

Abstract base classes that define the OOP contracts for the CargoTrack system.
All concrete implementations in shipments, predictions, and alerts must inherit
from these classes and implement every abstract method.
"""

from abc import ABC, abstractmethod
from datetime import datetime


class ShipmentEvent(ABC):
    """
    Abstract base class for all events that can occur during a shipment's lifecycle.

    A shipment event represents any notable occurrence tied to a cargo shipment —
    e.g. departure, arrival, customs clearance, or a delay flag.  Subclasses must
    supply the event type label, the timestamp at which the event occurred, and a
    serialisable dictionary representation suitable for API responses or logging.
    """

    @abstractmethod
    def get_event_type(self) -> str:
        """
        Return a short string identifier for this event type.

        Examples: 'DEPARTURE', 'ARRIVAL', 'CUSTOMS_HOLD', 'DELAY_FLAGGED'.

        Returns:
            str: A human-readable event type label.
        """

    @abstractmethod
    def get_timestamp(self) -> datetime:
        """
        Return the UTC datetime at which this event occurred.

        Returns:
            datetime: A timezone-aware or naive datetime object representing
                      when the event took place.
        """

    @abstractmethod
    def to_dict(self) -> dict:
        """
        Serialise the event to a plain dictionary.

        The returned dict must be JSON-serialisable and should contain at minimum
        the keys ``event_type`` and ``timestamp``.  Subclasses may add any
        domain-specific fields required by the API or the audit log.

        Returns:
            dict: A dictionary representation of the event.
        """


class BasePredictor(ABC):
    """
    Abstract base class for all delay-prediction models used in CargoTrack.

    Concrete predictors (e.g. RandomForestPredictor, LogisticRegressionPredictor)
    wrap a scikit-learn estimator and expose a uniform interface so that the
    predictions app can swap models without changing calling code.
    """

    @abstractmethod
    def train(self, X, y) -> None:
        """
        Fit the underlying model on the supplied training data.

        Args:
            X: Feature matrix — typically a pandas DataFrame or numpy array of
               shape (n_samples, n_features).
            y: Target vector of shape (n_samples,) containing the ground-truth
               delay labels (e.g. 0 = on-time, 1 = delayed).

        Returns:
            None
        """

    @abstractmethod
    def predict(self, X) -> list:
        """
        Generate delay predictions for the supplied feature matrix.

        Args:
            X: Feature matrix of the same shape and dtype used during training.

        Returns:
            list: A list of predicted labels, one per sample in X.
        """

    @abstractmethod
    def get_accuracy_report(self) -> dict:
        """
        Return a dictionary of model performance metrics.

        Must be called after ``train``; behaviour is undefined if the model has
        not yet been fitted.  The dictionary should include at minimum the keys
        ``accuracy``, ``precision``, ``recall``, and ``f1``.

        Returns:
            dict: A mapping of metric names to their computed float values.
        """


class BaseAlertHandler(ABC):
    """
    Abstract base class for alert delivery channels in the CargoTrack alerts app.

    Each concrete handler targets a single notification channel — e.g.
    EmailAlertHandler, SMSAlertHandler, or WebhookAlertHandler.  The alerts app
    iterates over a list of registered handlers and calls ``send`` on each,
    allowing new channels to be added without modifying existing code.
    """

    @abstractmethod
    def send(self, shipment_id: int, message: str, risk_score: float) -> bool:
        """
        Dispatch an alert for the given shipment.

        Args:
            shipment_id (int): Primary key of the Shipment model instance that
                               triggered the alert.
            message (str):     Human-readable description of the alert condition.
            risk_score (float): Predicted delay probability in the range [0.0, 1.0]
                                as produced by the active BasePredictor.

        Returns:
            bool: True if the alert was delivered successfully, False otherwise.
        """

    @abstractmethod
    def get_handler_name(self) -> str:
        """
        Return a unique identifier for this alert channel.

        Used in logs and the admin UI to distinguish which handler sent an alert.

        Returns:
            str: A short, human-readable name such as 'email', 'sms', or 'webhook'.
        """
