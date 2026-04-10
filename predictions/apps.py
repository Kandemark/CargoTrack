"""
predictions/apps.py — AppConfig for the predictions application
===============================================================

The predictions app provides the DelayPrediction value object (base.py) which
is returned by DelayPredictor.predict() (cargotrack/ml/delay_predictor.py) and
consumed by AlertManager.check_shipment().  It contains no database models —
prediction results are stored on Shipment.delay_risk_score and in Alert records.
"""
from django.apps import AppConfig


class PredictionsConfig(AppConfig):
    """AppConfig for the predictions domain app.

    Attributes:
        default_auto_field: BigAutoField — no models here, but consistent
                            with other apps.
        name: Python dotted path used by Django's app registry.
        verbose_name: Human-readable label shown in the Django admin.
    """

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'predictions'
    verbose_name = 'Delay Predictions'
