"""
Domain: Documents
─────────────────
Shipping document lifecycle — OCR extraction from 9 document types (Bill of
Lading, Customs Declaration, Commercial Invoice, CMR, Scale Ticket, Packing
List, Insurance Certificate, Phytosanitary Certificate), digital proof of
delivery, and compliance document management.

Aggregate Roots
~~~~~~~~~~~~~~~
**Document** (``shipments.models.Document``)
    An uploaded document with OCR extraction results.

    Invariants:
    - A document belongs to exactly one shipment.
    - ``document_type`` must be one of the 8 (now 9) recognised types.
    - Extraction results are immutable once created (append-only).

**ProofOfDelivery** (``pod.models.POD``)
    Digital proof that a shipment was received by the consignee.

    Invariants:
    - A POD requires recipient signature, photo, or biometric confirmation.
    - ``delivered_at`` cannot be before ``shipment.departed_at``.

Owns
~~~~
- ``pod``                 Django app — Proof of Delivery (POD)
- ``shipments.ocr``       OCR extraction pipeline (Tesseract)
- ``shipments.models``    ComplianceDoc model

Depends on
~~~~~~~~~~
- ``domains.shipments``   Shipment FK on documents
- ``domains.identity``    User FK (recipient signature)
"""

# Documents currently expose their API through pod/urls and the OCR views
# registered in cargotrack/api_urls.py (imported via domains.shipments).

__all__: list[str] = []
