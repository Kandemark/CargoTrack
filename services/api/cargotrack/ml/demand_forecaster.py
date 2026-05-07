"""
Demand Forecaster — predict shipment volume per corridor/week.

Uses GradientBoostingRegressor with calendar features (week of year,
month, corridor one-hot encoding) to forecast demand. Falls back to a
rolling-median baseline when training data is insufficient.

Usage:
    forecaster = DemandForecaster()
    forecaster.fit(historical_shipments)
    forecast = forecaster.predict(corridor="Mombasa-Nairobi", weeks_ahead=4)
"""
from __future__ import annotations

import json
import os
from datetime import date, timedelta
from pathlib import Path

import numpy as np

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"
MODEL_PATH = MODEL_DIR / "demand_forecaster.json"


class DemandForecaster:
    def __init__(self):
        self._model = None       # sklearn GradientBoostingRegressor
        self._corridors: list[str] = []
        self._weeks: np.ndarray | None = None
        self._baseline: dict[str, float] = {}  # corridor → median weekly volume

    # ── Feature engineering ───────────────────────────────────────────────
    def _build_features(self, shipments: list) -> tuple[np.ndarray, np.ndarray]:
        """Extract calendar + corridor features from shipment queryset/objects."""
        corridor_idx: dict[str, int] = {}
        rows = []

        for s in shipments:
            created = s.created_at.date() if hasattr(s, 'created_at') else s.get('created_at')
            corridor = s.route.corridor_name if hasattr(s, 'route') else s.get('corridor', 'unknown')
            if corridor not in corridor_idx:
                corridor_idx[corridor] = len(corridor_idx)

            week_of_year = created.isocalendar()[1]
            month = created.month
            year = created.year
            rows.append([week_of_year, month, year, corridor_idx[corridor]])

        X = np.array(rows, dtype=float)
        y = np.ones(len(rows))  # placeholder — caller provides aggregated targets
        self._corridors = list(corridor_idx.keys())
        return X, y

    def _aggregate_weekly(self, shipments: list) -> dict[tuple[str, int, int], int]:
        """Group shipments by (corridor, year, week) → count."""
        counts: dict[tuple[str, int, int], int] = {}
        for s in shipments:
            created = s.created_at.date() if hasattr(s, 'created_at') else s.get('created_at')
            corridor = s.route.corridor_name if hasattr(s, 'route') else s.get('corridor', 'unknown')
            iso = created.isocalendar()
            key = (corridor, iso[0], iso[1])
            counts[key] = counts.get(key, 0) + 1
        return counts

    # ── Public API ────────────────────────────────────────────────────────
    def fit(self, shipments: list):
        """Train the demand model on historical shipment records."""
        if len(shipments) < 10:
            return

        weekly = self._aggregate_weekly(shipments)

        # Build baseline: median weekly volume per corridor
        from collections import defaultdict
        corridor_volumes: dict[str, list[int]] = defaultdict(list)
        for (corridor, _year, _week), count in weekly.items():
            corridor_volumes[corridor].append(count)

        self._baseline = {
            c: float(np.median(vols)) for c, vols in corridor_volumes.items() if vols
        }
        self._corridors = list(self._baseline.keys())

        # Train GradientBoostingRegressor if enough data
        try:
            from sklearn.ensemble import GradientBoostingRegressor

            X_rows, y_rows = [], []
            for (corridor, year, week), count in weekly.items():
                c_idx = self._corridors.index(corridor) if corridor in self._corridors else 0
                X_rows.append([week, year, c_idx])
                y_rows.append(count)

            if len(X_rows) >= 20:
                self._model = GradientBoostingRegressor(
                    n_estimators=100, max_depth=3, random_state=42,
                )
                self._model.fit(X_rows, y_rows)
        except ImportError:
            pass

    def predict(self, corridor: str, weeks_ahead: int = 4) -> list[dict]:
        """Return weekly demand forecast for the given corridor.

        Returns list of {week_start, predicted_volume, confidence_low, confidence_high}.
        """
        today = date.today()
        baseline = self._baseline.get(corridor, 10)

        forecasts = []
        for i in range(weeks_ahead):
            target_date = today + timedelta(weeks=i)
            iso = target_date.isocalendar()

            if self._model is not None and corridor in (self._corridors or []):
                c_idx = self._corridors.index(corridor)
                X_pred = [[iso[1], target_date.year, c_idx]]
                pred = float(self._model.predict(X_pred)[0])
                pred = max(0, pred)
            else:
                # Seasonal adjustment: Q4 typically 15-25% higher in East Africa
                month = target_date.month
                seasonal = 1.15 if month in (10, 11, 12) else 1.0
                pred = baseline * seasonal

            std = baseline * 0.2
            forecasts.append({
                "week_start": target_date.isoformat(),
                "predicted_volume": round(pred, 1),
                "confidence_low": round(max(0, pred - 1.96 * std), 1),
                "confidence_high": round(pred + 1.96 * std, 1),
            })

        return forecasts

    def save(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "corridors": self._corridors,
            "baseline": self._baseline,
            "has_model": self._model is not None,
        }
        path.write_text(json.dumps(data, indent=2))

    def load(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        if not path.exists():
            return False
        data = json.loads(path.read_text())
        self._corridors = data["corridors"]
        self._baseline = data["baseline"]
        return True
