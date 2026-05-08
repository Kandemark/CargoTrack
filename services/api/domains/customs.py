"""
Domain: Customs & Borders
──────────────────────────
East African customs system integration — submit declarations to TradeNet
(Kenya), ASYCUDA World (Uganda/Rwanda/Burundi), and TANCIS (Tanzania),
query assessment status, look up HS-code tariffs against the EAC Common
External Tariff, and map the 11 regional border crossings.

This domain is a **supporting domain** — it serves the Shipments domain by
providing customs declaration services.  It does not own an aggregate root;
the declaration's lifecycle is tied to the parent Shipment.

Owns
~~~~
- ``shipments.customs``          Canonical customs models and service
- ``services/edi-integration``   Apache Camel EDI gateway (external service)

Depends on
~~~~~~~~~~
- ``domains.shipments``   Shipment model (declaration FK target)
- ``domains.identity``    User model (declared-by FK)
"""

from shipments.customs import (
    AssessmentChannel,
    CustomsDeclaration,
    CustomsService,
    CustomsSystem,
    DeclarationLineItem,
    DeclarationStatus,
    DeclarationType,
    resolve_customs_system,
)

__all__ = [
    "AssessmentChannel",
    "CustomsDeclaration",
    "CustomsService",
    "CustomsSystem",
    "DeclarationLineItem",
    "DeclarationStatus",
    "DeclarationType",
    "resolve_customs_system",
]
