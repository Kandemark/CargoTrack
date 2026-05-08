"""Commercial Invoice field extractor."""
import re
from dataclasses import dataclass, field


@dataclass
class InvoiceExtraction:
    invoice_number: str = ""
    invoice_date: str = ""
    due_date: str = ""
    seller_name: str = ""
    buyer_name: str = ""
    po_number: str = ""
    currency_code: str = "USD"
    line_items: list[dict] = field(default_factory=list)  # [{description, qty, unit_price, total}]
    subtotal: float | None = None
    tax_amount: float | None = None
    total_amount: float | None = None
    payment_terms: str = ""
    bank_name: str = ""
    account_number: str = ""
    swift_code: str = ""
    incoterms: str = ""


def extract_invoice(text: str) -> InvoiceExtraction:
    """Extract structured fields from Commercial Invoice OCR text."""
    result = InvoiceExtraction()

    # Invoice number
    m = re.search(r"(?:Invoice|Tax\s*Invoice)\s*(?:No|Number)?[:\s#]*([\w/-]{4,25})", text, re.IGNORECASE)
    if m:
        result.invoice_number = m.group(1).strip()

    # Invoice date
    m = re.search(r"(?:Invoice|Tax\s*Invoice)\s*Date[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text, re.IGNORECASE)
    if m:
        result.invoice_date = m.group(1)

    # Due date
    m = re.search(r"Due\s*Date[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text, re.IGNORECASE)
    if m:
        result.due_date = m.group(1)

    # Seller
    m = re.search(r"(?:From|Seller|Supplier)[:\s]+(\w[\w\s,&.]{3,60})(?:\n|To|Buyer|Bill)", text, re.IGNORECASE)
    if m:
        result.seller_name = m.group(1).strip().rstrip(",.")

    # Buyer
    m = re.search(r"(?:To|Buyer|Bill\s*To|Consignee)[:\s]+(\w[\w\s,&.]{3,60})(?:\n|Ship|Invoice|Date|PO|\d)", text, re.IGNORECASE)
    if m:
        result.buyer_name = m.group(1).strip().rstrip(",.")

    # PO number
    m = re.search(r"(?:PO|Purchase\s*Order)\s*(?:No|Number)?[:\s#]*([\w/-]{4,25})", text, re.IGNORECASE)
    if m:
        result.po_number = m.group(1).strip()

    # Currency
    m = re.search(r"(?:Currency|Ccy)[:\s]*(USD|EUR|KES|UGX|TZS|RWF|GBP)", text, re.IGNORECASE)
    if m:
        result.currency_code = m.group(1).upper()

    # Line items — basic extraction: look for "Description Qty Unit Price Total" pattern
    line_pattern = re.compile(
        r"([\w\s/-]{10,80})\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d{2})?)\s+([\d,]+(?:\.\d{2})?)",
        re.MULTILINE,
    )
    for m in line_pattern.finditer(text):
        try:
            result.line_items.append({
                "description": m.group(1).strip(),
                "quantity": float(m.group(2).replace(",", "")),
                "unit_price": float(m.group(3).replace(",", "")),
                "total": float(m.group(4).replace(",", "")),
            })
        except ValueError:
            continue

    # Subtotal
    m = re.search(r"Sub\s*Total[:\s]*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if m:
        try:
            result.subtotal = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Tax
    m = re.search(r"(?:Tax|VAT)[:\s]*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if m:
        try:
            result.tax_amount = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Total
    m = re.search(r"(?:Total|Grand\s*Total|Amount\s*Due)[:\s]*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if m:
        try:
            result.total_amount = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Payment terms
    m = re.search(r"(?:Payment\s*Terms|Terms)[:\s]*([\w\s]{5,30})", text, re.IGNORECASE)
    if m:
        result.payment_terms = m.group(1).strip()

    # Bank details
    m = re.search(r"Bank[:\s]*([\w\s]{5,40})", text, re.IGNORECASE)
    if m:
        result.bank_name = m.group(1).strip()

    # Account number
    m = re.search(r"(?:Account|A/C)\s*(?:No|Number)?[:\s#]*(\d{6,20})", text, re.IGNORECASE)
    if m:
        result.account_number = m.group(1).strip()

    # SWIFT
    m = re.search(r"SWIFT[:\s]*([A-Z0-9]{8,11})", text, re.IGNORECASE)
    if m:
        result.swift_code = m.group(1).strip()

    # Incoterms
    for term in ["FOB", "CIF", "EXW", "DDP", "DAP", "CFR", "CIP", "FCA"]:
        if re.search(rf"\b{term}\b", text):
            result.incoterms = term
            break

    return result
