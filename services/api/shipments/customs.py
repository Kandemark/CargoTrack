"""
shipments/customs.py — East African Customs System Integration

Publishes customs declarations from CargoTrack shipments to the EDI Gateway
(TradeNet Kenya, ASYCUDA World, TANCIS) via the internal event bus or REST API.

Design:
    Shipment model → CustomsDeclaration (canonical model) → EDI Gateway → Customs System

The EDI Gateway (Apache Camel) handles protocol transformation:
    - TradeNet: SOAP XML over HTTPS (Kenya)
    - ASYCUDA:  EDIFACT CUSCAR/CUSDEC over SFTP/AS2 (Uganda, Rwanda, Burundi)
    - TANCIS:   XML over REST with OAuth2 (Tanzania)
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


class DeclarationType(str, Enum):
    IMPORT = "IMPORT"
    EXPORT = "EXPORT"
    TRANSIT = "TRANSIT"
    WAREHOUSE = "WAREHOUSE"
    TEMPORARY = "TEMPORARY"


class CustomsSystem(str, Enum):
    TRADENET = "TRADENET"
    ASYCUDA = "ASYCUDA"
    TANCIS = "TANCIS"


class AssessmentChannel(str, Enum):
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"


class DeclarationStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ASSESSED = "ASSESSED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLEARED = "CLEARED"
    RELEASED = "RELEASED"
    CANCELLED = "CANCELLED"


@dataclass
class DeclarationLineItem:
    line_number: int
    hs_code: str
    goods_description: str
    quantity: Decimal = Decimal("1")
    unit_of_measure: str = "PKG"
    gross_weight_kg: Decimal = Decimal("0")
    net_weight_kg: Optional[Decimal] = None
    item_value: Decimal = Decimal("0")
    currency_code: str = "USD"
    permits: list[str] = field(default_factory=list)


@dataclass
class CustomsDeclaration:
    """Canonical customs declaration model — system-agnostic."""
    declaration_type: DeclarationType
    customs_system: CustomsSystem
    customs_office: str
    declarant_tin: str = ""
    declarant_name: str = ""
    importer_tin: str = ""
    importer_name: str = ""
    exporter_tin: str = ""
    exporter_name: str = ""
    country_of_origin: str = ""
    country_of_export: str = ""
    country_of_destination: str = ""
    transport_mode: str = "ROAD"
    vehicle_registration: str = ""
    border_crossing: str = ""
    shipment_tracking_no: str = ""
    line_items: list[DeclarationLineItem] = field(default_factory=list)
    total_customs_value: Decimal = Decimal("0")
    currency_code: str = "USD"
    regime_code: str = ""  # CPC code
    external_ref: str = ""

    def to_dict(self) -> dict:
        return {
            "declarationType": self.declaration_type.value,
            "customsSystem": self.customs_system.value,
            "customsOffice": self.customs_office,
            "declarantTin": self.declarant_tin,
            "declarantName": self.declarant_name,
            "importerTin": self.importer_tin,
            "importerName": self.importer_name,
            "exporterTin": self.exporter_tin,
            "exporterName": self.exporter_name,
            "countryOfOrigin": self.country_of_origin,
            "countryOfExport": self.country_of_export,
            "countryOfDestination": self.country_of_destination,
            "transportMode": self.transport_mode,
            "vehicleRegistration": self.vehicle_registration,
            "borderCrossing": self.border_crossing,
            "shipmentTrackingNo": self.shipment_tracking_no,
            "regimeCode": self.regime_code,
            "totalCustomsValue": str(self.total_customs_value),
            "currencyCode": self.currency_code,
            "lineItems": [
                {
                    "lineNumber": li.line_number,
                    "hsCode": li.hs_code,
                    "goodsDescription": li.goods_description,
                    "quantity": str(li.quantity),
                    "unitOfMeasure": li.unit_of_measure,
                    "grossWeightKg": str(li.gross_weight_kg),
                    "netWeightKg": str(li.net_weight_kg) if li.net_weight_kg is not None else None,
                    "itemValue": str(li.item_value),
                    "currencyCode": li.currency_code,
                }
                for li in self.line_items
            ],
        }


# ── EAC Corridor to customs system mapping ──────────────────────────────────

BORDER_CROSSING_SYSTEM: dict[str, tuple[CustomsSystem, str]] = {
    # Kenya → Uganda
    "Busia":       (CustomsSystem.TRADENET, "KEBUS"),
    "Malaba":      (CustomsSystem.TRADENET, "KEMAL"),
    # Kenya → Tanzania
    "Namanga":     (CustomsSystem.TRADENET, "KENAM"),
    "Taveta":      (CustomsSystem.TRADENET, "KETAV"),
    "Holili":      (CustomsSystem.TRADENET, "KEHOL"),
    # Tanzania → Uganda
    "Mutukula":    (CustomsSystem.TANCIS,   "TZMUT"),
    # Tanzania → Rwanda
    "Rusumo":      (CustomsSystem.TANCIS,   "TZRUS"),
    # Tanzania → Zambia
    "Tunduma":     (CustomsSystem.TANCIS,   "TZTUN"),
    # Uganda → Rwanda
    "Gatuna":      (CustomsSystem.ASYCUDA,  "UGGAT"),
    "Katuna":      (CustomsSystem.ASYCUDA,  "UGKAT"),
    # Rwanda → Burundi
    "Akanyaru":    (CustomsSystem.ASYCUDA,  "RWAKA"),
}

COUNTRY_CUSTOMS_SYSTEM: dict[str, CustomsSystem] = {
    "KE": CustomsSystem.TRADENET,
    "TZ": CustomsSystem.TANCIS,
    "UG": CustomsSystem.ASYCUDA,
    "RW": CustomsSystem.ASYCUDA,
    "BI": CustomsSystem.ASYCUDA,
    "SS": CustomsSystem.ASYCUDA,  # South Sudan — ASYCUDA (planned)
    "CD": CustomsSystem.ASYCUDA,  # DRC — ASYCUDA
}


def resolve_customs_system(border_crossing: str = "", country_code: str = "") -> tuple[CustomsSystem, str]:
    """Determine which customs system to use based on border or country."""
    if border_crossing and border_crossing in BORDER_CROSSING_SYSTEM:
        return BORDER_CROSSING_SYSTEM[border_crossing]
    if country_code and country_code.upper() in COUNTRY_CUSTOMS_SYSTEM:
        return (COUNTRY_CUSTOMS_SYSTEM[country_code.upper()], "")
    return (CustomsSystem.ASYCUDA, "")


# ── Customs Service ──────────────────────────────────────────────────────────

class CustomsService:
    """
    Service for submitting customs declarations to EAC customs systems
    via the CargoTrack EDI Gateway.
    """

    def __init__(self):
        self._gateway_url: Optional[str] = None

    @property
    def gateway_url(self) -> str:
        if self._gateway_url is None:
            self._gateway_url = getattr(settings, "EDI_GATEWAY_URL", "http://edi-gateway:8080")
        return self._gateway_url

    def submit_declaration(self, declaration: CustomsDeclaration) -> dict:
        """Submit a customs declaration to the appropriate system."""
        payload = json.dumps(declaration.to_dict())

        try:
            req = Request(
                f"{self.gateway_url}/api/declarations/submit",
                data=payload.encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                logger.info(
                    "Customs declaration %s submitted to %s — status: %s",
                    result.get("declarationId", "unknown"),
                    declaration.customs_system.value,
                    result.get("status", "unknown"),
                )
                return result
        except (URLError, OSError) as exc:
            logger.error("Failed to submit customs declaration: %s", exc)
            raise

    def query_status(self, declaration_id: str, system: CustomsSystem) -> dict:
        """Query the status of a previously submitted declaration."""
        try:
            req = Request(
                f"{self.gateway_url}/api/declarations/{declaration_id}/status"
                f"?system={system.value}",
                method="GET",
            )
            with urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (URLError, OSError) as exc:
            logger.error("Failed to query customs status: %s", exc)
            raise

    def lookup_tariff(self, hs_code: str, country_code: str) -> dict:
        """Look up EAC CET tariff rates for an HS code in a given country."""
        cache_key = f"customs:tariff:{country_code}:{hs_code}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            req = Request(
                f"{self.gateway_url}/api/tariff/{hs_code}?country={country_code}",
                method="GET",
            )
            with urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                cache.set(cache_key, result, timeout=86400)  # 24h TTL
                return result
        except (URLError, OSError) as exc:
            logger.error("Failed to look up tariff for HS %s: %s", hs_code, exc)
            raise

    def build_declaration_from_shipment(
        self,
        shipment,
        declaration_type: DeclarationType = DeclarationType.EXPORT,
        border_crossing: str = "",
    ) -> CustomsDeclaration:
        """Build a CustomsDeclaration from a Shipment model instance."""
        from shipments.models import ComplianceDoc

        system, office = resolve_customs_system(border_crossing=border_crossing)

        # Gather HS codes from compliance documents
        hs_codes: list[str] = []
        compliance_docs = ComplianceDoc.objects.filter(
            shipment=shipment,
            doc_type__in=["COMMERCIAL_INVOICE", "DECLARATION", "CERTIFICATE"],
        )
        for cd in compliance_docs:
            if cd.reference:  # Reference may contain HS code
                hs_codes.append(cd.reference)

        declaration = CustomsDeclaration(
            declaration_type=declaration_type,
            customs_system=system,
            customs_office=office or "DEFAULT",
            vehicle_registration=getattr(
                getattr(shipment, "assigned_truck", None), "registration_number", ""
            ),
            transport_mode="ROAD",
            country_of_origin="KE",
            country_of_destination="UG",
            shipment_tracking_no=shipment.tracking_number,
            border_crossing=border_crossing,
            total_customs_value=Decimal("0"),
            currency_code="USD",
            line_items=[
                DeclarationLineItem(
                    line_number=1,
                    hs_code=hs_codes[0] if hs_codes else "8704.22",
                    goods_description=f"Shipment {shipment.tracking_number}",
                    gross_weight_kg=Decimal(str(shipment.weight_kg)),
                )
            ],
        )

        # Set importer/exporter from client
        if shipment.client:
            declaration.exporter_name = shipment.client.get_full_name() or ""

        return declaration


# Singleton
customs_service = CustomsService()
