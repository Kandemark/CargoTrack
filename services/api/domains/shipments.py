"""
Domain: Shipments
─────────────────
Core logistics domain — shipment lifecycle, route management, real-time
tracking, GPS ETA prediction, and customs declarations.

Aggregate Roots
~~~~~~~~~~~~~~~
**Shipment** (``shipments.models.Shipment``)
    The central aggregate of the entire platform.  Every shipment has a unique
    ``tracking_number`` and progresses through a lifecycle state machine.

    Invariants:
    - A tracking_number is unique across all shipments (enforced at creation).
    - A shipment MUST have an origin and destination.
    - Status transitions follow the lifecycle: CREATED → DISPATCHED → IN_TRANSIT
      → DELIVERED → CLOSED (or CANCELLED at any point before DELIVERED).
    - An assigned truck MUST belong to the assigned carrier.
    - Actual departure/arrival dates cannot be in the future.

**Route** (``shipments.models.Route``)
    A predefined corridor with waypoints.  Referenced by shipments but managed
    independently.

    Invariants:
    - A route MUST have at least an origin and destination.
    - Waypoints are ordered by sequence number.

Owns
~~~~
- ``shipments``          Django app — Shipment, Route, ComplianceDoc, Document models
- ``tracking``           Django app — TrackingEvent model
- ``shipments.eta_engine``        ETA calculation (Kalman filter)
- ``shipments.ocr``               Document extraction (Tesseract)
- ``shipments.customs``           Customs declarations (canonical model)
- ``shipments.api_views``         DRF views

Depends on
~~~~~~~~~~
- ``domains.identity``    User model, notifications
- ``domains.fleet``       Truck & driver assignment
- ``domains.partners``    Carrier assignment
- ``domains.coldchain``   (coldchain references shipment)
"""

# ── Value Objects ────────────────────────────────────────────────────────────
from domains._value_objects import (
    Corridor, GeoPoint, TrackingNumber, Weight,
)

# ── ETA engine (domain service) ─────────────────────────────────────────────
from shipments.eta_engine import (
    ETAEngine, KalmanFilter, KalmanState, haversine_km,
)

# ── Customs integration (domain service) ─────────────────────────────────────
from shipments.customs import (
    AssessmentChannel, CustomsDeclaration, CustomsService, CustomsSystem,
    DeclarationLineItem, DeclarationStatus, DeclarationType,
    resolve_customs_system,
)

# ── Views that belong to this domain ────────────────────────────────────────
from shipments.api_views import (
    BatchETAView,
    BorderCrossingInfoView,
    ComplianceDocDetailView,
    ComplianceDocListCreateView,
    CustomsDeclarationView,
    CustomsStatusView,
    DocumentExtractionDetailView,
    DocumentExtractionView,
    RealTimeETAView,
    RouteListAPIView,
    TariffLookupView,
)

# ── Core models ─────────────────────────────────────────────────────────────
from shipments.models import ComplianceDoc, Document, Route, Shipment
from tracking.models import TrackingEvent

__all__ = [
    # Value Objects
    "Corridor", "GeoPoint", "TrackingNumber", "Weight",
    # ETA
    "BatchETAView", "ETAEngine", "KalmanFilter", "KalmanState",
    "RealTimeETAView", "haversine_km",
    # Customs
    "AssessmentChannel", "BorderCrossingInfoView", "CustomsDeclaration",
    "CustomsDeclarationView", "CustomsService", "CustomsStatusView",
    "CustomsSystem", "DeclarationLineItem", "DeclarationStatus",
    "DeclarationType", "TariffLookupView", "resolve_customs_system",
    # Views
    "ComplianceDocDetailView", "ComplianceDocListCreateView",
    "DocumentExtractionDetailView", "DocumentExtractionView",
    "RouteListAPIView",
    # Models (aggregate roots)
    "Shipment", "Route", "ComplianceDoc", "Document", "TrackingEvent",
]
