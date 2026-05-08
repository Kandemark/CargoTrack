"""
Domain: Port Operations
───────────────────────
Demurrage, detention, and port storage charge calculation for East African
ports — Mombasa (KEMBA), Dar es Salaam (TZDAR), Nairobi ICD (KENBO),
Kampala ICD (UGKAM), Kigali ICD (RWKGL).  Tiered tariff escalation after
free days with responsibility attribution.

Aggregate Roots
~~~~~~~~~~~~~~~
**ContainerTracking** (``demurrage.models.ContainerTracking``)
    Tracks a single container from vessel arrival through port discharge,
    customs clearance, and final return.  Demurrage accrues when the
    container stays beyond free days.

    Invariants:
    - ``port_of_discharge`` MUST be a valid EAC port code.
    - ``vessel_arrival_date`` cannot be in the future.
    - ``container_returned_date`` >= ``vessel_arrival_date`` (if set).
    - Delay attribution is auto-determined from shipment type and chargeable days.

**PortFreeTimeConfig** (``demurrage.models.PortFreeTimeConfig``)
    Reference data per port: how many free days each container type gets.

    Invariants:
    - ``port_code`` is unique (UN/LOCODE).
    - Free days must be non-negative integers.

Owns
~~~~
- ``demurrage``           Library module — models + calculator (NOT a Django app)

Depends on
~~~~~~~~~~
- ``domains.shipments``   Shipment FK (container tracking)
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from domains._events import DemurrageAccrued, DemurrageStarted, event_bus
from domains._value_objects import ContainerType, Money, PortCode

# ── Low-level services (primitive-based — re-exported for views) ─────────────
from demurrage.calculator import (          # noqa: F401  (re-exported)
    PORT_FREE_DAYS,
    TARIFF_TIERS,
    calculate_demurrage as _calc_demurrage_primitive,
    calculate_detention as _calc_detention_primitive,
    batch_port_status as _batch_port_primitive,
    get_free_days as _get_free_days_primitive,
)

from shipments.api_views import DemurrageCalculateView, DemurragePortStatusView


# ── Domain-level facades (value-object-based) ────────────────────────────────

def get_free_days(
    port: PortCode,
    container: ContainerType,
    shipment_type: str = "IMPORT",
) -> int:
    """Get free days for a container at a port (value-object interface)."""
    return _get_free_days_primitive(port.code, container.code, shipment_type)


def calculate_demurrage(
    port: PortCode,
    container: ContainerType,
    shipment_type: str = "IMPORT",
    arrival_date: Optional[date] = None,
    return_date: Optional[date] = None,
    free_days_override: Optional[int] = None,
) -> dict:
    """
    Calculate demurrage charges (value-object interface).

    Publishes DemurrageStarted or DemurrageAccrued events.
    """
    result = _calc_demurrage_primitive(
        port_code=port.code,
        container_type=container.code,
        shipment_type=shipment_type,
        arrival_date=arrival_date,
        return_date=return_date,
        free_days_override=free_days_override,
    )

    chargeable = result["chargeable_days"]
    if chargeable == 0:
        event_bus.publish(DemurrageStarted(
            aggregate_id=f"{port.code}:{container.code}",
            container_number="",  # filled by caller with actual container
            port_code=port.code,
            free_days_expiry=result["free_days_expiry"],
        ))
    else:
        event_bus.publish(DemurrageAccrued(
            aggregate_id=f"{port.code}:{container.code}",
            container_number="",
            port_code=port.code,
            chargeable_days=chargeable,
            total_usd=result["total_demurrage_usd"],
        ))

    return result


def calculate_detention(
    port: PortCode,
    container: ContainerType,
    pickup_date: Optional[date] = None,
    return_date: Optional[date] = None,
    free_days_after_pickup: int = 3,
) -> dict:
    """Calculate detention charges (value-object interface)."""
    return _calc_detention_primitive(
        port_code=port.code,
        container_type=container.code,
        pickup_date=pickup_date,
        return_date=return_date,
        free_days_after_pickup=free_days_after_pickup,
    )


def batch_port_status(port: PortCode) -> list[dict]:
    """Get demurrage status for all containers at a port."""
    return _batch_port_primitive(port.code)


__all__ = [
    # Value Objects
    "ContainerType", "Money", "PortCode",
    # Constants
    "PORT_FREE_DAYS",
    "TARIFF_TIERS",
    # Domain services
    "batch_port_status",
    "calculate_demurrage",
    "calculate_detention",
    "DemurrageCalculateView",
    "DemurragePortStatusView",
    "get_free_days",
]
