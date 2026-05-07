# ML prediction domain types — base classes for delay/loss prediction outputs.

class DelayPrediction:
    """Typed result from the delay prediction pipeline."""
    def __init__(self, delay_risk_score, predicted_delay_hours, **kwargs):
        self.delay_risk_score = delay_risk_score
        self.predicted_delay_hours = predicted_delay_hours
        for k, v in kwargs.items():
            setattr(self, k, v)

class DelayPredictionResult:
    """Alias for backwards compatibility."""
    def __init__(self, shipment_id, risk_score, severity, features_used=None):
        self.shipment_id = shipment_id
        self.risk_score = risk_score
        self.severity = severity
        self.features_used = features_used or {}
