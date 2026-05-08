"""
coldchain/compliance.py — GDP/GSP compliance engine for cold chain shipments.

GDP (Good Distribution Practice) — WHO/EU guidelines for pharmaceutical logistics:
    - Continuous temperature monitoring with NIST-traceable sensors
    - Excursion documentation with root cause analysis
    - Certificate of compliance at delivery
    - 15-minute minimum logging interval

GSP (Good Storage Practice) — for perishable food/flowers:
    - Cold chain integrity verification
    - Visual inspection records at handover points
    - Shelf-life impact assessment from temperature excursions
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from django.utils import timezone

logger = logging.getLogger(__name__)


# ── GDP Product-specific temperature ranges ───────────────────────────────

GDP_TEMP_RANGES = {
    "PHARMA": {
        "ambient": (15.0, 25.0),     # Controlled room temperature
        "refrigerated": (2.0, 8.0),   # Cold chain
        "frozen": (-25.0, -10.0),     # Frozen storage
    },
    "VACCINES": {
        "standard": (2.0, 8.0),       # Most vaccines
        "ultra_cold": (-80.0, -60.0), # mRNA vaccines
    },
    "BLOOD": {
        "whole_blood": (1.0, 6.0),
        "plasma": (-30.0, -18.0),
        "platelets": (20.0, 24.0),
    },
    "MEAT": {
        "chilled": (0.0, 4.0),
        "frozen": (-18.0, -12.0),
    },
    "FISH": {
        "chilled": (0.0, 2.0),
        "frozen": (-20.0, -15.0),
    },
    "DAIRY": {
        "chilled": (0.0, 4.0),
    },
    "FLOWERS": {
        "standard": (2.0, 8.0),
        "tropical": (10.0, 15.0),
    },
}

# GDP compliance logging interval (minutes)
GDP_COMPLIANCE_INTERVALS = {
    "PHARMA": 15,
    "VACCINES": 5,     # More frequent for vaccines
    "BLOOD": 5,
    "MEAT": 30,
    "FISH": 30,
    "DAIRY": 30,
    "FLOWERS": 30,
    "VEGETABLES": 60,
    "FRUITS": 60,
    "CHEMICALS": 15,
    "OTHER": 60,
}


@dataclass
class GDPComplianceReport:
    """Complete GDP/GSP compliance report for a cold chain shipment."""
    tracking_number: str
    product_type: str
    transport_duration_hours: float
    temp_min_required: float
    temp_max_required: float
    total_readings: int
    expected_readings: int            # Based on GDP interval
    logging_compliance_pct: float     # Actual / expected readings
    excursions: list[ExcursionSummary] = field(default_factory=list)
    excursion_count: int = 0
    total_excursion_minutes: int = 0
    mean_kinetic_temp: Optional[float] = None  # MKT calculation
    is_compliant: bool = True
    compliance_details: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    
    @property
    def is_gdp_compliant(self) -> bool:
        """GDP compliance requires logging_compliance_pct >= 90% and no critical excursions."""
        return self.logging_compliance_pct >= 90.0 and self.excursion_count == 0


@dataclass
class ExcursionSummary:
    started_at: str
    duration_minutes: int
    peak_temp: float
    severity: str
    resolved: bool


def calculate_mean_kinetic_temp(temperatures: list[float], times: list[datetime]) -> float:
    """
    Calculate Mean Kinetic Temperature (MKT) per USP <1079>.
    
    MKT = (ΔH/R) / ln( Σ(e^(-ΔH/(R·T_i))) / n )
    
    where:
      ΔH = 83.144 kJ/mol (default activation energy for pharmaceuticals)
      R = 0.0083144 kJ/(mol·K) (gas constant)
      T_i = temperature in Kelvin
      n = number of readings
    """
    import math
    
    if not temperatures:
        return 0.0
    
    delta_h = 83.144  # kJ/mol
    R = 0.0083144     # kJ/(mol·K)
    
    sum_exp = 0.0
    for temp_c in temperatures:
        temp_k = temp_c + 273.15
        if temp_k > 0:
            sum_exp += math.exp(-delta_h / (R * temp_k))
    
    if sum_exp <= 0 or len(temperatures) == 0:
        return sum(temperatures) / len(temperatures)
    
    mkt_kelvin = -delta_h / (R * math.log(sum_exp / len(temperatures)))
    return round(mkt_kelvin - 273.15, 1)


def generate_compliance_report(coldchain_shipment) -> GDPComplianceReport:
    """
    Generate a GDP/GSP compliance report for a completed cold chain shipment.
    
    Reference standards:
        - WHO Technical Report Series, No. 961, Annex 9 (GDP for pharmaceuticals)
        - EU GDP Guidelines 2013/C 343/01
        - PDA Technical Report No. 39 (Cold Chain Guidance)
    """
    shipment = coldchain_shipment.shipment
    readings = coldchain_shipment.readings.order_by('timestamp')
    
    total_readings = readings.count()
    
    # Calculate transport duration
    if shipment.actual_departure and shipment.actual_arrival:
        duration = shipment.actual_arrival - shipment.actual_departure
        duration_hours = duration.total_seconds() / 3600
    else:
        duration_hours = (shipment.scheduled_arrival - shipment.scheduled_departure).total_seconds() / 3600
    
    # Expected readings based on GDP interval
    product_type = coldchain_shipment.product_type
    interval_min = GDP_COMPLIANCE_INTERVALS.get(product_type, 60)
    expected_readings = max(1, int(duration_hours * 60 / interval_min))
    logging_compliance = min(100.0, round(total_readings / expected_readings * 100, 1)) if expected_readings > 0 else 100.0
    
    # Excursion summary
    excursions = coldchain_shipment.excursions.order_by('started_at')
    excursion_summaries = []
    total_excursion_min = 0
    
    for exc in excursions:
        exc_resolved = exc.resolved_at is not None
        exc_duration = exc.duration_minutes or 0
        excursion_summaries.append(ExcursionSummary(
            started_at=exc.started_at.isoformat() if exc.started_at else "",
            duration_minutes=exc_duration,
            peak_temp=exc.peak_temp_c or 0,
            severity=exc.severity,
            resolved=exc_resolved,
        ))
        total_excursion_min += exc_duration
    
    # MKT calculation
    temps = [r.temperature_c for r in readings]
    mkt = calculate_mean_kinetic_temp(temps, list(readings.values_list('timestamp', flat=True)))
    
    # Compliance details
    compliance_details: list[str] = []
    recommendations: list[str] = []
    
    # 1. Logging interval check
    if logging_compliance >= 95:
        compliance_details.append(f"Logging compliance: {logging_compliance}% — EXCEEDS GDP requirement (>=90%)")
    elif logging_compliance >= 90:
        compliance_details.append(f"Logging compliance: {logging_compliance}% — MEETS GDP minimum (>=90%)")
    else:
        compliance_details.append(f"Logging compliance: {logging_compliance}% — BELOW GDP requirement (>=90%)")
        recommendations.append("Increase logging frequency to meet GDP minimum interval")
    
    # 2. Excursion check
    if total_excursion_min == 0:
        compliance_details.append("No temperature excursions — continuous compliance")
    else:
        compliance_details.append(f"{len(excursion_summaries)} excursion(s) totaling {total_excursion_min} minutes")
        for exc_sum in excursion_summaries:
            if exc_sum.severity in ("CRITICAL", "SPOILAGE_ALERT"):
                recommendations.append(f"Critical excursion at {exc_sum.started_at}: investigate root cause and document corrective action")
    
    # 3. MKT check
    if mkt:
        if coldchain_shipment.temp_min_c <= mkt <= coldchain_shipment.temp_max_c:
            compliance_details.append(f"MKT: {mkt}°C — within range [{coldchain_shipment.temp_min_c}-{coldchain_shipment.temp_max_c}°C]")
        else:
            compliance_details.append(f"MKT: {mkt}°C — OUTSIDE range [{coldchain_shipment.temp_min_c}-{coldchain_shipment.temp_max_c}°C]")
            recommendations.append("Mean Kinetic Temperature outside acceptable range — assess product quality impact")
    
    # 4. Product-specific checks
    if product_type in ("PHARMA", "VACCINES", "BLOOD"):
        if not coldchain_shipment.monitoring_device_id:
            recommendations.append("GDP requires NIST-traceable sensor identification — add device ID")
        if not coldchain_shipment.requires_continuous_monitoring:
            recommendations.append("Pharmaceutical shipments require continuous monitoring per GDP")
    
    # Determine overall compliance
    is_compliant = (
        logging_compliance >= 90.0 and
        not any(exc.severity in ("CRITICAL", "SPOILAGE_ALERT") for exc in excursion_summaries) and
        all(exc.resolved for exc in excursion_summaries)
    )
    
    return GDPComplianceReport(
        tracking_number=shipment.tracking_number,
        product_type=coldchain_shipment.get_product_type_display(),
        transport_duration_hours=round(duration_hours, 1),
        temp_min_required=coldchain_shipment.temp_min_c,
        temp_max_required=coldchain_shipment.temp_max_c,
        total_readings=total_readings,
        expected_readings=expected_readings,
        logging_compliance_pct=logging_compliance,
        excursions=excursion_summaries,
        excursion_count=len(excursion_summaries),
        total_excursion_minutes=total_excursion_min,
        mean_kinetic_temp=mkt,
        is_compliant=is_compliant,
        compliance_details=compliance_details,
        recommendations=recommendations,
    )


def get_temperature_summary(coldchain_shipment) -> dict:
    """Get summary temperature statistics for a shipment."""
    readings = coldchain_shipment.readings
    total = readings.count()
    
    if total == 0:
        return {"error": "No readings available"}
    
    from django.db.models import Avg, Min, Max, Count
    stats = readings.aggregate(
        avg_temp=Avg('temperature_c'),
        min_temp=Min('temperature_c'),
        max_temp=Max('temperature_c'),
        avg_humidity=Avg('humidity_pct'),
    )
    
    # Excursion percentage
    in_range = sum(
        1 for r in readings.all()
        if coldchain_shipment.temp_min_c <= r.temperature_c <= coldchain_shipment.temp_max_c
    )
    
    return {
        "total_readings": total,
        "avg_temperature_c": round(stats['avg_temp'], 1) if stats['avg_temp'] else 0,
        "min_temperature_c": round(stats['min_temp'], 1) if stats['min_temp'] else 0,
        "max_temperature_c": round(stats['max_temp'], 1) if stats['max_temp'] else 0,
        "avg_humidity_pct": round(stats['avg_humidity'], 1) if stats.get('avg_humidity') else None,
        "in_range_pct": round(in_range / total * 100, 1) if total > 0 else 100,
        "temp_range_required": f"{coldchain_shipment.temp_min_c}°C – {coldchain_shipment.temp_max_c}°C",
    }
