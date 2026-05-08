"""Customs Declaration field extractor — TradeNet / ASYCUDA / TANCIS formats."""
import re
from dataclasses import dataclass, field


@dataclass
class CustomsExtraction:
    declaration_number: str = ""
    system: str = ""  # TradeNet, ASYCUDA, TANCIS, ICMS
    customs_office: str = ""
    declarant_name: str = ""
    importer_name: str = ""
    exporter_name: str = ""
    country_of_origin: str = ""
    country_of_export: str = ""
    hs_codes: list[str] = field(default_factory=list)
    customs_value_usd: float | None = None
    duty_amount: float | None = None
    vat_amount: float | None = None
    total_taxes: float | None = None
    currency_code: str = ""
    procedure_code: str = ""  # CPC — e.g. 4000 (home use)
    assessment_channel: str = ""  # Green / Yellow / Red lane
    date_of_declaration: str = ""
    release_date: str = ""


def extract_customs(text: str) -> CustomsExtraction:
    """Extract structured fields from Customs Declaration OCR text."""
    result = CustomsExtraction()

    # Detect system
    if "tradenet" in text.lower() or "icms" in text.lower():
        result.system = "TradeNet/ICMS"
    elif "asycuda" in text.lower():
        result.system = "ASYCUDA World"
    elif "tancis" in text.lower():
        result.system = "TANCIS"
    elif "rra" in text.lower():
        result.system = "RRA e-Customs"

    # Declaration number
    m = re.search(r"(?:Declaration|SAD|Entry)\s*(?:No|Number)?[:\s#]*([\w/]{6,25})", text, re.IGNORECASE)
    if m:
        result.declaration_number = m.group(1).strip()

    # Customs office
    m = re.search(r"(?:Customs\s*Office|Office\s*of\s*Entry)[:\s]+([\w\s,/-]{4,40})", text, re.IGNORECASE)
    if m:
        result.customs_office = m.group(1).strip().rstrip(",.")

    # Declarant
    m = re.search(r"Declarant[:\s]+(\w[\w\s,&.]{3,60})(?:\n|Importer|Exporter)", text, re.IGNORECASE)
    if m:
        result.declarant_name = m.group(1).strip().rstrip(",.")

    # Importer
    m = re.search(r"Importer[:\s]+(\w[\w\s,&.]{3,60})(?:\n|Exporter|Declarant)", text, re.IGNORECASE)
    if m:
        result.importer_name = m.group(1).strip().rstrip(",.")

    # Exporter
    m = re.search(r"Exporter[:\s]+(\w[\w\s,&.]{3,60})(?:\n|Importer|Country)", text, re.IGNORECASE)
    if m:
        result.exporter_name = m.group(1).strip().rstrip(",.")

    # Country of origin
    m = re.search(r"Country\s*of\s*Origin[:\s]+([\w\s]{4,30})", text, re.IGNORECASE)
    if m:
        result.country_of_origin = m.group(1).strip().rstrip(",.")

    # Country of export
    m = re.search(r"Country\s*of\s*Export[:\s]+([\w\s]{4,30})", text, re.IGNORECASE)
    if m:
        result.country_of_export = m.group(1).strip().rstrip(",.")

    # HS codes — 6-10 digit numeric or dotted
    hs_matches = re.findall(r"\b(\d{4}\.\d{2}(?:\.\d{2,4})?)\b", text)
    result.hs_codes = list(set(hs_matches))

    # Customs value
    m = re.search(r"(?:Customs|CIF)\s*Value[:\s]*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if m:
        try:
            result.customs_value_usd = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Duty amount
    m = re.search(r"Duty[:\s]*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if m:
        try:
            result.duty_amount = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # VAT
    m = re.search(r"VAT[:\s]*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if m:
        try:
            result.vat_amount = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Total taxes
    m = re.search(r"Total\s*(?:Taxes?|Payable)[:\s]*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if m:
        try:
            result.total_taxes = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Currency
    m = re.search(r"(?:Currency|Ccy)[:\s]*(USD|EUR|KES|UGX|TZS|RWF|GBP)", text, re.IGNORECASE)
    if m:
        result.currency_code = m.group(1).upper()

    # CPC code
    m = re.search(r"(?:CPC|Customs\s*Procedure\s*Code)[:\s]*(\d{4})", text, re.IGNORECASE)
    if m:
        result.procedure_code = m.group(1)

    # Assessment channel / lane
    if re.search(r"green\s*lane", text, re.IGNORECASE):
        result.assessment_channel = "GREEN"
    elif re.search(r"yellow\s*lane", text, re.IGNORECASE):
        result.assessment_channel = "YELLOW"
    elif re.search(r"red\s*lane", text, re.IGNORECASE):
        result.assessment_channel = "RED"

    # Date of declaration
    m = re.search(r"Date\s*of\s*(?:Declaration|Entry)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text, re.IGNORECASE)
    if m:
        result.date_of_declaration = m.group(1)

    # Release date
    m = re.search(r"(?:Release|Clearance)\s*Date[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text, re.IGNORECASE)
    if m:
        result.release_date = m.group(1)

    return result
