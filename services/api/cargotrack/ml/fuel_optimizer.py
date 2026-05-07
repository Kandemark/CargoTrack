"""
Fuel Optimizer — find optimal fuel stops along a route using dynamic programming.

Given a route with N waypoints, vehicle fuel capacity/consumption, and fuel
prices at each waypoint, compute the minimum-cost refuelling plan.

Algorithm: DP with state (waypoint_index, fuel_level_gallons).
At each waypoint: can refuel 0..tank_capacity gallons at local price.

Prices are indexed by country/region (East African fuel price corridors:
Kenya ~$1.10/L, Uganda ~$1.30/L, Tanzania ~$1.15/L, Rwanda ~$1.35/L, etc.)

Usage:
    optimizer = FuelOptimizer()
    plan = optimizer.optimize(route_waypoints, vehicle_spec)
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"
MODEL_PATH = MODEL_DIR / "fuel_optimizer.json"

# East African diesel prices (USD per litre, indicative 2025)
REGIONAL_FUEL_PRICES: dict[str, float] = {
    "KE": 1.12,   # Kenya
    "UG": 1.28,   # Uganda
    "TZ": 1.15,   # Tanzania
    "RW": 1.35,   # Rwanda
    "ET": 1.05,   # Ethiopia
    "ZM": 1.18,   # Zambia
    "SS": 1.45,   # South Sudan
    "BI": 1.30,   # Burundi
    "CD": 1.40,   # DRC
}

LITRES_PER_US_GALLON = 3.78541
KM_PER_MILE = 1.60934


@dataclass
class FuelStop:
    waypoint_index: int
    location_name: str
    country_code: str
    litres_to_add: float
    price_per_litre: float
    cost_usd: float
    fuel_level_after: float  # litres


@dataclass
class FuelPlan:
    route_name: str
    total_distance_km: float
    total_fuel_consumed_l: float
    total_cost_usd: float
    stops: list[FuelStop] = field(default_factory=list)


class FuelOptimizer:
    def __init__(
        self,
        fuel_prices: dict[str, float] | None = None,
        safety_margin_litres: float = 20.0,
    ):
        self.prices = fuel_prices or dict(REGIONAL_FUEL_PRICES)
        self.safety_margin_l = safety_margin_litres

    # ── Public API ────────────────────────────────────────────────────────
    def optimize(
        self,
        waypoints: list[dict],
        vehicle_spec: dict,
        start_fuel_litres: float | None = None,
    ) -> FuelPlan:
        """Compute optimal fuel stops.

        Args:
            waypoints: list of {name, country_code, distance_from_prev_km, fuel_price_override}
            vehicle_spec: {fuel_capacity_litres, consumption_l_per_100km}
            start_fuel_litres: starting fuel level (default: full tank)

        Returns:
            FuelPlan with optimal stops and total cost.
        """
        tank_cap_l = vehicle_spec.get("fuel_capacity_litres", 400)
        consumption = vehicle_spec.get("consumption_l_per_100km", 35.0)

        if start_fuel_litres is None:
            start_fuel_litres = tank_cap_l

        n = len(waypoints)

        # Compute cumulative distances and fuel needed
        distances = [0.0]
        for wp in waypoints:
            d = wp.get("distance_from_prev_km", 0)
            distances.append(distances[-1] + d)

        total_km = distances[-1]

        # DP: min cost to reach waypoint i with fuel level f
        # Discretize fuel levels in 5-litre increments
        step = 5.0
        levels = int(tank_cap_l / step) + 1
        INF = float("inf")

        dp = [[INF] * levels for _ in range(n + 1)]
        decision: list[list[tuple[float, int, float] | None]] = [
            [None] * levels for _ in range(n + 1)
        ]

        # Starting state
        start_idx = int(start_fuel_litres / step)
        dp[0][min(start_idx, levels - 1)] = 0.0

        for i in range(n):
            wp = waypoints[i]
            seg_dist = wp.get("distance_from_prev_km", distances[i + 1] - distances[i])
            fuel_needed = seg_dist * consumption / 100.0
            country = wp.get("country_code", "KE")
            price_per_l = wp.get("fuel_price_override", self.prices.get(country, 1.15))

            for f_idx in range(levels):
                fuel_l = f_idx * step
                if dp[i][f_idx] >= INF:
                    continue

                # Can we reach the next waypoint with current fuel?
                if fuel_l < fuel_needed + self.safety_margin_l:
                    continue  # must refuel — handled in the buy loop below

                # Option: don't refuel, just drive through
                arrived_fuel = fuel_l - fuel_needed
                arrived_idx = int(arrived_fuel / step)
                if arrived_idx >= 0 and arrived_idx < levels:
                    if dp[i][f_idx] < dp[i + 1][arrived_idx]:
                        dp[i + 1][arrived_idx] = dp[i][f_idx]
                        decision[i + 1][arrived_idx] = (fuel_l, 0, 0.0)

            # Option: refuel at waypoint i, then continue
            # We need at least fuel_needed + safety to continue
            min_fuel_after = fuel_needed + self.safety_margin_l
            for buy_litres_idx in range(1, levels):
                buy_l = buy_litres_idx * step
                # Check: can we add this much fuel?
                for f_idx in range(levels):
                    current_fuel = f_idx * step
                    if dp[i][f_idx] >= INF:
                        continue
                    after_refuel = current_fuel + buy_l
                    if after_refuel > tank_cap_l:
                        continue
                    if after_refuel < min_fuel_after:
                        continue

                    arrived_fuel = after_refuel - fuel_needed
                    arrived_idx = int(arrived_fuel / step)
                    if not (0 <= arrived_idx < levels):
                        continue

                    cost = dp[i][f_idx] + buy_l * price_per_l
                    if cost < dp[i + 1][arrived_idx]:
                        dp[i + 1][arrived_idx] = cost
                        decision[i + 1][arrived_idx] = (current_fuel, buy_l, price_per_l)

        # Find best final state
        best_cost = INF
        best_final_idx = 0
        for f_idx in range(levels):
            if dp[n][f_idx] < best_cost:
                best_cost = dp[n][f_idx]
                best_final_idx = f_idx

        # Backtrack to find the plan
        stops = []
        f_idx = best_final_idx
        for i in range(n, 0, -1):
            dec = decision[i][f_idx]
            if dec is None:
                continue
            prev_fuel, bought_l, price = dec
            if bought_l > 0:
                wp = waypoints[i - 1]
                stops.append(FuelStop(
                    waypoint_index=i - 1,
                    location_name=wp.get("name", f"Waypoint {i - 1}"),
                    country_code=wp.get("country_code", "??"),
                    litres_to_add=round(bought_l, 1),
                    price_per_litre=round(price, 3),
                    cost_usd=round(bought_l * price, 2),
                    fuel_level_after=round(prev_fuel + bought_l, 1),
                ))
            # Move to previous fuel level
            prev_idx = int(prev_fuel / step)
            f_idx = prev_idx if 0 <= prev_idx < levels else f_idx

        stops.reverse()

        total_fuel_consumed = total_km * consumption / 100.0

        return FuelPlan(
            route_name=waypoints[0].get("name", "Route") if waypoints else "Route",
            total_distance_km=round(total_km, 1),
            total_fuel_consumed_l=round(total_fuel_consumed, 1),
            total_cost_usd=round(best_cost, 2),
            stops=stops,
        )

    def save(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"prices": self.prices, "safety_margin_l": self.safety_margin_l}, indent=2))

    def load(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        if not path.exists():
            return False
        data = json.loads(path.read_text())
        self.prices = data.get("prices", self.prices)
        self.safety_margin_l = data.get("safety_margin_l", 20.0)
        return True
