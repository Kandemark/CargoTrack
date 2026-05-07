"""
Cargo Theft Risk Model — predict risk score per route/commodity/time.

Uses XGBoost classifier trained on:
- Route risk history (corridor crime index)
- Commodity type (high-value electronics, fuel, pharmaceuticals → higher risk)
- Time of day / day of week
- Vehicle type (open vs closed trailer)
- Stop frequency (more stops = higher exposure)
- Whether armed escort is present
- Season (rainy season = reduced visibility = higher opportunity)

Usage:
    model = TheftRiskModel()
    model.fit(historical_incidents)
    risk = model.predict_risk(shipment_context)
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"
MODEL_PATH = MODEL_DIR / "theft_risk.json"

# East African corridor risk indices (0–100, higher = riskier)
# Based on publicly reported cargo theft and road security data.
CORRIDOR_RISK_INDEX: dict[str, float] = {
    "Mombasa-Nairobi": 45,
    "Nairobi-Nakuru": 35,
    "Nairobi-Kampala": 55,
    "Kampala-Juba": 75,
    "Kampala-Kigali": 40,
    "Dar es Salaam-Morogoro": 50,
    "Dar es Salaam-Lusaka": 45,
    "Nairobi-Moyale": 60,
    "default": 40,
}

COMMODITY_THEFT_SCORE: dict[str, float] = {
    "electronics": 0.9,
    "pharmaceuticals": 0.7,
    "fuel": 0.85,
    "tobacco": 0.8,
    "alcohol": 0.7,
    "valuable": 0.9,
    "perishable": 0.3,
    "construction": 0.2,
    "general": 0.3,
    "default": 0.4,
}


class TheftRiskModel:
    def __init__(self):
        self._model = None  # XGBoost classifier
        self._threshold = 0.5

    # ── Features ──────────────────────────────────────────────────────────
    def _extract_features(self, context: dict) -> np.ndarray:
        corridor = context.get("corridor", "default")
        commodity = context.get("commodity", "default")
        vehicle_type = context.get("vehicle_type", "closed")

        features = [
            CORRIDOR_RISK_INDEX.get(corridor, CORRIDOR_RISK_INDEX["default"]),
            COMMODITY_THEFT_SCORE.get(commodity, COMMODITY_THEFT_SCORE["default"]),
            context.get("declared_value_usd", 10000) / 100000,  # normalise
            1.0 if vehicle_type == "open" else 0.2,
            context.get("num_stops", 2),
            1.0 if context.get("armed_escort", False) else 0.0,
            context.get("hour_of_day", 12) / 24.0,  # normalise
            1.0 if context.get("is_weekend", False) else 0.0,
            1.0 if context.get("is_rainy_season", False) else 0.0,
            context.get("distance_km", 500) / 2000.0,  # normalise
        ]
        return np.array(features, dtype=float)

    # ── Public API ────────────────────────────────────────────────────────
    def fit(self, incidents: list[dict]):
        """Train on historical theft incident data.

        Each incident dict should have the context features plus 'occurred' (bool).
        """
        if len(incidents) < 10:
            return

        try:
            from xgboost import XGBClassifier

            X_rows = [self._extract_features(i) for i in incidents]
            y_rows = [1 if i.get("occurred", False) else 0 for i in incidents]

            self._model = XGBClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.05,
                scale_pos_weight=max(1, sum(1 for y in y_rows if y == 0) / max(sum(y_rows), 1)),
                random_state=42,
            )
            self._model.fit(X_rows, y_rows)
        except ImportError:
            pass

    def predict_risk(self, context: dict) -> dict:
        """Return a risk assessment for a single shipment context.

        Returns {risk_score, risk_level, factors_contributing, recommendation}.
        """
        features = self._extract_features(context)

        if self._model is not None:
            proba = float(self._model.predict_proba(features.reshape(1, -1))[0, 1])
        else:
            # Rule-based fallback
            corridor_risk = CORRIDOR_RISK_INDEX.get(
                context.get("corridor", "default"), 40,
            ) / 100.0
            commodity_risk = COMMODITY_THEFT_SCORE.get(
                context.get("commodity", "default"), 0.4,
            )
            value_risk = min(1.0, context.get("declared_value_usd", 10000) / 200000)
            open_trailer = 1.5 if context.get("vehicle_type") == "open" else 1.0
            no_escort = 1.2 if not context.get("armed_escort") else 0.5
            proba = min(1.0, corridor_risk * 0.25 + commodity_risk * 0.35 + value_risk * 0.20
                        + 0.10 * open_trailer + 0.10 * no_escort)

        if proba < 0.2:
            level = "LOW"
            recommendation = "Standard precautions sufficient."
        elif proba < 0.5:
            level = "MEDIUM"
            recommendation = "Recommend GPS tracking active, avoid overnight stops."
        elif proba < 0.75:
            level = "HIGH"
            recommendation = "Armed escort recommended, real-time tracking required."
        else:
            level = "CRITICAL"
            recommendation = "Mandatory armed escort, convoy recommended, route deviation alert active."

        factors = []
        corridor = context.get("corridor", "default")
        if CORRIDOR_RISK_INDEX.get(corridor, 40) > 50:
            factors.append(f"High-risk corridor: {corridor}")
        if COMMODITY_THEFT_SCORE.get(context.get("commodity", "default"), 0.4) > 0.6:
            factors.append(f"High-theft commodity: {context.get('commodity')}")
        if context.get("vehicle_type") == "open":
            factors.append("Open trailer — cargo exposed")
        if not context.get("armed_escort"):
            factors.append("No armed escort")
        if context.get("declared_value_usd", 0) > 50000:
            factors.append(f"High value cargo: ${context.get('declared_value_usd'):,.0f}")

        return {
            "risk_score": round(proba, 4),
            "risk_level": level,
            "factors_contributing": factors,
            "recommendation": recommendation,
        }

    def save(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"threshold": self._threshold, "has_model": self._model is not None}, indent=2))

    def load(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        if not path.exists():
            return False
        data = json.loads(path.read_text())
        self._threshold = data.get("threshold", 0.5)
        return True
