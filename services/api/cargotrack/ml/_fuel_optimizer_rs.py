"""
Rust-accelerated fuel optimizer adapter.

Wraps ``fuel_optimizer_rs.optimize()`` (PyO3 binding) so callers get the
same ``FuelPlan`` / ``FuelStop`` dataclasses as the pure-Python path.

Usage::

    from cargotrack.ml._fuel_optimizer_rs import optimize_rs

    plan = optimize_rs(waypoints, vehicle_spec, start_fuel_litres)
    # plan is a FuelPlan identical to the Python FuelOptimizer.optimize() result
"""

from __future__ import annotations

from .fuel_optimizer import FuelPlan, FuelStop

try:
    import fuel_optimizer_rs  # type: ignore[import-untyped]
    _HAS_RUST = True
except ImportError:
    _HAS_RUST = False


def _convert_waypoint(wp: dict) -> dict:
    """Convert Python waypoint dict to the flat dict the Rust binding expects."""
    return {
        "name": wp.get("name", ""),
        "country_code": wp.get("country_code", "KE"),
        "distance_from_prev_km": wp.get("distance_from_prev_km", 0.0),
        "fuel_price_override": wp.get("fuel_price_override"),
    }


def optimize_rs(
    waypoints: list[dict],
    vehicle_spec: dict,
    start_fuel_litres: float | None = None,
    safety_margin_litres: float = 20.0,
) -> FuelPlan:
    """
    Compute optimal fuel stops using the Rust DP implementation.

    Falls back to pure Python if the Rust extension is not installed.
    """
    if _HAS_RUST:
        rust_waypoints = [_convert_waypoint(wp) for wp in waypoints]
        result = fuel_optimizer_rs.optimize(
            rust_waypoints,
            vehicle_spec,
            start_fuel_litres,
            safety_margin_litres,
        )
        stops = [
            FuelStop(
                waypoint_index=s["waypoint_index"],
                location_name=s["location_name"],
                country_code=s["country_code"],
                litres_to_add=s["litres_to_add"],
                price_per_litre=s["price_per_litre"],
                cost_usd=s["cost_usd"],
                fuel_level_after=s["fuel_level_after"],
            )
            for s in result["stops"]
        ]
        return FuelPlan(
            route_name=waypoints[0].get("name", "Route") if waypoints else "Route",
            total_distance_km=result["total_distance_km"],
            total_fuel_consumed_l=result["total_fuel_consumed_l"],
            total_cost_usd=result["total_cost_usd"],
            stops=stops,
        )

    # Fallback to pure Python
    from .fuel_optimizer import FuelOptimizer
    return FuelOptimizer().optimize(waypoints, vehicle_spec, start_fuel_litres)
