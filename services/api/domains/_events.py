"""
domains/_events.py — Domain Events for CargoTrack.

Domain events represent something that *happened* in the past (past tense,
immutable).  They decouple domains by allowing one domain to react to events
published by another without knowing the publisher's internals.

Architecture
────────────
- ``DomainEvent``         — abstract base (id, occurred_at, aggregate_id)
- Concrete event types    — one per significant state change
- ``DomainEventBus``      — simple in-process publish/subscribe dispatcher
- ``event_bus``           — module-level singleton

The bus accepts sync handlers today; async + Kafka bridging are planned.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Protocol

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# Base Event
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True, slots=True)
class DomainEvent:
    """Abstract base for all domain events.  Immutable, past-tense."""

    aggregate_id: str
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    occurred_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @property
    def event_type(self) -> str:
        """Dot-separated event name: 'shipments.created'."""
        raise NotImplementedError


# ═══════════════════════════════════════════════════════════════════════════════
# Shipment Events
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True, slots=True)
class ShipmentCreated(DomainEvent):
    tracking_number: str = ""
    origin: str = ""
    destination: str = ""

    @property
    def event_type(self) -> str:
        return "shipments.created"


@dataclass(frozen=True, slots=True)
class ShipmentDispatched(DomainEvent):
    tracking_number: str = ""
    truck_id: int | None = None
    driver_id: int | None = None

    @property
    def event_type(self) -> str:
        return "shipments.dispatched"


@dataclass(frozen=True, slots=True)
class ShipmentStatusChanged(DomainEvent):
    tracking_number: str = ""
    from_status: str = ""
    to_status: str = ""
    location: str = ""

    @property
    def event_type(self) -> str:
        return "shipments.status_changed"


@dataclass(frozen=True, slots=True)
class ShipmentDelivered(DomainEvent):
    tracking_number: str = ""
    delivered_at: str = ""

    @property
    def event_type(self) -> str:
        return "shipments.delivered"


@dataclass(frozen=True, slots=True)
class ShipmentDelayed(DomainEvent):
    tracking_number: str = ""
    delay_hours: float = 0.0
    reason: str = ""

    @property
    def event_type(self) -> str:
        return "shipments.delayed"


# ═══════════════════════════════════════════════════════════════════════════════
# Tracking Events
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True, slots=True)
class TrackingEventRecorded(DomainEvent):
    tracking_number: str = ""
    position_lat: float | None = None
    position_lon: float | None = None
    event_kind: str = ""       # GPS_PING, BORDER_CHECK_IN, etc.
    speed_kmh: float | None = None

    @property
    def event_type(self) -> str:
        return "tracking.event_recorded"


@dataclass(frozen=True, slots=True)
class BorderCrossed(DomainEvent):
    tracking_number: str = ""
    border_name: str = ""
    border_code: str = ""
    wait_minutes: int = 0

    @property
    def event_type(self) -> str:
        return "tracking.border_crossed"


# ═══════════════════════════════════════════════════════════════════════════════
# Cold Chain Events
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True, slots=True)
class TemperatureExcursionDetected(DomainEvent):
    tracking_number: str = ""
    product_type: str = ""
    severity: str = ""          # WARNING | BREACH | CRITICAL | SPOILAGE_ALERT
    peak_temp_c: float = 0.0
    temp_limit_breached: str = ""

    @property
    def event_type(self) -> str:
        return "coldchain.excursion_detected"


@dataclass(frozen=True, slots=True)
class TemperatureExcursionResolved(DomainEvent):
    tracking_number: str = ""
    duration_minutes: int = 0
    final_severity: str = ""

    @property
    def event_type(self) -> str:
        return "coldchain.excursion_resolved"


@dataclass(frozen=True, slots=True)
class ColdChainComplianceGenerated(DomainEvent):
    tracking_number: str = ""
    is_compliant: bool = True
    excursion_count: int = 0

    @property
    def event_type(self) -> str:
        return "coldchain.compliance_generated"


# ═══════════════════════════════════════════════════════════════════════════════
# Contract Events
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True, slots=True)
class ContractActivated(DomainEvent):
    contract_number: str = ""
    carrier_id: int | None = None

    @property
    def event_type(self) -> str:
        return "contracts.activated"


@dataclass(frozen=True, slots=True)
class ContractUtilizationUpdated(DomainEvent):
    contract_number: str = ""
    utilization_pct: float = 0.0
    shortfall: int = 0
    on_track: bool = True

    @property
    def event_type(self) -> str:
        return "contracts.utilization_updated"


# ═══════════════════════════════════════════════════════════════════════════════
# Customs Events
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True, slots=True)
class CustomsDeclarationSubmitted(DomainEvent):
    tracking_number: str = ""
    declaration_type: str = ""  # IMPORT | EXPORT | TRANSIT
    customs_system: str = ""    # TRADENET | ASYCUDA | TANCIS
    channel: str = ""           # GREEN | YELLOW | RED

    @property
    def event_type(self) -> str:
        return "customs.declaration_submitted"


@dataclass(frozen=True, slots=True)
class CustomsCleared(DomainEvent):
    tracking_number: str = ""
    customs_system: str = ""

    @property
    def event_type(self) -> str:
        return "customs.cleared"


# ═══════════════════════════════════════════════════════════════════════════════
# Port / Demurrage Events
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True, slots=True)
class DemurrageStarted(DomainEvent):
    container_number: str = ""
    port_code: str = ""
    free_days_expiry: str = ""

    @property
    def event_type(self) -> str:
        return "ports.demurrage_started"


@dataclass(frozen=True, slots=True)
class DemurrageAccrued(DomainEvent):
    container_number: str = ""
    port_code: str = ""
    chargeable_days: int = 0
    total_usd: str = ""

    @property
    def event_type(self) -> str:
        return "ports.demurrage_accrued"


# ═══════════════════════════════════════════════════════════════════════════════
# Finance Events
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True, slots=True)
class InvoiceGenerated(DomainEvent):
    tracking_number: str = ""
    invoice_number: str = ""
    total: str = ""
    currency: str = "USD"

    @property
    def event_type(self) -> str:
        return "finance.invoice_generated"


@dataclass(frozen=True, slots=True)
class PaymentReceived(DomainEvent):
    invoice_number: str = ""
    amount: str = ""
    currency: str = "USD"
    gateway: str = ""           # M_PESA | AIRTEL | MTN | BANK

    @property
    def event_type(self) -> str:
        return "finance.payment_received"


# ═══════════════════════════════════════════════════════════════════════════════
# Fleet Events
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True, slots=True)
class DriverAssigned(DomainEvent):
    driver_id: int = 0
    truck_id: int = 0
    tracking_number: str = ""

    @property
    def event_type(self) -> str:
        return "fleet.driver_assigned"


# ═══════════════════════════════════════════════════════════════════════════════
# Event Bus
# ═══════════════════════════════════════════════════════════════════════════════


class EventHandler(Protocol):
    """A callable that receives a DomainEvent."""

    def __call__(self, event: DomainEvent) -> None: ...


class DomainEventBus:
    """
    Simple in-process publish/subscribe dispatcher.

    Handlers are registered per event type string (e.g. ``"shipments.created"``).
    Multiple handlers can subscribe to the same event type.  All handlers run
    synchronously — a failing handler does not prevent other handlers from
    running.
    """

    def __init__(self):
        self._handlers: dict[str, list[EventHandler]] = {}

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Register a handler for a specific event type."""
        self._handlers.setdefault(event_type, []).append(handler)

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """Remove a previously registered handler."""
        handlers = self._handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)

    def publish(self, event: DomainEvent) -> None:
        """Publish an event to all registered handlers for its type."""
        event_type = event.event_type
        handlers = self._handlers.get(event_type, [])
        if not handlers:
            logger.debug("No handlers for event %s (id=%s)", event_type, event.event_id)
            return

        for handler in handlers:
            try:
                handler(event)
            except Exception:
                logger.exception(
                    "Handler %r failed for event %s (id=%s)",
                    handler, event_type, event.event_id,
                )

    def clear(self) -> None:
        """Remove all handlers (useful in tests)."""
        self._handlers.clear()


# Module-level singleton
event_bus = DomainEventBus()


# ═══════════════════════════════════════════════════════════════════════════════
# Registry
# ═══════════════════════════════════════════════════════════════════════════════

# All event types, grouped by domain
ALL_EVENT_TYPES: dict[str, list[type[DomainEvent]]] = {
    "shipments": [
        ShipmentCreated, ShipmentDispatched, ShipmentStatusChanged,
        ShipmentDelivered, ShipmentDelayed,
    ],
    "tracking": [
        TrackingEventRecorded, BorderCrossed,
    ],
    "coldchain": [
        TemperatureExcursionDetected, TemperatureExcursionResolved,
        ColdChainComplianceGenerated,
    ],
    "contracts": [
        ContractActivated, ContractUtilizationUpdated,
    ],
    "customs": [
        CustomsDeclarationSubmitted, CustomsCleared,
    ],
    "ports": [
        DemurrageStarted, DemurrageAccrued,
    ],
    "finance": [
        InvoiceGenerated, PaymentReceived,
    ],
    "fleet": [
        DriverAssigned,
    ],
}
