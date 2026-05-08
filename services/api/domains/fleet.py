"""
Domain: Fleet
─────────────
Truck and driver fleet management — vehicle registry, driver profiles,
assignment to shipments, maintenance tracking, and driver performance.

Aggregate Roots
~~~~~~~~~~~~~~~
**Truck** (``fleet.models.Truck``)
    A vehicle in the fleet.  Can be assigned to shipments.

    Invariants:
    - A truck can only be assigned to one active shipment at a time.
    - ``registration_number`` is unique.
    - A truck MUST have a carrier owner.

**Driver** (``fleet.models.Driver``)
    A person who operates trucks.

    Invariants:
    - A driver can only be assigned to one active shipment at a time.
    - A driver MUST have a valid license (``license_expiry`` > today).
    - Rest-break compliance: max 4.5 hours continuous driving.

Owns
~~~~
- ``fleet``               Django app — Truck, Driver, maintenance models

Depends on
~~~~~~~~~~
- ``domains.shipments``   Shipment assignment (FK)
- ``domains.identity``    User model (driver user account)
- ``domains.partners``    Carrier (truck owner FK)
"""

# Fleet currently exposes its API through its own api_urls router.
# Domain services should be added here as they are extracted from views.

__all__: list[str] = []
