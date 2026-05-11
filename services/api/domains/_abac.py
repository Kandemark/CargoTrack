"""
domains/_abac.py — Attribute-Based Access Control engine.

ABAC evaluates access decisions by combining attributes of the subject (user),
resource (the thing being accessed), and environment (request context).
It layers on top of RBAC — RBAC runs first for the fast role check, then ABAC
makes fine-grained object-level and contextual decisions.

Architecture:
    Request → RBAC (HasPermission) → ABACPolicyEnforcer → ABACPolicyEngine
                                        ↓
                              SubjectAttributes
                              ResourceAttributes
                              EnvironmentAttributes
                                        ↓
                              evaluate policies → PolicyDecision
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Iterable, Optional, Protocol, Sequence

from django.http import HttpRequest

from ._authz import get_user_role

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# EAC Country Enum
# ═══════════════════════════════════════════════════════════════════════════════

class EACountry(str, Enum):
    """East African Community member states and key logistics neighbours."""

    KE = "KE"  # Kenya — Northern Corridor origin (Mombasa port)
    TZ = "TZ"  # Tanzania — Central Corridor origin (Dar es Salaam port)
    UG = "UG"  # Uganda — Northern Corridor destination
    RW = "RW"  # Rwanda — Northern / Central Corridor destination
    BI = "BI"  # Burundi — Central Corridor destination
    CD = "CD"  # DR Congo — Central Corridor destination
    SS = "SS"  # South Sudan — LAPSSET Corridor destination

    @property
    def label(self) -> str:
        _labels = {
            "KE": "Kenya", "TZ": "Tanzania", "UG": "Uganda",
            "RW": "Rwanda", "BI": "Burundi", "CD": "DR Congo",
            "SS": "South Sudan",
        }
        return _labels[self.value]

    @property
    def iso_alpha3(self) -> str:
        _a3 = {
            "KE": "KEN", "TZ": "TZA", "UG": "UGA",
            "RW": "RWA", "BI": "BDI", "CD": "COD", "SS": "SSD",
        }
        return _a3[self.value]

    @property
    def corridor(self) -> str:
        """Primary trade corridor this country belongs to."""
        _corridors = {
            "KE": "Northern", "UG": "Northern", "RW": "Northern",
            "TZ": "Central", "BI": "Central", "CD": "Central",
            "SS": "LAPSSET",
        }
        return _corridors[self.value]

    @property
    def customs_system(self) -> str:
        """Primary electronic customs system used by this country."""
        _systems = {
            "KE": "TRADENET", "TZ": "TANCIS",
            "UG": "ASYCUDA", "RW": "ASYCUDA", "BI": "ASYCUDA",
            "CD": "ASYCUDA", "SS": "ASYCUDA",
        }
        return _systems[self.value]

    @property
    def major_ports(self) -> tuple[str, ...]:
        """Major ports / border crossings in this country."""
        _ports = {
            "KE": ("Mombasa", "Nairobi ICD", "Malaba"),
            "TZ": ("Dar es Salaam", "Zanzibar", "Tanga"),
            "UG": ("Kampala", "Malaba", "Busia"),
            "RW": ("Kigali", "Gatuna", "Rusumo"),
            "BI": ("Bujumbura", "Kobero", "Gatumba"),
            "CD": ("Goma", "Bukavu", "Lubumbashi"),
            "SS": ("Juba", "Nimule", "Kapoeta"),
        }
        return _ports[self.value]

    @classmethod
    def from_string(cls, value: Optional[str]) -> Optional["EACountry"]:
        """Normalize free-text country input to an EACountry enum member.

        Handles common variations:
          - ISO codes: "KE", "TZ", "tz"
          - Full names: "Kenya", "Tanzania", "TANZANIA"
          - Common abbreviations: "DRC" → CD, "DR Congo" → CD
        """
        if not value:
            return None
        v = value.strip().upper()

        # Direct ISO match
        if v in cls._value2member_map_:
            return cls(v)

        # Fuzzy match against known labels
        _extra = {
            "KENYA": cls.KE, "TANZANIA": cls.TZ, "UGANDA": cls.UG,
            "RWANDA": cls.RW, "BURUNDI": cls.BI,
            "DRC": cls.CD, "DR CONGO": cls.CD, "DEMOCRATIC REPUBLIC OF THE CONGO": cls.CD,
            "SOUTH SUDAN": cls.SS, "SOUTH SUDAN": cls.SS,
        }
        if v in _extra:
            return _extra[v]

        return None

    @classmethod
    def all_countries(cls) -> list["EACountry"]:
        return list(cls)


# ═══════════════════════════════════════════════════════════════════════════════
# Attribute Types
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class SubjectAttributes:
    """Attributes about the actor making the request."""
    user_id: int
    role: str
    organization_id: Optional[int] = None
    country: Optional[EACountry] = None
    clearance_level: int = 0           # 0=basic, 1=confidential, 2=sensitive
    carrier_id: Optional[int] = None
    is_mfa_verified: bool = False
    permissions: frozenset[str] = field(default_factory=frozenset)


@dataclass(frozen=True)
class ResourceAttributes:
    """Attributes about the resource being accessed."""
    resource_type: str                 # "shipment", "rate_card", "customs_declaration", "document"
    resource_id: int
    owner_org_id: Optional[int] = None
    country: Optional[EACountry] = None
    status: Optional[str] = None
    carrier_id: Optional[int] = None
    document_type: Optional[str] = None
    customs_office: Optional[str] = None
    assigned_driver_user_id: Optional[int] = None
    tags: frozenset[str] = field(default_factory=frozenset)


@dataclass(frozen=True)
class EnvironmentAttributes:
    """Attributes about the request context."""
    client_ip: str = "0.0.0.0"
    is_working_hours: bool = True
    auth_method: str = "JWT"           # "JWT", "API_KEY", "OIDC"
    request_method: str = "GET"        # GET, POST, PATCH, DELETE


# ═══════════════════════════════════════════════════════════════════════════════
# Policy & Decision Types
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class PolicyDecision:
    """Result of evaluating a set of policies."""
    allowed: bool
    reason: str
    matched_policy: Optional[str] = None
    obligations: frozenset[str] = field(default_factory=frozenset)
    # Common obligations: "AUDIT_LOG", "NOTIFY_ADMIN", "REQUIRE_MFA"


@dataclass(frozen=True)
class ABACPolicy:
    """A single ABAC policy rule with a predicate condition.

    Policies are evaluated in priority order (lowest first).  The first
    matching DENY short-circuits evaluation.  If no ALLOW matches, the
    default is DENY.
    """
    name: str
    description: str
    priority: int
    condition: Callable[
        [SubjectAttributes, ResourceAttributes, EnvironmentAttributes], bool
    ]
    effect: str = "ALLOW"              # "ALLOW" or "DENY"
    obligations: frozenset[str] = field(default_factory=frozenset)

    def evaluate(
        self,
        subject: SubjectAttributes,
        resource: ResourceAttributes,
        environment: EnvironmentAttributes,
    ) -> Optional[PolicyDecision]:
        """Return a decision if this policy matches, or None."""
        try:
            matches = self.condition(subject, resource, environment)
        except Exception:
            logger.exception("ABAC policy %s raised during evaluation", self.name)
            return None

        if not matches:
            return None

        return PolicyDecision(
            allowed=(self.effect == "ALLOW"),
            reason=self.description,
            matched_policy=self.name,
            obligations=self.obligations,
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Policy Engine
# ═══════════════════════════════════════════════════════════════════════════════

class ABACPolicyEngine:
    """Evaluates a set of policies against subject, resource, and environment.

    Policies are evaluated in priority order (lowest first).
    The first matching DENY short-circuits to DENY.
    If no ALLOW policy matches, defaults to DENY.

    Usage::

        engine = ABACPolicyEngine([policy_1, policy_2, ...])
        decision = engine.evaluate(subject, resource, environment)
    """

    def __init__(self, policies: Optional[Iterable[ABACPolicy]] = None):
        self._policies: list[ABACPolicy] = sorted(
            policies or [], key=lambda p: p.priority
        )

    def register(self, policy: ABACPolicy) -> None:
        """Add a policy and re-sort by priority."""
        self._policies.append(policy)
        self._policies.sort(key=lambda p: p.priority)

    def unregister(self, name: str) -> bool:
        """Remove a policy by name.  Returns True if found and removed."""
        before = len(self._policies)
        self._policies = [p for p in self._policies if p.name != name]
        return len(self._policies) < before

    def evaluate(
        self,
        subject: SubjectAttributes,
        resource: ResourceAttributes,
        environment: EnvironmentAttributes,
    ) -> PolicyDecision:
        """Evaluate all policies and return a decision.

        - DENY policies short-circuit immediately.
        - ALLOW policies with the BYPASS obligation short-circuit immediately.
        - Otherwise, all policies are evaluated; if any ALLOW matches
          without a DENY, access is granted.
        - If no ALLOW matches, default is DENY.
        """
        obligations: set[str] = set()
        matched_allow: Optional[str] = None

        for policy in self._policies:
            decision = policy.evaluate(subject, resource, environment)
            if decision is None:
                continue

            obligations.update(decision.obligations)

            if not decision.allowed:
                logger.info(
                    "ABAC DENY: policy=%s user=%s resource=%s/%s reason=%s",
                    policy.name, subject.user_id,
                    resource.resource_type, resource.resource_id,
                    decision.reason,
                )
                return PolicyDecision(
                    allowed=False,
                    reason=decision.reason,
                    matched_policy=policy.name,
                    obligations=frozenset(obligations),
                )

            if "BYPASS" in decision.obligations:
                return PolicyDecision(
                    allowed=True,
                    reason=decision.reason,
                    matched_policy=policy.name,
                    obligations=frozenset(obligations),
                )

            matched_allow = policy.name

        if matched_allow is not None:
            return PolicyDecision(
                allowed=True,
                reason="Access granted",
                matched_policy=matched_allow,
                obligations=frozenset(obligations),
            )

        return PolicyDecision(
            allowed=False,
            reason="No matching ALLOW policy",
            matched_policy=None,
            obligations=frozenset(obligations),
        )

    @property
    def policies(self) -> Sequence[ABACPolicy]:
        return tuple(self._policies)


# ═══════════════════════════════════════════════════════════════════════════════
# Built-in Policies
# ═══════════════════════════════════════════════════════════════════════════════

# ---- Policy 0: Admin bypass ------------------------------------------------

def _admin_bypass(subject: SubjectAttributes, resource: ResourceAttributes,
                  environment: EnvironmentAttributes) -> bool:
    return subject.role in ("ADMIN", "LOGISTICS_MGR")

admin_bypass_policy = ABACPolicy(
    name="admin_bypass",
    description="Administrators and logistics managers bypass all ABAC checks",
    priority=0,
    condition=_admin_bypass,
    effect="ALLOW",
    obligations=frozenset({"BYPASS"}),
)


# ---- Policy 10: Self-access (user accessing their own data) ---------------

def _self_access(subject: SubjectAttributes, resource: ResourceAttributes,
                 environment: EnvironmentAttributes) -> bool:
    return subject.user_id == resource.resource_id and environment.request_method == "GET"

self_access_policy = ABACPolicy(
    name="self_access",
    description="Users can read their own resources",
    priority=10,
    condition=_self_access,
    effect="ALLOW",
)


# ---- Policy 20: Tenant isolation ------------------------------------------

def _tenant_isolation(subject: SubjectAttributes, resource: ResourceAttributes,
                      environment: EnvironmentAttributes) -> bool:
    """Block cross-organization access."""
    if subject.role in ("ADMIN", "LOGISTICS_MGR"):
        return False
    if resource.owner_org_id is None:
        return False  # No org on resource — don't match this policy
    if subject.organization_id is None:
        return True   # User has no org but resource does — deny
    if subject.organization_id != resource.owner_org_id:
        return True   # Cross-tenant access attempt
    return False

tenant_isolation_policy = ABACPolicy(
    name="tenant_isolation",
    description="Users can only access resources belonging to their organization",
    priority=20,
    condition=_tenant_isolation,
    effect="DENY",
    obligations=frozenset({"AUDIT_LOG"}),
)


# ---- Policy 30: Customs country lock --------------------------------------

def _customs_country_lock(subject: SubjectAttributes, resource: ResourceAttributes,
                          environment: EnvironmentAttributes) -> bool:
    """Customs brokers can only act on declarations in their own country."""
    if subject.role != "CUSTOMS_BROKER":
        return False
    if resource.resource_type != "customs_declaration":
        return False
    if subject.country is None or resource.country is None:
        return False
    return subject.country != resource.country

customs_country_policy = ABACPolicy(
    name="customs_country_lock",
    description="Customs brokers can only access declarations in their licensed country",
    priority=30,
    condition=_customs_country_lock,
    effect="DENY",
    obligations=frozenset({"AUDIT_LOG"}),
)


# ---- Policy 40: Carrier rate card visibility ------------------------------

def _carrier_rate_visibility(subject: SubjectAttributes, resource: ResourceAttributes,
                             environment: EnvironmentAttributes) -> bool:
    """Carriers can only see their own rate cards."""
    if subject.role != "CARRIER":
        return False
    if resource.resource_type != "rate_card":
        return False
    if subject.carrier_id is None:
        return False
    return subject.carrier_id != resource.carrier_id

carrier_visibility_policy = ABACPolicy(
    name="carrier_rate_visibility",
    description="Carriers can only access their own rate cards",
    priority=40,
    condition=_carrier_rate_visibility,
    effect="DENY",
    obligations=frozenset({"AUDIT_LOG"}),
)


# ---- Policy 50: Driver self-assignment ------------------------------------

def _driver_self_assignment(subject: SubjectAttributes, resource: ResourceAttributes,
                            environment: EnvironmentAttributes) -> bool:
    """Drivers can only access shipments assigned to them."""
    if subject.role != "DRIVER":
        return False
    if resource.resource_type != "shipment":
        return False
    if resource.assigned_driver_user_id is None:
        return False
    return subject.user_id != resource.assigned_driver_user_id

driver_assignment_policy = ABACPolicy(
    name="driver_self_assignment",
    description="Drivers can only access shipments assigned to them",
    priority=50,
    condition=_driver_self_assignment,
    effect="DENY",
    obligations=frozenset({"AUDIT_LOG"}),
)


# ---- Policy 60: Sensitive document protection -----------------------------

SENSITIVE_DOC_TYPES = frozenset({"TAX", "FINANCIAL", "CONTRACT", "CUSTOMS"})

def _sensitive_document(subject: SubjectAttributes, resource: ResourceAttributes,
                        environment: EnvironmentAttributes) -> bool:
    """Documents marked as sensitive require elevated clearance."""
    if resource.document_type is None:
        return False
    if resource.document_type.upper() not in SENSITIVE_DOC_TYPES:
        return False
    return subject.clearance_level < 1

sensitive_document_policy = ABACPolicy(
    name="sensitive_document_protection",
    description="Sensitive documents (TAX, FINANCIAL, CONTRACT, CUSTOMS) require clearance level >= 1",
    priority=60,
    condition=_sensitive_document,
    effect="DENY",
    obligations=frozenset({"AUDIT_LOG", "NOTIFY_ADMIN"}),
)


# ---- Policy 70: Working hours restriction ---------------------------------

def _working_hours_restriction(subject: SubjectAttributes, resource: ResourceAttributes,
                               environment: EnvironmentAttributes) -> bool:
    """Non-admin users cannot create/update outside working hours."""
    if subject.role in ("ADMIN", "LOGISTICS_MGR"):
        return False
    if environment.is_working_hours:
        return False
    return environment.request_method in ("POST", "PATCH", "PUT", "DELETE")

working_hours_policy = ABACPolicy(
    name="working_hours_restriction",
    description="Non-admin users cannot modify resources outside working hours",
    priority=70,
    condition=_working_hours_restriction,
    effect="DENY",
    obligations=frozenset({"AUDIT_LOG"}),
)


# ═══════════════════════════════════════════════════════════════════════════════
# Default Engine (pre-loaded with built-in policies)
# ═══════════════════════════════════════════════════════════════════════════════

default_engine = ABACPolicyEngine([
    admin_bypass_policy,
    self_access_policy,
    tenant_isolation_policy,
    customs_country_policy,
    carrier_visibility_policy,
    driver_assignment_policy,
    sensitive_document_policy,
    working_hours_policy,
])


# ═══════════════════════════════════════════════════════════════════════════════
# Attribute Extractors
# ═══════════════════════════════════════════════════════════════════════════════

def extract_subject_attributes(user: Any) -> SubjectAttributes:
    """Extract subject attributes from a Django user object.

    Handles AnonymousUser, regular users, and users with
    custom fields (carrier_id, etc.).
    """
    if user is None or not user.is_authenticated:
        return SubjectAttributes(
            user_id=0,
            role="ANONYMOUS",
        )

    role = get_user_role(user)
    country = None
    org_id = getattr(user, 'organization_id', None)

    # Resolve country from user → organization → country field
    if org_id:
        try:
            from accounts.models import Organization
            org = Organization.objects.only('country').get(pk=org_id)
            country = EACountry.from_string(org.country)
        except Exception:
            country = None

    # Resolve carrier_id from user's carrier profile
    carrier_id = getattr(user, 'carrier_id', None)
    if carrier_id is None and hasattr(user, 'carrier'):
        try:
            carrier_id = user.carrier.id
        except Exception:
            carrier_id = None

    # Permissions as frozenset of string names
    from ._authz import get_permissions_for_user
    perms = get_permissions_for_user(user)
    perm_names = frozenset(p.value for p in perms)

    return SubjectAttributes(
        user_id=user.pk,
        role=role,
        organization_id=org_id,
        country=country,
        clearance_level=_resolve_clearance(role),
        carrier_id=carrier_id,
        is_mfa_verified=getattr(user, 'totp_enabled', False),
        permissions=perm_names,
    )


def _resolve_clearance(role: str) -> int:
    """Map role to clearance level."""
    _levels = {
        "ADMIN": 2,
        "LOGISTICS_MGR": 2,
        "FINANCE_OFFICER": 1,
        "CUSTOMS_BROKER": 1,
        "DISPATCHER": 1,
        "PORT_AGENT": 1,
        "WAREHOUSE_MGR": 1,
        "CARRIER": 0,
        "DRIVER": 0,
        "CLIENT": 0,
    }
    return _levels.get(role, 0)


# Resource attribute extractor registry
_RESOURCE_EXTRACTORS: dict[str, Callable[[Any], ResourceAttributes]] = {}


def register_resource_extractor(
    resource_type: str, extractor: Callable[[Any], ResourceAttributes]
) -> None:
    """Register a function that extracts ResourceAttributes from a model instance."""
    _RESOURCE_EXTRACTORS[resource_type] = extractor


def extract_resource_attributes(obj: Any, resource_type: str) -> ResourceAttributes:
    """Extract resource attributes from a model instance.

    Uses registered extractors; falls back to probing common field names.
    """
    # Try registered extractor first
    if resource_type in _RESOURCE_EXTRACTORS:
        return _RESOURCE_EXTRACTORS[resource_type](obj)

    # Generic probing
    obj_id = getattr(obj, 'pk', 0)
    owner_org_id = None
    country = None
    status = None
    carrier_id = None
    document_type = None
    customs_office = None
    assigned_driver_user_id = None

    # Probe common FK paths for org
    for attr in ('organization_id', 'client__organization_id', 'owner_id'):
        if '__' in attr:
            parts = attr.split('__')
            val = obj
            for p in parts:
                val = getattr(val, p, None)
                if val is None:
                    break
            owner_org_id = val if isinstance(val, int) else getattr(val, 'id', None) if val else None
        elif hasattr(obj, attr):
            owner_org_id = getattr(obj, attr)
        if owner_org_id is not None:
            break

    # Probe country
    for attr in ('country', 'country_code', 'country_of_origin'):
        val = getattr(obj, attr, None)
        if val:
            country = EACountry.from_string(str(val))
            break

    # Probe status
    status = str(getattr(obj, 'status', ''))

    # Probe carrier
    carrier_id = getattr(obj, 'carrier_id', None)

    # Probe document_type
    document_type = str(getattr(obj, 'document_type', ''))

    # Probe assigned_driver
    if hasattr(obj, 'assigned_driver'):
        driver = obj.assigned_driver
        if driver and hasattr(driver, 'user_id'):
            assigned_driver_user_id = driver.user_id

    return ResourceAttributes(
        resource_type=resource_type,
        resource_id=obj_id,
        owner_org_id=owner_org_id,
        country=country,
        status=status,
        carrier_id=carrier_id,
        document_type=document_type,
        customs_office=customs_office,
        assigned_driver_user_id=assigned_driver_user_id,
    )


def extract_environment_attributes(request: HttpRequest) -> EnvironmentAttributes:
    """Extract environment attributes from a DRF request."""
    import datetime

    now = datetime.datetime.now()
    is_working = 6 <= now.hour < 20  # 6am–8pm local

    auth_method = "JWT"
    if hasattr(request, 'auth') and request.auth:
        auth_method = "API_KEY" if getattr(request.auth, 'payload', None) is None else "OIDC"

    return EnvironmentAttributes(
        client_ip=request.META.get('REMOTE_ADDR', '0.0.0.0'),
        is_working_hours=is_working,
        auth_method=auth_method,
        request_method=request.method,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# DRF Integration
# ═══════════════════════════════════════════════════════════════════════════════

class HasObjectPermission:
    """Mixin that uses the ABAC engine for object-level permission checks.

    Usage::

        class ShipmentDetailView(HasObjectPermission, generics.RetrieveAPIView):
            resource_type = "shipment"
            permission_classes = [IsAuthenticated, CanViewShipments]

    The view must set ``resource_type`` as a class attribute.
    """

    resource_type: str = ""

    def check_object_permission(self, request, obj) -> bool:
        """Evaluate ABAC policies for object-level access."""
        if not self.resource_type:
            return True  # No resource type configured — allow (defer to RBAC)

        try:
            subject = extract_subject_attributes(request.user)
            resource = extract_resource_attributes(obj, self.resource_type)
            environment = extract_environment_attributes(request)

            decision = default_engine.evaluate(subject, resource, environment)

            if not decision.allowed:
                logger.warning(
                    "ABAC object denial: user=%d resource=%s/%d policy=%s reason=%s",
                    request.user.pk, self.resource_type,
                    getattr(obj, 'pk', 0),
                    decision.matched_policy, decision.reason,
                )

                if "AUDIT_LOG" in decision.obligations:
                    _log_abac_denial(request, self.resource_type, obj, decision)

            return decision.allowed

        except Exception:
            logger.exception("ABAC evaluation failed for %s/%s",
                             self.resource_type, getattr(obj, 'pk', 0))
            return False


def _log_abac_denial(request, resource_type: str, obj, decision: PolicyDecision) -> None:
    """Write an AuditEntry for ABAC denials (best-effort)."""
    try:
        from accounts.models import AuditEntry
        AuditEntry.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action='ACCESS_DENIED',
            resource=f'{resource_type}/{getattr(obj, "pk", "?")}',
            description=f'ABAC: {decision.reason}',
            ip_address=request.META.get('REMOTE_ADDR', ''),
            result='FAILURE',
            metadata={
                'policy': decision.matched_policy,
                'reason': decision.reason,
                'obligations': list(decision.obligations),
            },
        )
    except Exception:
        logger.exception("Failed to write ABAC denial audit entry")


# ═══════════════════════════════════════════════════════════════════════════════
# Pre-register extractors for known resource types
# ═══════════════════════════════════════════════════════════════════════════════

def _register_builtin_extractors() -> None:
    """Register resource attribute extractors for CargoTrack models."""
    # These are deferred to avoid import-time circular dependencies.
    # Models are only imported when the extractor is called.
    pass  # Extractors use generic probing by default; register model-specific ones here if needed.


__all__ = [
    # Country
    "EACountry",
    # Attribute types
    "SubjectAttributes",
    "ResourceAttributes",
    "EnvironmentAttributes",
    # Policy types
    "ABACPolicy",
    "PolicyDecision",
    "ABACPolicyEngine",
    "default_engine",
    # Built-in policies
    "admin_bypass_policy",
    "self_access_policy",
    "tenant_isolation_policy",
    "customs_country_policy",
    "carrier_visibility_policy",
    "driver_assignment_policy",
    "sensitive_document_policy",
    "working_hours_policy",
    # Attribute extractors
    "extract_subject_attributes",
    "extract_resource_attributes",
    "extract_environment_attributes",
    "register_resource_extractor",
    # DRF integration
    "HasObjectPermission",
]
