"""Scale Ticket / Weighbridge Certificate field extractor."""
import re
from dataclasses import dataclass, field


@dataclass
class ScaleTicketExtraction:
    ticket_number: str = ""
    weighbridge_name: str = ""
    weighbridge_location: str = ""
    vehicle_registration: str = ""
    first_weighing_kg: float | None = None   # Gross (loaded)
    second_weighing_kg: float | None = None  # Tare (empty)
    net_weight_kg: float | None = None
    axle_weights: list[float] = field(default_factory=list)
    commodity: str = ""
    driver_name: str = ""
    operator_name: str = ""
    date_of_first_weighing: str = ""
    date_of_second_weighing: str = ""


def extract_scale_ticket(text: str) -> ScaleTicketExtraction:
    """Extract structured fields from Scale Ticket OCR text."""
    result = ScaleTicketExtraction()

    # Ticket number
    m = re.search(r"(?:Ticket|Slip|Receipt)\s*(?:No|Number)?[:\s#]*([\w/-]{4,20})", text, re.IGNORECASE)
    if m:
        result.ticket_number = m.group(1).strip()

    # Weighbridge name
    m = re.search(r"(?:Weighbridge|Station)[:\s]*([\w\s,/-]{4,40})", text, re.IGNORECASE)
    if m:
        result.weighbridge_name = m.group(1).strip().rstrip(",.")

    # Location
    m = re.search(r"Location[:\s]*([\w\s,/-]{4,40})", text, re.IGNORECASE)
    if m:
        result.weighbridge_location = m.group(1).strip().rstrip(",.")

    # Vehicle registration
    m = re.search(r"(?:Vehicle|Truck|Reg)\s*(?:No|Number)?[:\s]*([A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,2})", text, re.IGNORECASE)
    if m:
        result.vehicle_registration = m.group(1).strip()

    # First weighing (loaded gross) — look for "Gross" or "1st weighing"
    m = re.search(r"(?:1st|First|Gross|Loaded|Entry)\s*(?:Weighing|Weight)?[:\s]*([\d,]+(?:\.\d+)?)\s*(?:KG|KGS|kg)?", text, re.IGNORECASE)
    if m:
        try:
            result.first_weighing_kg = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Second weighing (tare/empty) — look for "Tare" or "2nd weighing"
    m = re.search(r"(?:2nd|Second|Tare|Empty|Exit)\s*(?:Weighing|Weight)?[:\s]*([\d,]+(?:\.\d+)?)\s*(?:KG|KGS|kg)?", text, re.IGNORECASE)
    if m:
        try:
            result.second_weighing_kg = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Net weight
    m = re.search(r"Net\s*(?:Weight|Cargo)[:\s]*([\d,]+(?:\.\d+)?)\s*(?:KG|KGS|kg)?", text, re.IGNORECASE)
    if m:
        try:
            result.net_weight_kg = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # If net weight not found but both weighing values exist, calculate
    if result.net_weight_kg is None and result.first_weighing_kg and result.second_weighing_kg:
        result.net_weight_kg = round(abs(result.first_weighing_kg - result.second_weighing_kg), 1)

    # Axle weights
    axle_matches = re.findall(r"Axle\s*(\d)[:\s]*([\d,]+(?:\.\d+)?)\s*(?:KG|KGS|kg)?", text, re.IGNORECASE)
    for _, weight_str in axle_matches:
        try:
            result.axle_weights.append(float(weight_str.replace(",", "")))
        except ValueError:
            continue

    # Commodity
    m = re.search(r"Commodity[:\s]*([\w\s/-]{3,40})", text, re.IGNORECASE)
    if m:
        result.commodity = m.group(1).strip().rstrip(",.")

    # Driver name
    m = re.search(r"Driver[:\s]*([\w\s]{5,40})", text, re.IGNORECASE)
    if m:
        result.driver_name = m.group(1).strip()

    # Operator name
    m = re.search(r"(?:Operator|Weighman)[:\s]*([\w\s]{5,40})", text, re.IGNORECASE)
    if m:
        result.operator_name = m.group(1).strip()

    # Date of first weighing
    m = re.search(r"(?:1st|First|Entry)\s*(?:Weighing)?\s*Date[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text, re.IGNORECASE)
    if m:
        result.date_of_first_weighing = m.group(1)

    # Date of second weighing
    m = re.search(r"(?:2nd|Second|Exit)\s*(?:Weighing)?\s*Date[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text, re.IGNORECASE)
    if m:
        result.date_of_second_weighing = m.group(1)

    return result
