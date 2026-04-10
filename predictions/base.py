"""
predictions/base.py
Domain types for delay prediction results.

DelayPrediction is a pure value object — no Django ORM dependency — so it can
be constructed freely in unit tests and in the ML training pipeline without
requiring a database connection.
"""
from dataclasses import dataclass, field
from django.conf import settings


@dataclass
class DelayPrediction:
    """
    Carries the output of a single delay-prediction inference run.

    Attributes:
        delay_risk_score:       Probability in [0.0, 1.0] that the shipment
                                will be delayed.
        delay_probability:      Alias for delay_risk_score; kept for
                                backwards-compat with AlertManager messages.
        predicted_delay_hours:  Estimated hours of delay (0.0 if on-time).
        shipment_id:            PK of the evaluated Shipment (optional).
    """

    delay_risk_score:      float
    delay_probability:     float = field(init=False)
    predicted_delay_hours: float = 0.0
    shipment_id:           int | None = None

    def __post_init__(self) -> None:
        # Keep delay_probability in sync with delay_risk_score so both
        # attribute names work transparently.
        self.delay_probability = self.delay_risk_score

    # ── computed properties ───────────────────────────────────────────────────

    @property
    def is_high_risk(self) -> bool:
        """
        Return True if the delay risk meets or exceeds the HIGH threshold.

        Threshold is read from settings.ALERT_THRESHOLDS['HIGH'] so it stays
        in sync with the AlertManager configuration.
        """
        threshold: float = getattr(settings, 'ALERT_THRESHOLDS', {}).get('HIGH', 0.70)
        return self.delay_risk_score >= threshold

    @property
    def severity(self) -> str:
        """Map risk score to a SEVERITY label consistent with Alert.SEVERITY."""
        thresholds = getattr(settings, 'ALERT_THRESHOLDS', {
            'CRITICAL': 0.85, 'HIGH': 0.70, 'MEDIUM': 0.50,
        })
        if self.delay_risk_score >= thresholds.get('CRITICAL', 0.85):
            return 'CRITICAL'
        if self.delay_risk_score >= thresholds.get('HIGH', 0.70):
            return 'HIGH'
        if self.delay_risk_score >= thresholds.get('MEDIUM', 0.50):
            return 'MEDIUM'
        return 'LOW'
