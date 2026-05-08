"""Field extractor registry — dispatches to the correct extractor per document type."""
from __future__ import annotations
from typing import Any

from .bol import extract_bol, BOLExtraction
from .cmr import extract_cmr, CMRExtraction
from .customs import extract_customs, CustomsExtraction
from .invoice import extract_invoice, InvoiceExtraction
from .scale_ticket import extract_scale_ticket, ScaleTicketExtraction

__all__ = [
    "extract_fields",
    "BOLExtraction",
    "CMRExtraction",
    "CustomsExtraction",
    "InvoiceExtraction",
    "ScaleTicketExtraction",
]

# Map document type codes (from Document.DOC_TYPES) to extractors
EXTRACTORS = {
    "BOL": ("Bill of Lading", extract_bol),
    "CUSTOMS": ("Customs Declaration", extract_customs),
    "INVOICE": ("Commercial Invoice", extract_invoice),
    "CMR": ("CMR Consignment Note", extract_cmr),
    "SCALE_TICKET": ("Scale Ticket", extract_scale_ticket),
    # Packing list, insurance, phytosanitary use generic extraction
    "PACKING": ("Packing List", None),
    "INSURANCE": ("Insurance Certificate", None),
    "PHYTOSANITARY": ("Phytosanitary Certificate", None),
    "OTHER": ("Other Document", None),
}


def extract_fields(doc_type: str, text: str) -> dict[str, Any] | None:
    """
    Extract structured fields from OCR text using the appropriate extractor.

    Args:
        doc_type: One of Document.DOC_TYPES values.
        text: Raw OCR text.

    Returns:
        Dictionary of extracted fields, or None if no extractor is available.
    """
    entry = EXTRACTORS.get(doc_type)
    if entry is None:
        return None

    _, extractor_fn = entry
    if extractor_fn is None:
        return None

    result = extractor_fn(text)
    # Convert dataclass to dict
    if hasattr(result, "__dataclass_fields__"):
        return {
            k: v for k, v in result.__dict__.items()
        }
    return result
