"""
Domain: Cold Chain
──────────────────
Temperature-controlled logistics compliance — GDP (Good Distribution Practice)
for pharmaceuticals per WHO/EU guidelines, GSP (Good Storage Practice) for
perishables, continuous temperature monitoring, excursion management, Mean
Kinetic Temperature (MKT) calculation per USP <1079>, and digital compliance
certificates at delivery.

Aggregate Roots
~~~~~~~~~~~~~~~
**ColdChainShipment** (``coldchain.models.ColdChainShipment``)
    Associates a shipment with temperature monitoring requirements.  Owns
    TemperatureReadings, TemperatureExcursions, ColdChainSLA, and
    ColdChainCertificate.

    Invariants:
    - Each Shipment has at most ONE ColdChainShipment (OneToOneField).
    - ``temp_min_c`` < ``temp_max_c``.
    - Excursions are auto-resolved when temperature returns to range for
      the tolerance window.
    - SLA is breached when total_excursion_minutes > max_excursion_minutes
      OR total_excursions > max_excursions.
    - A ColdChainCertificate can only be issued after delivery.

**TemperatureReading** (entity within ColdChainShipment aggregate)
    Individual sensor reading.  Loaded through the aggregate root only.

**TemperatureExcursion** (entity within ColdChainShipment aggregate)
    A period where temperature was out of range.  Created/updated via the
    aggregate root's temperature-check logic.

Owns
~~~~
- ``coldchain``           Django app — ColdChainShipment, TemperatureReading,
                          TemperatureExcursion, ColdChainSLA, ColdChainCertificate

Depends on
~~~~~~~~~~
- ``domains.shipments``   Shipment FK (coldchain shipment)
- ``domains.identity``    User FK (excursion acknowledgment)
"""

from domains._value_objects import Temperature

from coldchain.compliance import (
    GDPComplianceReport,
    GDP_TEMP_RANGES,
    ExcursionSummary,
    calculate_mean_kinetic_temp,
    generate_compliance_report,
    get_temperature_summary,
)

__all__ = [
    # Value Objects
    "Temperature",
    # Compliance
    "GDPComplianceReport",
    "GDP_TEMP_RANGES",
    "ExcursionSummary",
    "calculate_mean_kinetic_temp",
    "generate_compliance_report",
    "get_temperature_summary",
]
