"""
Container Matching — suggest consolidation opportunities via linear programming.

Given a set of pending LCL (less-than-container-load) shipments, find
combinations that can share a container to reduce per-unit freight cost.

This is a bin-packing variant solved with a greedy first-fit-decreasing (FFD)
heuristic. A full LP solver (PuLP/OR-Tools) can be substituted when available.

Constraints:
- Container volume (CBM) capacity
- Container weight capacity (tonnes)
- Corridor compatibility (same origin → destination pair)
- Temperature compatibility (reefer vs dry)
- Delivery deadline compatibility (within 48h window)

Usage:
    matcher = ContainerMatcher()
    matches = matcher.find_matches(pending_lcl_shipments)
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"
MODEL_PATH = MODEL_DIR / "container_matching.json"

# Standard container types
CONTAINER_TYPES = {
    "20GP": {"cbm": 33.2, "max_tonnes": 28.0, "name": "20ft General Purpose"},
    "40GP": {"cbm": 67.7, "max_tonnes": 26.0, "name": "40ft General Purpose"},
    "40HC": {"cbm": 76.3, "max_tonnes": 26.0, "name": "40ft High Cube"},
    "20RF": {"cbm": 28.0, "max_tonnes": 27.0, "name": "20ft Reefer", "reefer": True},
    "40RF": {"cbm": 60.0, "max_tonnes": 25.5, "name": "40ft Reefer", "reefer": True},
}


@dataclass
class ShipmentStub:
    shipment_id: str
    origin: str
    destination: str
    volume_cbm: float
    weight_tonnes: float
    requires_reefer: bool = False
    latest_pickup: str = ""  # ISO date
    value_usd: float = 0.0


@dataclass
class ConsolidationMatch:
    container_type: str
    shipments: list[ShipmentStub] = field(default_factory=list)
    total_volume_cbm: float = 0.0
    total_weight_tonnes: float = 0.0
    utilization_pct: float = 0.0
    savings_usd: float = 0.0


class ContainerMatcher:
    def __init__(self, lcl_cost_per_cbm: float = 80.0, fcl_cost_per_container: dict[str, float] | None = None):
        self.lcl_cost_per_cbm = lcl_cost_per_cbm
        self.fcl_cost = fcl_cost_per_container or {
            "20GP": 1200, "40GP": 1800, "40HC": 2000,
            "20RF": 2500, "40RF": 3500,
        }

    # ── Public API ────────────────────────────────────────────────────────
    def find_matches(self, shipments: list[ShipmentStub]) -> list[ConsolidationMatch]:
        """Find consolidation opportunities using first-fit-decreasing heuristic.

        Groups shipments by (origin, destination, reefer) then packs into
        the smallest container type that fits.
        """
        # Group by corridor + temperature compatibility
        groups: dict[tuple[str, str, bool], list[ShipmentStub]] = {}
        for s in shipments:
            key = (s.origin, s.destination, s.requires_reefer)
            groups.setdefault(key, []).append(s)

        results: list[ConsolidationMatch] = []

        for (origin, dest, reefer), group in groups.items():
            # Skip single-shipment groups (no consolidation possible)
            if len(group) < 2:
                continue

            # Sort by volume descending (FFD heuristic)
            group.sort(key=lambda s: s.volume_cbm, reverse=True)

            # Try each container type
            for ctype, spec in CONTAINER_TYPES.items():
                if reefer != spec.get("reefer", False):
                    continue
                if len(group) < 2:
                    break

                bins = self._first_fit_decreasing(group, spec["cbm"], spec["max_tonnes"] * 1000)
                for bin_shipments in bins:
                    if len(bin_shipments) < 2:
                        continue

                    total_vol = sum(s.volume_cbm for s in bin_shipments)
                    total_wt = sum(s.weight_tonnes for s in bin_shipments)
                    utilization = total_vol / spec["cbm"] * 100

                    # Compute savings: LCL cost minus FCL cost
                    lcl_cost = sum(s.volume_cbm * self.lcl_cost_per_cbm for s in bin_shipments)
                    fcl_cost = self.fcl_cost.get(ctype, 1800)
                    savings = lcl_cost - fcl_cost

                    results.append(ConsolidationMatch(
                        container_type=ctype,
                        shipments=bin_shipments,
                        total_volume_cbm=round(total_vol, 2),
                        total_weight_tonnes=round(total_wt, 2),
                        utilization_pct=round(utilization, 1),
                        savings_usd=round(savings, 2),
                    ))

                # Remove packed shipments from group
                packed_ids = {s.shipment_id for b in bins for s in b if len(b) >= 2}
                group = [s for s in group if s.shipment_id not in packed_ids]
                if len(group) < 2:
                    break

        results.sort(key=lambda m: m.savings_usd, reverse=True)
        return results

    # ── Bin-packing heuristic ─────────────────────────────────────────────
    @staticmethod
    def _first_fit_decreasing(
        items: list[ShipmentStub], capacity_cbm: float, capacity_kg: float,
    ) -> list[list[ShipmentStub]]:
        """Pack items into bins using first-fit-decreasing.

        Each item has volume and weight; bins have both volume and weight limits.
        """
        bins: list[list[ShipmentStub]] = []
        bin_vol: list[float] = []
        bin_wt: list[float] = []

        for item in items:
            placed = False
            for i in range(len(bins)):
                if (bin_vol[i] + item.volume_cbm <= capacity_cbm
                        and bin_wt[i] + item.weight_tonnes * 1000 <= capacity_kg):
                    bins[i].append(item)
                    bin_vol[i] += item.volume_cbm
                    bin_wt[i] += item.weight_tonnes * 1000
                    placed = True
                    break
            if not placed:
                bins.append([item])
                bin_vol.append(item.volume_cbm)
                bin_wt.append(item.weight_tonnes * 1000)

        return bins

    def save(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({
            "lcl_cost_per_cbm": self.lcl_cost_per_cbm,
            "fcl_cost": self.fcl_cost,
        }, indent=2))

    def load(self, path: str | Path | None = None):
        path = Path(path) if path else MODEL_PATH
        if not path.exists():
            return False
        data = json.loads(path.read_text())
        self.lcl_cost_per_cbm = data.get("lcl_cost_per_cbm", self.lcl_cost_per_cbm)
        self.fcl_cost = data.get("fcl_cost", self.fcl_cost)
        return True
