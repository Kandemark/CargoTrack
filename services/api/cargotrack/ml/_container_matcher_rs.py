"""
Rust-accelerated container matcher adapter.

Wraps ``container_matcher_rs.find_matches()`` (PyO3 binding) so callers
get the same ``ConsolidationMatch`` / ``ShipmentStub`` shape as the
pure-Python path.

Usage::

    from cargotrack.ml._container_matcher_rs import find_matches_rs

    matches = find_matches_rs(shipments, lcl_cost_per_cbm=80.0)
"""

from __future__ import annotations

from .container_matching import ConsolidationMatch, ShipmentStub

try:
    import container_matcher_rs  # type: ignore[import-untyped]
    _HAS_RUST = True
except ImportError:
    _HAS_RUST = False


def _shipment_to_dict(s: ShipmentStub) -> dict:
    return {
        "shipment_id": s.shipment_id,
        "origin": s.origin,
        "destination": s.destination,
        "volume_cbm": s.volume_cbm,
        "weight_tonnes": s.weight_tonnes,
        "requires_reefer": s.requires_reefer,
    }


def find_matches_rs(
    shipments: list[ShipmentStub],
    lcl_cost_per_cbm: float = 80.0,
) -> list[ConsolidationMatch]:
    """
    Find consolidation opportunities using the Rust FFD bin-packing.

    Falls back to pure Python if the Rust extension is not installed.
    """
    if _HAS_RUST:
        rust_shipments = [_shipment_to_dict(s) for s in shipments]
        results = container_matcher_rs.find_matches(rust_shipments, lcl_cost_per_cbm)
        return [
            ConsolidationMatch(
                container_type=m["container_type"],
                shipments=[
                    s for s in shipments
                    if s.shipment_id in m["shipments"]
                ],
                total_volume_cbm=m["total_volume_cbm"],
                total_weight_tonnes=m["total_weight_tonnes"],
                utilization_pct=m["utilization_pct"],
                savings_usd=m["savings_usd"],
            )
            for m in results
        ]

    # Fallback to pure Python
    from .container_matching import ContainerMatcher
    return ContainerMatcher(lcl_cost_per_cbm=lcl_cost_per_cbm).find_matches(shipments)
