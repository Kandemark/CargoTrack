"""
contracts/services.py — Rate matching and contract reconciliation engine.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional


def match_rate(
    origin: str, destination: str, weight_kg: Decimal,
    vehicle_type: str = "", carrier_id: Optional[int] = None,
    prefer_contract: bool = True,
) -> dict:
    """
    Find the best applicable rate for a shipment.

    Priority:
    1. Active contract rate (if prefer_contract and carrier has one)
    2. Rate card for the corridor
    3. Spot market estimate
    """
    weight_kg = Decimal(str(weight_kg))

    # In production, this queries Contract/RateCard/RateLine models.
    # For now, use corridor-based rate estimates.
    corridor_key = f"{origin.lower().strip()}-{destination.lower().strip()}"

    # Estimated rates per corridor per kg (USD)
    CORRIDOR_RATES: dict[str, dict] = {
        "mombasa-nairobi": {"contract": Decimal("0.08"), "spot": Decimal("0.12")},
        "mombasa-kampala": {"contract": Decimal("0.14"), "spot": Decimal("0.20")},
        "mombasa-kigali": {"contract": Decimal("0.18"), "spot": Decimal("0.26")},
        "nairobi-kampala": {"contract": Decimal("0.10"), "spot": Decimal("0.15")},
        "nairobi-kigali": {"contract": Decimal("0.14"), "spot": Decimal("0.21")},
        "nairobi-dar es salaam": {"contract": Decimal("0.12"), "spot": Decimal("0.18")},
        "dar es salaam-kigali": {"contract": Decimal("0.16"), "spot": Decimal("0.24")},
        "kampala-kigali": {"contract": Decimal("0.06"), "spot": Decimal("0.09")},
    }

    rates = CORRIDOR_RATES.get(corridor_key, {"contract": Decimal("0.10"), "spot": Decimal("0.15")})

    rate_type = "CONTRACT" if prefer_contract else "SPOT"
    base_rate = rates["contract"] if prefer_contract else rates["spot"]
    spot_rate = rates["spot"]

    total = (weight_kg * base_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    spot_total = (weight_kg * spot_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    savings = spot_total - total if prefer_contract else Decimal("0")

    # Apply fuel surcharge (default 15% for illustration)
    fuel_surcharge = (total * Decimal("0.15")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "corridor": corridor_key.replace("-", " → ").title(),
        "rate_type": rate_type,
        "base_rate_per_kg": str(base_rate),
        "weight_kg": str(weight_kg),
        "subtotal": str(total),
        "fuel_surcharge_15pct": str(fuel_surcharge),
        "border_fees": str(Decimal("50.00")) if "kampala" in corridor_key or "kigali" in corridor_key else str(Decimal("0")),
        "total": str(total + fuel_surcharge + (Decimal("50.00") if "kampala" in corridor_key or "kigali" in corridor_key else Decimal("0"))),
        "spot_market_rate": str(spot_rate),
        "spot_market_total": str(spot_total),
        "savings_vs_spot": str(savings),
        "savings_pct": str(round(savings / spot_total * 100, 1)) if spot_total > 0 else "0",
    }


def reconcile_contract(contract) -> dict:
    """Reconcile contract actuals vs committed volumes."""
    committed = contract.committed_shipments
    actual = contract.actual_shipments
    utilization = round(actual / committed * 100, 2) if committed else 0
    shortfall = max(0, committed - actual)
    penalty = Decimal("0")

    if shortfall > 0 and contract.penalty_per_missed_shipment:
        penalty = contract.penalty_per_missed_shipment * shortfall

    return {
        "contract_number": contract.contract_number,
        "status": contract.status,
        "committed_shipments": committed,
        "actual_shipments": actual,
        "utilization_pct": utilization,
        "shortfall": shortfall,
        "penalty_per_shipment": str(contract.penalty_per_missed_shipment),
        "total_penalty": str(penalty),
        "on_track": utilization >= 80,
    }


def compare_contract_vs_spot(
    origin: str, destination: str, weight_kg: Decimal, vehicle_type: str = ""
) -> dict:
    """Side-by-side comparison of contract vs spot market rates."""
    contract_rate = match_rate(origin, destination, weight_kg, vehicle_type, prefer_contract=True)
    spot_rate = match_rate(origin, destination, weight_kg, vehicle_type, prefer_contract=False)
    return {
        "origin": origin,
        "destination": destination,
        "weight_kg": str(weight_kg),
        "contract": {
            "rate_per_kg": contract_rate["base_rate_per_kg"],
            "total": contract_rate["total"],
        },
        "spot": {
            "rate_per_kg": spot_rate["base_rate_per_kg"],
            "total": spot_rate["spot_market_total"],
        },
        "savings_with_contract": contract_rate["savings_vs_spot"],
        "savings_pct": contract_rate["savings_pct"],
    }
