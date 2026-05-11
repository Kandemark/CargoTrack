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

- **Authorization** (``domains._authz``):
  ``Permission`` enum (30+ granular permissions), ``RolePermissions`` mapping
  (10 roles × permissions), ``has_permission(user, perm)`` checker,
  DRF permission classes (``HasPermission``, ``HasObjectPermission``),
  and queryset scoping mixins (org / carrier / driver).

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

Domain modules are NOT eagerly imported at package level (avoids circular
imports with ``shipments.api_views``).  Import them directly::

    from domains.shipments import ETAEngine, Shipment
    from domains.contracts import match_rate
"""
# NOTE: Domain modules (analytics, coldchain, ...) are deliberately NOT
# imported here.  Import them directly — e.g. ``from domains.shipments import ...``.
# The eager import in prior versions created a circular dependency chain:
#   domains/__init__.py → domains.analytics → shipments.api_views
#       → cargotrack.authz → domains._authz → domains/__init__.py  💥

# ── DDD primitives (safe — no Django model imports) ──────────────────────────
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
from ._authz import (                      # Authorization layer
    Permission,
    has_permission,
    assert_permission,
    require_permission,
    audit_user_permissions,
    audit_all_role_permissions,
    HasPermission,
    HasObjectPermission,
    OrgScopedQueryset,
    CarrierScopedQueryset,
    DriverScopedQueryset,
    get_user_role,
    get_permissions_for_user,
)
from ._abac import (                       # ABAC engine
    EACountry,
    SubjectAttributes,
    ResourceAttributes,
    EnvironmentAttributes,
    ABACPolicy,
    PolicyDecision,
    ABACPolicyEngine,
    default_engine,
    extract_subject_attributes,
    extract_resource_attributes,
    extract_environment_attributes,
    register_resource_extractor,
)
from ._tenants import (                    # Tenant isolation & geo-restrictions
    TenantScopedModelViewSet,
    CountryRestrictedQueryset,
    CarrierLegVisibility,
    normalize_country_fields,
)

__all__ = [
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
    # Authorization (RBAC)
    "Permission",
    "has_permission",
    "assert_permission",
    "require_permission",
    "audit_user_permissions",
    "audit_all_role_permissions",
    "HasPermission",
    "HasObjectPermission",
    "OrgScopedQueryset",
    "CarrierScopedQueryset",
    "DriverScopedQueryset",
    "get_user_role",
    "get_permissions_for_user",
    # ABAC engine
    "EACountry",
    "SubjectAttributes",
    "ResourceAttributes",
    "EnvironmentAttributes",
    "ABACPolicy",
    "PolicyDecision",
    "ABACPolicyEngine",
    "default_engine",
    "extract_subject_attributes",
    "extract_resource_attributes",
    "extract_environment_attributes",
    "register_resource_extractor",
    # Tenant isolation & geo-restrictions
    "TenantScopedModelViewSet",
    "CountryRestrictedQueryset",
    "CarrierLegVisibility",
    "normalize_country_fields",
]
