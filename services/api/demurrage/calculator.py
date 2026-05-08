"""
demurrage/calculator.py — Demurrage and detention calculation engine.

Formula:
    demurrage_days = max(0, container_returned_date - free_days_expiry)
    detention_days = max(0, container_returned_date - free_days_after_pickup)
    total_charge = sum(daily_rate * days_in_tier for each rate tier)

EAC tariff escalation: rates increase after day 5, day 10, day 15, etc.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from django.utils import timezone


# ── EAC Port default free days ─────────────────────────────────────────────

PORT_FREE_DAYS: dict[str, dict[str, int]] = {
    "KEMBA": {  # Mombasa, Kenya
        "import_20ft": 4, "import_40ft": 4,
        "export_20ft": 7, "export_40ft": 7,
        "transit": 14,
    },
    "TZDAR": {  # Dar es Salaam, Tanzania
        "import_20ft": 7, "import_40ft": 7,
        "export_20ft": 14, "export_40ft": 14,
        "transit": 21,
    },
    "KENBO": {  # Nairobi ICD, Kenya
        "import_20ft": 3, "import_40ft": 3,
        "export_20ft": 5, "export_40ft": 5,
        "transit": 7,
    },
    "UGKAM": {  # Kampala ICD, Uganda
        "import_20ft": 3, "import_40ft": 3,
        "export_20ft": 5, "export_40ft": 5,
        "transit": 7,
    },
    "RWKGL": {  # Kigali ICD, Rwanda
        "import_20ft": 3, "import_40ft": 3,
        "export_20ft": 5, "export_40ft": 5,
        "transit": 7,
    },
}

# ── Default tariff escalation per port ─────────────────────────────────────

TARIFF_TIERS: dict[str, list[dict]] = {
    "KEMBA": [
        {"days": (1, 5), "rate_20ft": Decimal("20.00"), "rate_40ft": Decimal("40.00"), "rate_reefer": Decimal("60.00")},
        {"days": (6, 10), "rate_20ft": Decimal("40.00"), "rate_40ft": Decimal("80.00"), "rate_reefer": Decimal("100.00")},
        {"days": (11, 15), "rate_20ft": Decimal("60.00"), "rate_40ft": Decimal("120.00"), "rate_reefer": Decimal("160.00")},
        {"days": (16, 99), "rate_20ft": Decimal("100.00"), "rate_40ft": Decimal("200.00"), "rate_reefer": Decimal("250.00")},
    ],
    "TZDAR": [
        {"days": (1, 7), "rate_20ft": Decimal("15.00"), "rate_40ft": Decimal("30.00"), "rate_reefer": Decimal("50.00")},
        {"days": (8, 14), "rate_20ft": Decimal("30.00"), "rate_40ft": Decimal("60.00"), "rate_reefer": Decimal("80.00")},
        {"days": (15, 99), "rate_20ft": Decimal("50.00"), "rate_40ft": Decimal("100.00"), "rate_reefer": Decimal("150.00")},
    ],
    "KENBO": [
        {"days": (1, 3), "rate_20ft": Decimal("10.00"), "rate_40ft": Decimal("20.00"), "rate_reefer": Decimal("30.00")},
        {"days": (4, 7), "rate_20ft": Decimal("25.00"), "rate_40ft": Decimal("50.00"), "rate_reefer": Decimal("70.00")},
        {"days": (8, 99), "rate_20ft": Decimal("50.00"), "rate_40ft": Decimal("100.00"), "rate_reefer": Decimal("130.00")},
    ],
    "UGKAM": [
        {"days": (1, 3), "rate_20ft": Decimal("10.00"), "rate_40ft": Decimal("20.00"), "rate_reefer": Decimal("30.00")},
        {"days": (4, 7), "rate_20ft": Decimal("20.00"), "rate_40ft": Decimal("40.00"), "rate_reefer": Decimal("60.00")},
        {"days": (8, 99), "rate_20ft": Decimal("40.00"), "rate_40ft": Decimal("80.00"), "rate_reefer": Decimal("120.00")},
    ],
    "RWKGL": [
        {"days": (1, 3), "rate_20ft": Decimal("10.00"), "rate_40ft": Decimal("20.00"), "rate_reefer": Decimal("30.00")},
        {"days": (4, 7), "rate_20ft": Decimal("20.00"), "rate_40ft": Decimal("40.00"), "rate_reefer": Decimal("60.00")},
        {"days": (8, 99), "rate_20ft": Decimal("40.00"), "rate_40ft": Decimal("80.00"), "rate_reefer": Decimal("120.00")},
    ],
}


def get_free_days(
    port_code: str, container_type: str = "20FT_DRY", shipment_type: str = "IMPORT"
) -> int:
    """Get free days for a container at a specific port."""
    port = PORT_FREE_DAYS.get(port_code.upper(), PORT_FREE_DAYS["KEMBA"])

    is_40ft = "40FT" in container_type.upper()
    size_key = "40ft" if is_40ft else "20ft"

    if shipment_type.upper() == "IMPORT":
        return port.get(f"import_{size_key}", 4)
    elif shipment_type.upper() == "EXPORT":
        return port.get(f"export_{size_key}", 7)
    else:
        return port.get("transit", 7)


def calculate_demurrage(
    port_code: str,
    container_type: str = "20FT_DRY",
    shipment_type: str = "IMPORT",
    arrival_date: Optional[date] = None,
    return_date: Optional[date] = None,
    free_days_override: Optional[int] = None,
) -> dict:
    """
    Calculate demurrage/detention charges for a container at an EAC port.

    Returns detailed breakdown with daily accrual.
    """
    today = timezone.now().date()

    # Determine free days
    free_days = free_days_override if free_days_override is not None else get_free_days(
        port_code, container_type, shipment_type
    )

    # Calculate start of counting (after free days)
    if arrival_date is None:
        arrival_date = today
    free_days_expiry = arrival_date + timezone.timedelta(days=free_days)

    # Calculate chargeable days
    end_date = return_date if return_date else today
    if end_date <= free_days_expiry:
        # No demurrage — all within free period
        return {
            "port_code": port_code.upper(),
            "container_type": container_type,
            "shipment_type": shipment_type,
            "arrival_date": arrival_date.isoformat(),
            "free_days": free_days,
            "free_days_expiry": free_days_expiry.isoformat(),
            "return_date": end_date.isoformat(),
            "chargeable_days": 0,
            "total_demurrage_usd": "0.00",
            "total_detention_usd": "0.00",
            "grand_total_usd": "0.00",
            "status": "WITHIN_FREE_PERIOD",
            "daily_breakdown": [],
            "attribution": None,
        }

    chargeable_days = (end_date - free_days_expiry).days
    tiers = TARIFF_TIERS.get(port_code.upper(), TARIFF_TIERS["KEMBA"])

    # Determine rate per container type
    is_40ft = "40FT" in container_type.upper()
    is_reefer = "REEFER" in container_type.upper()
    
    if is_reefer:
        rate_key = "rate_reefer"
    elif is_40ft:
        rate_key = "rate_40ft"
    else:
        rate_key = "rate_20ft"

    # Calculate by day with tier escalation
    total = Decimal("0")
    daily_breakdown: list[dict] = []

    for day in range(1, chargeable_days + 1):
        # Find applicable tier
        daily_rate = Decimal("0")
        for tier in tiers:
            tier_start, tier_end = tier["days"]
            if tier_start <= day <= min(tier_end, 99):
                daily_rate = tier[rate_key]
                break

        total += daily_rate
        daily_breakdown.append({
            "day": day,
            "date": (free_days_expiry + timezone.timedelta(days=day)).isoformat(),
            "daily_rate_usd": str(daily_rate),
            "running_total_usd": str(total),
        })

    # Attribution
    attribution = _determine_responsibility(shipment_type, chargeable_days)

    return {
        "port_code": port_code.upper(),
        "container_type": container_type,
        "shipment_type": shipment_type,
        "arrival_date": arrival_date.isoformat(),
        "free_days": free_days,
        "free_days_expiry": free_days_expiry.isoformat(),
        "return_date": end_date.isoformat(),
        "chargeable_days": chargeable_days,
        "total_demurrage_usd": str(total),
        "total_detention_usd": "0.00",
        "grand_total_usd": str(total),
        "status": "ACCRUING" if not return_date else "FINAL",
        "daily_breakdown": daily_breakdown,
        "attribution": attribution,
    }


def calculate_detention(
    port_code: str,
    container_type: str = "20FT_DRY",
    pickup_date: Optional[date] = None,
    return_date: Optional[date] = None,
    free_days_after_pickup: int = 3,
) -> dict:
    """Calculate detention charges (container held by consignee beyond free days)."""
    today = timezone.now().date()

    if pickup_date is None:
        pickup_date = today
    if return_date is None:
        return_date = today

    chargeable_days = max(0, (return_date - pickup_date).days - free_days_after_pickup)

    # Detention rates are typically half of demurrage rates
    daily_rate = Decimal("30.00")  # default for 20ft
    if "40FT" in container_type.upper():
        daily_rate = Decimal("60.00")
    elif "REEFER" in container_type.upper():
        daily_rate = Decimal("90.00")

    total = daily_rate * chargeable_days

    return {
        "port_code": port_code.upper(),
        "container_type": container_type,
        "pickup_date": pickup_date.isoformat(),
        "free_days_after_pickup": free_days_after_pickup,
        "return_date": return_date.isoformat(),
        "chargeable_days": chargeable_days,
        "daily_rate_usd": str(daily_rate),
        "total_detention_usd": str(total),
        "status": "ACCRUING" if not return_date else "FINAL",
    }


def batch_port_status(port_code: str) -> list[dict]:
    """Get demurrage status for all containers at a port."""
    from .models import ContainerTracking

    containers = ContainerTracking.objects.filter(
        port_of_discharge=port_code.upper(),
        is_resolved=False,
    ).select_related("shipment")

    results = []
    for container in containers:
        result = calculate_demurrage(
            port_code=port_code,
            container_type=container.container_type,
            shipment_type=container.shipment_type,
            arrival_date=container.vessel_arrival_date,
            return_date=container.container_returned_date,
        )
        result["container_number"] = container.container_number
        result["tracking_number"] = container.shipment.tracking_number
        results.append(result)

    return results


def _determine_responsibility(shipment_type: str, chargeable_days: int) -> str:
    """Attribute demurrage responsibility."""
    if shipment_type.upper() == "IMPORT":
        if chargeable_days <= 3:
            return "CONSIGNEE — minor delay, typically consignee's clearing agent"
        elif chargeable_days <= 7:
            return "CONSIGNEE — significant delay; verify customs clearance status"
        else:
            return "CONSIGNEE + CUSTOMS — extended delay; possible inspection hold"
    elif shipment_type.upper() == "EXPORT":
        return "CARRIER — export containers typically at carrier's risk"
    else:
        return "TRANSIT BOND — responsibility with transit guarantor"
