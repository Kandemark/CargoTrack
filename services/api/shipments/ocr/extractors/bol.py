"""Bill of Lading field extractor — extracts structured data from BOL OCR text."""
import re
from dataclasses import dataclass, field


@dataclass
class BOLExtraction:
    bill_of_lading_number: str = ""
    vessel_name: str = ""
    voyage_number: str = ""
    port_of_loading: str = ""
    port_of_discharge: str = ""
    place_of_receipt: str = ""
    place_of_delivery: str = ""
    shipper_name: str = ""
    consignee_name: str = ""
    notify_party: str = ""
    container_numbers: list[str] = field(default_factory=list)
    seal_numbers: list[str] = field(default_factory=list)
    gross_weight_kg: float | None = None
    number_of_packages: int | None = None
    description_of_goods: str = ""
    freight_terms: str = ""  # PREPAID / COLLECT
    date_of_issue: str = ""
    shipping_line: str = ""


def extract_bol(text: str) -> BOLExtraction:
    """Extract structured fields from Bill of Lading OCR text."""
    result = BOLExtraction()

    # Bill of Lading number — patterns like "B/L No: ABC123", "BOL#XYZ-456"
    m = re.search(r"(?:B/?L\s*(?:No|Number|#)[:\s]*)([\w/-]+)", text, re.IGNORECASE)
    if m:
        result.bill_of_lading_number = m.group(1).strip()

    # Vessel name — "Vessel: MSC ANITA" or "MV MAERSK"
    m = re.search(r"(?:Vessel|MV|M/V)[:\s]+(\w[\w\s]{2,30})", text, re.IGNORECASE)
    if m:
        result.vessel_name = m.group(1).strip().rstrip(",.")

    # Voyage number — "Voyage: 123W" or "Voy No. 045E"
    m = re.search(r"(?:Voy(?:age)?\s*(?:No|Number)?[:\s]*)([\w\d]+)", text, re.IGNORECASE)
    if m:
        result.voyage_number = m.group(1).strip()

    # Port of loading
    m = re.search(r"(?:Port\s*of\s*Loading|POL)[:\s]+([\w\s,/-]{4,40})", text, re.IGNORECASE)
    if m:
        result.port_of_loading = m.group(1).strip().rstrip(",.")

    # Port of discharge
    m = re.search(r"(?:Port\s*of\s*Discharge|POD)[:\s]+([\w\s,/-]{4,40})", text, re.IGNORECASE)
    if m:
        result.port_of_discharge = m.group(1).strip().rstrip(",.")

    # Place of receipt
    m = re.search(r"Place\s*of\s*Receipt[:\s]+([\w\s,/-]{4,40})", text, re.IGNORECASE)
    if m:
        result.place_of_receipt = m.group(1).strip().rstrip(",.")

    # Place of delivery
    m = re.search(r"Place\s*of\s*Delivery[:\s]+([\w\s,/-]{4,40})", text, re.IGNORECASE)
    if m:
        result.place_of_delivery = m.group(1).strip().rstrip(",.")

    # Shipper
    m = re.search(r"Shipper[:\s]+(\w[\w\s,&.]{3,60})(?:\n|Consignee|Notify)", text, re.IGNORECASE)
    if m:
        result.shipper_name = m.group(1).strip().rstrip(",.")

    # Consignee
    m = re.search(r"Consignee[:\s]+(\w[\w\s,&.]{3,60})(?:\n|Notify|Port)", text, re.IGNORECASE)
    if m:
        result.consignee_name = m.group(1).strip().rstrip(",.")

    # Notify party
    m = re.search(r"Notify(?:\s*Party)?[:\s]+(\w[\w\s,&.]{3,60})(?:\n|Place|Port|Container)", text, re.IGNORECASE)
    if m:
        result.notify_party = m.group(1).strip().rstrip(",.")

    # Container numbers — 4 letters + 7 digits pattern (ISO 6346)
    container_matches = re.findall(r"\b([A-Z]{4}\s?\d{7})\b", text)
    result.container_numbers = [c.replace(" ", "") for c in container_matches]

    # Seal numbers
    seal_matches = re.findall(r"(?:Seal\s*(?:No|Number)?[:\s]*)([\w\d]+)", text, re.IGNORECASE)
    result.seal_numbers = seal_matches

    # Gross weight
    m = re.search(r"Gross\s*Weight[:\s]*([\d,.]+)\s*(?:KG|KGS|kg)", text, re.IGNORECASE)
    if m:
        try:
            result.gross_weight_kg = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Number of packages
    m = re.search(r"(?:No|Number)\s*of\s*Packages?[:\s]*(\d+)", text, re.IGNORECASE)
    if m:
        result.number_of_packages = int(m.group(1))

    # Description of goods
    m = re.search(r"Description\s*of\s*Goods[:\s]+(.+?)(?:\n\n|\n[A-Z]{2,}|Container|Gross)", text, re.IGNORECASE | re.DOTALL)
    if m:
        result.description_of_goods = m.group(1).strip()[:500]

    # Freight terms
    if re.search(r"freight\s*prepaid", text, re.IGNORECASE):
        result.freight_terms = "PREPAID"
    elif re.search(r"freight\s*collect", text, re.IGNORECASE):
        result.freight_terms = "COLLECT"

    # Date of issue
    m = re.search(r"(?:Date|Issued)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text, re.IGNORECASE)
    if m:
        result.date_of_issue = m.group(1)

    # Shipping line
    for line in ["MSC", "MAERSK", "CMA CGM", "PIL", "EVERGREEN", "HAPAG-LLOYD", "COSCO", "ONE"]:
        if line.lower() in text.lower():
            result.shipping_line = line
            break

    return result
