"""
Driver Scoring Engine — composite performance score from weighted metrics.

Metrics (weights configurable):
- on_time_rate (25%) — % of deliveries within ETA window
- safety_score (25%) — incidents per 1000 km (inverted)
- fuel_efficiency (15%) — actual vs expected L/100km
- customer_rating (15%) — average shipper feedback (1–5)
- idle_time_pct (10%) — % of time idle (inverted)
- route_compliance (10%) — % distance on planned route

Usage:
    engine = DriverScoringEngine()
    scores = engine.score_all(drivers)
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"
MODEL_PATH = MODEL_DIR / "driver_scoring.json"

DEFAULT_WEIGHTS = {
    "on_time_rate": 0.25,
    "safety_score": 0.25,
    "fuel_efficiency": 0.15,
    "customer_rating": 0.15,
    "idle_time_pct": 0.10,
    "route_compliance": 0.10,
}

TIER_THRESHOLDS = [
    (90, "ELITE", "Top 5% — priority for high-value and time-critical shipments."),
    (80, "A", "Reliable — eligible for any shipment."),
    (65, "B", "Standard — meets expectations."),
    (50, "C", "Developing — may need coaching."),
    (0, "D", "Under review — performance improvement plan required."),
]


class DriverScoringEngine:
    def __init__(self, weights: dict[str, float] | None = None):
        self.weights = weights or dict(DEFAULT_WEIGHTS)
        total = sum(self.weights.values())
        self.weights = {k: v / total for k, v in self.weights.items()}

    # ── Metric normalisation ──────────────────────────────────────────────
    @staticmethod
    def _normalise(value: float, best: float, worst: float, invert: bool = False) -> float:
        """Normalise a metric to 0–100 scale."""
        if best == worst:
            return 50.0
        clamped = max(worst, min(best, value))
        score = (clamped - worst) / (best - worst) * 100
        return 100.0 - score if invert else score

    # ── Compute single driver ─────────────────────────────────────────────
    def score_driver(self, driver: dict | Any) -> dict:
        """Compute composite score for a single driver.

        Driver dict needs: on_time_rate, safety_score, fuel_efficiency,
        customer_rating, idle_time_pct, route_compliance, total_jobs.
        """
        metrics = driver if isinstance(driver, dict) else {
            "on_time_rate": getattr(driver, "on_time_rate", 85.0),
            "safety_score": 100.0 - getattr(driver, "incidents_per_1000km", 0) * 10,
            "fuel_efficiency": getattr(driver, "fuel_efficiency", 100.0),
            "customer_rating": getattr(driver, "rating", 4.0),
            "idle_time_pct": getattr(driver, "idle_time_pct", 15.0),
            "route_compliance": getattr(driver, "route_compliance", 90.0),
            "total_jobs": getattr(driver, "total_jobs", 0),
            "driver_id": getattr(driver, "driver_id", "unknown"),
        }

        # Normalise each metric to 0–100
        norm = {
            "on_time_rate": self._normalise(metrics.get("on_time_rate", 85), 100, 50, invert=False),
            "safety_score": self._normalise(metrics.get("safety_score", 80), 100, 0, invert=False),
            "fuel_efficiency": self._normalise(metrics.get("fuel_efficiency", 100), 120, 60, invert=False),
            "customer_rating": self._normalise(metrics.get("customer_rating", 4.0) * 20, 100, 20, invert=False),
            "idle_time_pct": self._normalise(metrics.get("idle_time_pct", 15), 5, 40, invert=True),
            "route_compliance": self._normalise(metrics.get("route_compliance", 90), 100, 50, invert=False),
        }

        composite = sum(
            self.weights.get(k, 0) * v for k, v in norm.items()
        )

        tier, description = TIER_THRESHOLDS[0][1], TIER_THRESHOLDS[0][2]
        for threshold, t, desc in TIER_THRESHOLDS:
            if composite >= threshold:
                tier, description = t, desc
                break

        return {
            "driver_id": metrics.get("driver_id", "unknown"),
            "composite_score": round(composite, 1),
            "tier": tier,
            "tier_description": description,
            "metrics": {k: round(v, 1) for k, v in norm.items()},
        }

    def score_all(self, drivers: list) -> list[dict]:
        """Score multiple drivers and return sorted by composite (best first)."""
        scores = [self.score_driver(d) for d in drivers]
        scores.sort(key=lambda s: s["composite_score"], reverse=True)
        return scores

    def save(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"weights": self.weights}, indent=2))

    def load(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        if not path.exists():
            return False
        data = json.loads(path.read_text())
        self.weights = data.get("weights", self.weights)
        return True
