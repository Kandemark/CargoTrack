"""
domains/ — CargoTrack Domain Layer (DDD)

Each domain encapsulates a cohesive area of the logistics business.  Domains
define their public API, declare which apps and modules they own, identify
their aggregate roots, and make cross-domain dependencies explicit.

Domains
───────
┌─────────────────────────────────────────────────────────────────────┐
│ shipments   contracts    finance     customs         fleet          │
│ partners    identity     coldchain   ports           documents      │
│ analytics   communications                                           │
└─────────────────────────────────────────────────────────────────────┘

DDD Building Blocks
───────────────────
- **Value Objects** (``domains._value_objects``):
  ``Money``, ``Weight``, ``Temperature``, ``GeoPoint``, ``PortCode``,
  ``TrackingNumber``, ``Corridor``, ``ContainerType``
  — immutable, self-validating, compared by value.

- **Domain Events** (``domains._events``):
  ``ShipmentCreated``, ``ShipmentDispatched``, ``ShipmentDelivered``,
  ``TemperatureExcursionDetected``, ``ContractActivated``,
  ``CustomsDeclarationSubmitted``, ``DemurrageAccrued``,
  ``InvoiceGenerated``, ``PaymentReceived``, etc.
  — past-tense, immutable, published via ``event_bus``.

- **Aggregate Roots** (documented in each domain module):
  The single entry point for modifying a cluster of related entities.
  All invariants are enforced through the aggregate root.

Conventions
───────────
- Import from a domain, not from its internal apps::

      from domains.contracts import match_rate   # ✓  Public API
      from contracts.services import match_rate  # ✗  Bypasses domain

- Use value objects in domain service signatures, not primitives::

      from domains._value_objects import Money, Weight, Corridor
      def match_rate(corridor: Corridor, weight: Weight) -> Money: ...

- Publish domain events from aggregate roots when invariants change.

- A domain's ``__all__`` lists every public name it exports.
- Django apps inside a domain are implementation details — only the domain
  module's exports form the supported API.

Registry
────────
"""

# ── Domain modules ──────────────────────────────────────────────────────────
from . import (
    analytics,
    coldchain,
    communications,
    contracts,
    customs,
    documents,
    finance,
    fleet,
    identity,
    partners,
    ports,
    shipments,
)

# ── DDD primitives ──────────────────────────────────────────────────────────
from ._value_objects import (
    ContainerType,
    Corridor,
    GeoPoint,
    Money,
    PortCode,
    Temperature,
    TrackingNumber,
    Weight,
)
from ._events import DomainEvent, DomainEventBus, event_bus

__all__ = [
    # Domains
    "analytics",
    "coldchain",
    "communications",
    "contracts",
    "customs",
    "documents",
    "finance",
    "fleet",
    "identity",
    "partners",
    "ports",
    "shipments",
    # Value Objects
    "ContainerType",
    "Corridor",
    "GeoPoint",
    "Money",
    "PortCode",
    "Temperature",
    "TrackingNumber",
    "Weight",
    # Event system
    "DomainEvent",
    "DomainEventBus",
    "event_bus",
]
