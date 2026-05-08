"""CMR Consignment Note field extractor — international road transport document."""
import re
from dataclasses import dataclass


@dataclass
class CMRExtraction:
    cmr_number: str = ""
    sender_name: str = ""
    carrier_name: str = ""
    consignee_name: str = ""
    place_of_taking_over: str = ""
    place_of_delivery: str = ""
    vehicle_registration: str = ""
    successive_carrier: str = ""
    goods_description: str = ""
    number_of_packages: int | None = None
    gross_weight_kg: float | None = None
    dangerous_goods: bool = False
    special_agreements: str = ""
    date_of_issue: str = ""


def extract_cmr(text: str) -> CMRExtraction:
    """Extract structured fields from CMR Consignment Note OCR text."""
    result = CMRExtraction()

    # CMR number
    m = re.search(r"(?:CMR|Consignment\s*Note)\s*(?:No|Number)?[:\s#]*([\w/-]{4,25})", text, re.IGNORECASE)
    if m:
        result.cmr_number = m.group(1).strip()

    # Sender
    m = re.search(r"Sender[:\s]+(\w[\w\s,&.]{3,60})(?:\n|Carrier|Consignee)", text, re.IGNORECASE)
    if m:
        result.sender_name = m.group(1).strip().rstrip(",.")

    # Carrier
    m = re.search(r"Carrier[:\s]+(\w[\w\s,&.]{3,60})(?:\n|Consignee|Place|Successive)", text, re.IGNORECASE)
    if m:
        result.carrier_name = m.group(1).strip().rstrip(",.")

    # Consignee
    m = re.search(r"Consignee[:\s]+(\w[\w\s,&.]{3,60})(?:\n|Place|Carrier|\d)", text, re.IGNORECASE)
    if m:
        result.consignee_name = m.group(1).strip().rstrip(",.")

    # Place of taking over
    m = re.search(r"(?:Place\s*of\s*)?Taking\s*Over[:\s]+([\w\s,/-]{4,40})", text, re.IGNORECASE)
    if m:
        result.place_of_taking_over = m.group(1).strip().rstrip(",.")

    # Place of delivery
    m = re.search(r"(?:Place\s*of\s*)?Delivery[:\s]+([\w\s,/-]{4,40})", text, re.IGNORECASE)
    if m:
        result.place_of_delivery = m.group(1).strip().rstrip(",.")

    # Vehicle registration
    m = re.search(r"(?:Vehicle|Truck|Registration)[:\s]*([A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,2})", text, re.IGNORECASE)
    if m:
        result.vehicle_registration = m.group(1).strip()

    # Successive carrier
    m = re.search(r"Successive\s*Carrier[:\s]+(\w[\w\s,&.]{3,60})", text, re.IGNORECASE)
    if m:
        result.successive_carrier = m.group(1).strip().rstrip(",.")

    # Goods description
    m = re.search(r"(?:Description|Nature)\s*of\s*(?:the\s*)?Goods[:\s]+(.+?)(?:\n\n|\n[A-Z]{2,}|\d+\s*(?:packages|pkg))", text, re.IGNORECASE | re.DOTALL)
    if m:
        result.goods_description = m.group(1).strip()[:300]

    # Number of packages
    m = re.search(r"(\d+)\s*(?:packages|pkgs?)", text, re.IGNORECASE)
    if m:
        result.number_of_packages = int(m.group(1))

    # Gross weight
    m = re.search(r"(?:Gross|Total)\s*Weight[:\s]*([\d,.]+)\s*(?:KG|KGS|kg)", text, re.IGNORECASE)
    if m:
        try:
            result.gross_weight_kg = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Dangerous goods
    result.dangerous_goods = bool(re.search(
        r"(?:dangerous|hazardous|ADR|IMDG|UN\s*\d{4})", text, re.IGNORECASE,
    ))

    # Special agreements (Box 13 in CMR)
    m = re.search(r"Special\s*(?:Agreements?)?[:\s]+(.+?)(?:\n\n|\n(?:Date|Signature))", text, re.IGNORECASE | re.DOTALL)
    if m:
        result.special_agreements = m.group(1).strip()[:200]

    # Date
    m = re.search(r"(?:Date|Issued)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text, re.IGNORECASE)
    if m:
        result.date_of_issue = m.group(1)

    return result
