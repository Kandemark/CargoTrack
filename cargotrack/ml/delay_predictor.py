"""
cargotrack/ml/delay_predictor.py

Concrete delay-prediction model that fulfils the BasePredictor ABC contract.

OOP:
    Inheritance  — DelayPredictor extends BasePredictor (ABC), so it must
                   implement train(), predict(), and get_accuracy_report().
    Composition  — FeatureEngineer is held as an instance attribute, not
                   inherited; this keeps feature logic decoupled from model
                   logic and lets either be swapped independently.
    Encapsulation — internal state (_is_trained, _last_report, model) is
                    not exposed directly; callers use the ABC interface.
"""

from __future__ import annotations

import os
import pickle
from collections import Counter

import numpy as np
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from xgboost import XGBClassifier

from cargotrack.base_classes import BasePredictor
from cargotrack.ml.feature_engineer import FeatureEngineer


class DelayPredictor(BasePredictor):
    """
    Predicts shipment delay probability using gradient-boosted tree ensembles.

    Uses composition: FeatureEngineer is contained, not inherited.
    Implements BasePredictor ABC.

    Model back-ends (``model_key``):

    =====  ============================================================
    Key    Model
    =====  ============================================================
    xgb    XGBClassifier + IsotonicRegression calibration (default)
    rf     RandomForestClassifier
    gb     GradientBoostingClassifier
    lr     LogisticRegression
    =====  ============================================================

    XGBoost is the default: it handles class imbalance natively via
    ``scale_pos_weight``, trains faster than RandomForest on the same data,
    and produces calibrated probabilities via sigmoid/isotonic regression.

    Typical usage::

        dp = DelayPredictor()
        X  = dp.feature_engineer.fit_transform(train_qs)
        y  = train_df['delayed']
        dp.train(X, y)
        preds = dp.predict(X_test)   # list of (label, probability) tuples
        dp.save()

    Attributes:
        feature_engineer (FeatureEngineer):     Composed feature extractor.
        model_key        (str):                 Key into MODELS dict.
        model            (sklearn estimator):   Active classifier pipeline.
        calibrator       (CalibratedClassifierCV | None): Probability calibrator.
        _is_trained      (bool):                True after train().
        _last_report     (dict):                Metrics populated by train().
        _feature_importance (list[dict]):        Top features by gain.
    """

    MODEL_PATH = 'cargotrack/ml/delay_model.pkl'

    MODELS: dict = {
        'xgb': XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            objective='binary:logistic',
            eval_metric='logloss',
            random_state=42,
            n_jobs=-1,
        ),
        'rf': RandomForestClassifier(n_estimators=100, random_state=42),
        'gb': GradientBoostingClassifier(random_state=42),
        'lr': LogisticRegression(max_iter=1000),
    }

    def __init__(self, model_key: str = 'xgb') -> None:
        if model_key not in self.MODELS:
            raise ValueError(
                f"Unknown model_key '{model_key}'. "
                f"Choose from: {list(self.MODELS)}"
            )
        self.feature_engineer: FeatureEngineer = FeatureEngineer()
        self.model_key:   str = model_key
        self.model             = clone(self.MODELS[model_key])
        self.calibrator        = None
        self._is_trained: bool = False
        self._last_report: dict = {}
        self._feature_importance: list[dict] = []

    # ── BasePredictor interface ───────────────────────────────────────────────

    def train(self, X, y) -> None:
        """
        Fit the model with probability calibration and record CV metrics.

        For XGBoost, an IsotonicRegression calibrator is fitted on a hold-out
        portion and wraps the classifier so predict_proba returns well-calibrated
        probabilities suitable for threshold-based alert decisions.

        Args:
            X: Feature DataFrame produced by FeatureEngineer.transform().
            y: Binary Series or array — 1 = delayed, 0 = on-time.
        """
        y_list = list(y)
        if len(y_list) < 2:
            raise ValueError('Need at least 2 labelled shipments to train the model.')

        class_counts = Counter(y_list)
        if len(class_counts) < 2:
            raise ValueError(
                'Training requires both delayed and on-time shipments.'
            )

        # Compute scale_pos_weight for imbalanced classes
        neg, pos = class_counts.get(0, 1), class_counts.get(1, 1)
        if hasattr(self.model, 'set_params') and self.model_key == 'xgb':
            self.model.set_params(scale_pos_weight=neg / pos)

        # Fit with probability calibration when the dataset is large enough.
        # CalibratedClassifierCV uses 3-fold internal CV to calibrate;
        # the resulting probabilities are well-suited for threshold-based alerting.
        min_samples_per_class = min(class_counts.values())
        if self.model_key in ('xgb', 'rf') and min_samples_per_class >= 3:
            self.calibrator = CalibratedClassifierCV(
                estimator=self.model, method='isotonic', cv=min(3, min_samples_per_class),
            )
            self.calibrator.fit(X, y_list)
        else:
            self.model.fit(X, y_list)

        # Feature importance from the fitted base model.  When a calibrator is
        # used, extract from the refit base estimator inside the calibrator.
        fitted_model = self.calibrator.estimator if self.calibrator else self.model
        self._feature_importance = self._compute_feature_importance(X, fitted_model)

        # Cross-validation
        min_class_size = min(class_counts.values())
        cv_folds = min(5, len(y_list), min_class_size)

        self._last_report = {
            'model': self.model_key,
            'n_samples': len(y_list),
            'class_balance': dict(class_counts),
            'calibrated': self.calibrator is not None,
        }

        if cv_folds >= 2:
            # Evaluate with the calibrated pipeline
            evaluator = self.calibrator if self.calibrator else self.model
            scores = cross_val_score(evaluator, X, y_list, cv=cv_folds, scoring='f1')
            self._last_report.update({
                'cv_f1_mean': round(float(scores.mean()), 4),
                'cv_f1_std': round(float(scores.std()), 4),
                'cv_folds': cv_folds,
            })
        else:
            self._last_report.update({
                'cv_f1_mean': None, 'cv_f1_std': None,
                'cv_folds': 1, 'cv_skipped': True,
                'cv_skip_reason': (
                    'Cross-validation requires at least 2 samples in every class.'
                ),
            })

        self._is_trained = True

    def predict(self, X) -> list:
        """
        Return predicted labels and calibrated delay probabilities.

        Returns:
            list[tuple[int, float]]: (predicted_label, delay_probability)
                tuples.  Probability values are well-calibrated when using
                xgb or rf model keys.
        """
        if not self._is_trained:
            raise RuntimeError('Model not trained. Call train() first.')

        predictor = self.calibrator if self.calibrator else self.model
        labels = predictor.predict(X)
        probs  = predictor.predict_proba(X)[:, 1]
        return list(zip(labels.tolist(), probs.tolist()))

    def get_accuracy_report(self) -> dict:
        """Return the metrics dict from train(), including feature importance."""
        report = dict(self._last_report)
        if self._feature_importance:
            report['feature_importance'] = self._feature_importance[:15]
        return report

    def _compute_feature_importance(self, X, fitted_model=None) -> list[dict]:
        """Extract feature importance scores from a fitted model."""
        model = fitted_model or self.model
        try:
            if hasattr(model, 'feature_importances_'):
                importances = model.feature_importances_
            elif hasattr(model, 'coef_'):
                importances = np.abs(model.coef_[0])
            else:
                return []

            feature_names = list(X.columns)
            ranked = sorted(
                zip(feature_names, importances),
                key=lambda x: x[1], reverse=True,
            )
            return [
                {'feature': name, 'importance': round(float(imp), 6)}
                for name, imp in ranked if imp > 0
            ]
        except Exception:
            return []

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self) -> None:
        """Serialise the entire DelayPredictor to MODEL_PATH."""
        os.makedirs(os.path.dirname(self.MODEL_PATH), exist_ok=True)
        with open(self.MODEL_PATH, 'wb') as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls) -> 'DelayPredictor':
        """Deserialise a previously saved DelayPredictor from MODEL_PATH."""
        if not os.path.exists(cls.MODEL_PATH):
            raise FileNotFoundError(
                f"No trained model found at '{cls.MODEL_PATH}'. "
                "Run train() and save() first."
            )
        with open(cls.MODEL_PATH, 'rb') as f:
            return pickle.load(f)
