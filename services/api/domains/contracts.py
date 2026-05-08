"""
Domain: Contracts & Rates
──────────────────────────
Freight contract lifecycle — rate cards, corridor pricing, tiered volume
discounts, spot-market comparison, and contract-utilization reconciliation.

Aggregate Roots
~~~~~~~~~~~~~~~
**Contract** (``contracts.models.Contract``)
    A shipper-carrier agreement with committed volumes, validity window,
    and penalty clauses.

    Invariants:
    - ``effective_from`` <= ``effective_until``.
    - ``committed_shipments`` > 0.
    - A contract belongs to exactly one carrier.
    - Active contracts cannot overlap for the same carrier+corridor.

**RateCard** (``contracts.models.RateCard``)
    A carrier's price list for specific corridors and vehicle types.
    Contracts reference rate cards for pricing.

    Invariants:
    - A rate card MUST have at least one RateLine.
    - ``effective_from`` <= ``effective_until``.
    - No two active rate cards for the same carrier+corridor may overlap.

Owns
~~~~
- ``contracts``           Library module — models + services (NOT a Django app)

Depends on
~~~~~~~~~~
- ``domains.partners``    Carrier model (FK target)
- ``domains.shipments``   Shipment model (FK target)
- ``domains.identity``    User model (FK target)
"""
from __future__ import annotations

from decimal import Decimal

from domains._events import ContractUtilizationUpdated, event_bus
from domains._value_objects import Corridor, Money, Weight

# ── Low-level services (primitive-based — re-exported for views) ─────────────
from contracts.services import (           # noqa: F401  (re-exported)
    compare_contract_vs_spot,
    match_rate as _match_rate_primitive,
    reconcile_contract as _reconcile_primitive,
)

from shipments.api_views import RateComparisonView, RateLookupView


# ── Domain-level facades (value-object-based) ────────────────────────────────

def match_rate(
    corridor: Corridor,
    weight: Weight,
    vehicle_type: str = "",
    prefer_contract: bool = True,
) -> dict:
    """
    Find the best applicable rate for a shipment on a corridor.

    Accepts domain value objects; delegates to the primitive-level service
    and enriches the result with a Money value object for the total.
    """
    result = _match_rate_primitive(
        origin=corridor.origin,
        destination=corridor.destination,
        weight_kg=weight.value_kg,
        vehicle_type=vehicle_type,
        prefer_contract=prefer_contract,
    )
    result["corridor"] = corridor.display_name
    result["weight"] = str(weight)
    return result


def reconcile_contract(contract) -> dict:
    """
    Reconcile contract actuals vs committed volumes.

    Publishes a ``ContractUtilizationUpdated`` event when utilization changes.
    """
    result = _reconcile_primitive(contract)

    event_bus.publish(ContractUtilizationUpdated(
        aggregate_id=str(contract.id),
        contract_number=contract.contract_number,
        utilization_pct=result["utilization_pct"],
        shortfall=result["shortfall"],
        on_track=result["on_track"],
    ))

    return result


__all__ = [
    # Value Objects
    "Corridor", "Money", "Weight",
    # Domain services
    "compare_contract_vs_spot",
    "match_rate",
    "RateComparisonView",
    "RateLookupView",
    "reconcile_contract",
]
