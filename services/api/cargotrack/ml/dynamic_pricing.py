"""
Dynamic Pricing Engine — real-time freight rate recommendations.

Uses GradientBoostingRegressor with market features:
- Base rate (corridor × commodity)
- Vehicle capacity utilization
- Fuel price index
- Seasonality (month, harvest cycles)
- Demand/supply ratio (available trucks vs pending shipments)
- Urgency (days until required pickup)

Usage:
    engine = DynamicPricingEngine()
    engine.fit(historical_bookings)
    price = engine.recommend(shipment, market_snapshot)
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"
MODEL_PATH = MODEL_DIR / "dynamic_pricing.json"

# East African corridor base rates (USD per tonne-km, indicative)
CORRIDOR_BASE_RATES: dict[str, float] = {
    "Mombasa-Nairobi": 0.08,
    "Nairobi-Kampala": 0.10,
    "Kampala-Kigali": 0.12,
    "Dar es Salaam-Lusaka": 0.09,
    "Mombasa-Kampala": 0.11,
    "Nairobi-Juba": 0.14,
    "default": 0.10,
}

COMMODITY_MULTIPLIERS: dict[str, float] = {
    "general": 1.00,
    "perishable": 1.25,
    "fragile": 1.35,
    "hazardous": 1.50,
    "oversized": 1.40,
    "valuable": 1.30,
    "default": 1.00,
}


class DynamicPricingEngine:
    def __init__(self, min_margin_pct: float = 5.0, max_margin_pct: float = 40.0):
        self._model: Any = None
        self.min_margin = min_margin_pct
        self.max_margin = max_margin_pct
        self.feature_names: list[str] = []

    # ── Feature extraction ────────────────────────────────────────────────
    def _extract_features(self, booking: dict) -> np.ndarray:
        """Extract pricing features from a booking/shipment dict.

        Expected keys: corridor, commodity, weight_tonnes, distance_km,
                       truck_capacity_pct, fuel_price_index, days_to_pickup,
                       available_trucks, pending_shipments.
        """
        corridor = booking.get("corridor", "default")
        commodity = booking.get("commodity", "default")

        base_rate = CORRIDOR_BASE_RATES.get(corridor, CORRIDOR_BASE_RATES["default"])
        commodity_mult = COMMODITY_MULTIPLIERS.get(commodity, COMMODITY_MULTIPLIERS["default"])

        weight = booking.get("weight_tonnes", 10.0)
        distance = booking.get("distance_km", 500.0)
        cost_base = base_rate * weight * distance * commodity_mult

        features = [
            cost_base,
            booking.get("truck_capacity_pct", 50.0),
            booking.get("fuel_price_index", 100.0),
            booking.get("days_to_pickup", 3.0),
            booking.get("available_trucks", 10),
            booking.get("pending_shipments", 20),
            float(booking.get("month", 6)),
            commodity_mult,
        ]
        return np.array(features, dtype=float)

    # ── Public API ────────────────────────────────────────────────────────
    def fit(self, historical_bookings: list[dict]):
        """Train on historical bookings with known final prices."""
        if len(historical_bookings) < 15:
            return

        try:
            from sklearn.ensemble import GradientBoostingRegressor

            X_rows = [self._extract_features(b) for b in historical_bookings]
            y_rows = [b.get("final_price_usd", 1000) for b in historical_bookings]

            self._model = GradientBoostingRegressor(
                n_estimators=150, max_depth=4, learning_rate=0.05, random_state=42,
            )
            self._model.fit(X_rows, y_rows)
            self.feature_names = [
                "cost_base", "capacity_pct", "fuel_index", "days_to_pickup",
                "available_trucks", "pending_shipments", "month", "commodity_mult",
            ]
        except ImportError:
            pass

    def recommend(self, booking: dict) -> dict:
        """Return a recommended freight rate with confidence bounds.

        Returns {recommended_price_usd, min_price_usd, max_price_usd, margin_pct, factors}.
        """
        features = self._extract_features(booking)

        if self._model is not None:
            pred = float(self._model.predict(features.reshape(1, -1))[0])
        else:
            # Fallback: cost-plus pricing
            base_rate = CORRIDOR_BASE_RATES.get(
                booking.get("corridor", "default"), CORRIDOR_BASE_RATES["default"],
            )
            commodity_mult = COMMODITY_MULTIPLIERS.get(
                booking.get("commodity", "default"), COMMODITY_MULTIPLIERS["default"],
            )
            weight = booking.get("weight_tonnes", 10.0)
            distance = booking.get("distance_km", 500.0)
            pred = base_rate * weight * distance * commodity_mult

        pred = max(pred, 50.0)  # floor

        # Adjust for demand/supply
        available = booking.get("available_trucks", 10)
        pending = booking.get("pending_shipments", 20)
        demand_ratio = pending / max(available, 1)
        if demand_ratio > 2.0:
            pred *= min(1.30, 1.0 + (demand_ratio - 2.0) * 0.05)

        # Urgency surcharge
        days = booking.get("days_to_pickup", 3)
        if days <= 1:
            pred *= 1.20
        elif days <= 2:
            pred *= 1.10

        margin_pct = max(self.min_margin, min(self.max_margin, 15.0))
        std = pred * 0.15

        return {
            "recommended_price_usd": round(pred, 2),
            "min_price_usd": round(pred - 1.96 * std, 2),
            "max_price_usd": round(pred + 1.96 * std, 2),
            "margin_pct": round(margin_pct, 1),
            "factors": {
                "demand_supply_ratio": round(demand_ratio, 2),
                "urgency_days": days,
            },
        }

    def save(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"feature_names": self.feature_names, "has_model": self._model is not None}, indent=2))

    def load(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        if not path.exists():
            return False
        data = json.loads(path.read_text())
        self.feature_names = data.get("feature_names", [])
        return True
