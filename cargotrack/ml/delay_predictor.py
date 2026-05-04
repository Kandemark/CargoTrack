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

from sklearn.base import clone
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

from cargotrack.base_classes import BasePredictor
from cargotrack.ml.feature_engineer import FeatureEngineer


class DelayPredictor(BasePredictor):
    """
    Predicts shipment delay probability using an ensemble of sklearn models.

    Uses composition: FeatureEngineer is contained, not inherited.
    Implements BasePredictor ABC.

    Three interchangeable model back-ends are available via ``model_key``:

    ===  =========================================
    Key  Model
    ===  =========================================
    rf   RandomForestClassifier (default)
    gb   GradientBoostingClassifier
    lr   LogisticRegression
    ===  =========================================

    Typical usage::

        dp = DelayPredictor()
        X  = dp.feature_engineer.fit_transform(train_qs)
        y  = train_df['delayed']
        dp.train(X, y)
        preds = dp.predict(X_test)   # list of (label, probability) tuples
        dp.save()

    Attributes:
        feature_engineer (FeatureEngineer): Composed feature extractor.
        model_key        (str):             Key into MODELS dict.
        model            (sklearn estimator): Active sklearn estimator.
        _is_trained      (bool):            True after train() has been called.
        _last_report     (dict):            Metrics populated by train().
    """

    MODEL_PATH = 'cargotrack/ml/delay_model.pkl'

    # Class-level catalogue — each call gets a fresh instance so instances
    # cannot share fitted state across DelayPredictor objects.
    MODELS: dict = {
        'rf': RandomForestClassifier(n_estimators=100, random_state=42),
        'gb': GradientBoostingClassifier(random_state=42),
        'lr': LogisticRegression(max_iter=1000),
    }

    def __init__(self, model_key: str = 'rf') -> None:
        if model_key not in self.MODELS:
            raise ValueError(
                f"Unknown model_key '{model_key}'. "
                f"Choose from: {list(self.MODELS)}"
            )
        self.feature_engineer: FeatureEngineer = FeatureEngineer()  # composition
        self.model_key:   str  = model_key
        self.model             = clone(self.MODELS[model_key])
        self._is_trained: bool = False
        self._last_report: dict = {}

    # ── BasePredictor interface ───────────────────────────────────────────────

    def train(self, X, y) -> None:
        """
        Fit the model and record 5-fold cross-validated F1 metrics.

        Args:
            X: Feature DataFrame produced by FeatureEngineer.transform().
            y: Binary Series or array — 1 = delayed, 0 = on-time.

        Returns:
            None  (state stored in _last_report; _is_trained set to True).
        """
        y_list = list(y)
        if len(y_list) < 2:
            raise ValueError('Need at least 2 labelled shipments to train the model.')

        class_counts = Counter(y_list)
        if len(class_counts) < 2:
            raise ValueError(
                'Training requires both delayed and on-time shipments.'
            )

        self.model.fit(X, y_list)

        min_class_size = min(class_counts.values())
        cv_folds = min(5, len(y_list), min_class_size)

        self._last_report = {
            'model': self.model_key,
            'n_samples': len(y_list),
            'class_balance': dict(class_counts),
        }

        if cv_folds >= 2:
            scores = cross_val_score(self.model, X, y_list, cv=cv_folds, scoring='f1')
            self._last_report.update({
                'cv_f1_mean': round(float(scores.mean()), 4),
                'cv_f1_std': round(float(scores.std()), 4),
                'cv_folds': cv_folds,
            })
        else:
            self._last_report.update({
                'cv_f1_mean': None,
                'cv_f1_std': None,
                'cv_folds': 1,
                'cv_skipped': True,
                'cv_skip_reason': (
                    'Cross-validation requires at least 2 samples in every class.'
                ),
            })

        self._is_trained = True

    def predict(self, X) -> list:
        """
        Return predicted labels and per-sample delay probabilities.

        Args:
            X: Feature DataFrame of the same shape used during training.

        Returns:
            list[tuple[int, float]]: A list of (predicted_label, probability)
                tuples where probability is the model's confidence that the
                shipment will be delayed (class 1).

        Raises:
            RuntimeError: If called before train().
        """
        if not self._is_trained:
            raise RuntimeError('Model not trained. Call train() first.')
        labels = self.model.predict(X)
        probs  = self.model.predict_proba(X)[:, 1]
        return list(zip(labels.tolist(), probs.tolist()))

    def get_accuracy_report(self) -> dict:
        """
        Return the metrics dict populated by the most recent train() call.

        Keys: cv_f1_mean, cv_f1_std, model, n_samples.

        Returns:
            dict: Empty dict if train() has not yet been called.
        """
        return self._last_report

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self) -> None:
        """
        Serialise the entire DelayPredictor (including fitted model and
        FeatureEngineer encoders) to MODEL_PATH using pickle.

        The directory is created if it does not already exist.
        """
        os.makedirs(os.path.dirname(self.MODEL_PATH), exist_ok=True)
        with open(self.MODEL_PATH, 'wb') as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls) -> 'DelayPredictor':
        """
        Deserialise a previously saved DelayPredictor from MODEL_PATH.

        Returns:
            DelayPredictor: Fully restored instance with fitted model and
                            FeatureEngineer encoder state intact.

        Raises:
            FileNotFoundError: If MODEL_PATH does not exist.
        """
        if not os.path.exists(cls.MODEL_PATH):
            raise FileNotFoundError(
                f"No trained model found at '{cls.MODEL_PATH}'. "
                "Run train() and save() first."
            )
        with open(cls.MODEL_PATH, 'rb') as f:
            return pickle.load(f)
