"""
Document classifier — determines the type of freight document from OCR text.

Uses keyword scoring to identify: BOL, Customs Declaration, Commercial Invoice,
CMR Consignment Note, Scale Ticket, Packing List, Insurance Certificate, Phytosanitary.
"""
import re
from dataclasses import dataclass
from typing import ClassVar


@dataclass
class ClassificationResult:
    doc_type: str           # One of Document.DOC_TYPES
    confidence: float       # 0.0 — 1.0
    matched_keywords: list[str]
    suggested_review: bool  # True if confidence is borderline


class DocumentClassifier:
    """
    Keyword-based document type classifier.

    Each document type has a set of weighted keywords that strongly indicate
    that document type. The classifier sums keyword weights and normalizes
    to produce a confidence score.
    """

    # Keywords with weights (higher = stronger signal)
    SIGNATURES: ClassVar[dict[str, list[tuple[str, int]]]] = {
        "BOL": [
            ("bill of lading", 10), ("shipped on board", 8), ("port of loading", 8),
            ("port of discharge", 8), ("consignee", 7), ("notify party", 7),
            ("vessel", 6), ("voyage number", 6), ("container number", 5),
            ("seal number", 5), ("gross weight", 4), ("freight prepaid", 4),
            ("ocean freight", 4), ("place of receipt", 4), ("shipper", 3),
            ("marks & numbers", 3), ("no of packages", 3), ("description of goods", 3),
            ("clean on board", 8), ("received in apparent good order", 6),
            ("msc", 3), ("maersk", 3), ("cma cgm", 3), ("pil", 3),
        ],
        "CUSTOMS": [
            ("customs declaration", 10), ("single administrative document", 10),
            ("sad", 8), ("hs code", 7), ("tariff code", 7), ("harmonized system", 6),
            ("country of origin", 6), ("country of export", 5), ("importer", 5),
            ("exporter", 5), ("customs value", 6), ("duty", 5), ("vat", 4),
            ("declarant", 5), ("clearance", 5), ("assessment notice", 6),
            ("tradenet", 8), ("asycuda", 8), ("tancis", 8), ("icms", 8),
            ("customs procedure code", 7), ("cpc", 7), ("declaration type", 5),
            ("goods item", 4), ("statistical value", 4), ("currency code", 3),
        ],
        "INVOICE": [
            ("commercial invoice", 10), ("invoice", 8), ("tax invoice", 8),
            ("proforma invoice", 6), ("bill to", 7), ("ship to", 7),
            ("due date", 5), ("payment terms", 6), ("subtotal", 5),
            ("total", 3), ("net weight", 4), ("unit price", 6),
            ("total amount", 6), ("bank details", 4), ("swift", 5),
            ("iban", 4), ("account number", 3), ("purchase order", 5),
            ("po number", 4), ("payment reference", 4),
        ],
        "CMR": [
            ("cmr", 10), ("consignment note", 10), ("international consignment", 8),
            ("carrier", 6), ("sender", 6), ("successive carrier", 5),
            ("place of taking over", 7), ("place of delivery", 7),
            ("cmr note", 9), ("transport document", 5), ("cmr convention", 6),
            ("taking over", 4), ("reservation", 3), ("received the goods", 5),
        ],
        "SCALE_TICKET": [
            ("weighbridge", 10), ("scale ticket", 10), ("weighing certificate", 9),
            ("gross weight", 7), ("tare weight", 8), ("net weight", 7),
            ("axle weight", 6), ("weighing date", 5), ("vehicle registration", 5),
            ("weighbridge number", 5), ("operator", 3),
            ("1st weighing", 4), ("2nd weighing", 4), ("weighed", 3),
        ],
        "PACKING": [
            ("packing list", 10), ("packing", 7), ("package", 4),
            ("carton", 4), ("pallet", 4), ("dimensions", 5),
            ("length", 3), ("width", 3), ("height", 3),
            ("cubic", 4), ("cbm", 5), ("volume", 4),
        ],
        "INSURANCE": [
            ("insurance certificate", 10), ("certificate of insurance", 10),
            ("underwriter", 7), ("insured value", 7), ("policy number", 7),
            ("insurance policy", 8), ("premium", 5), ("cover note", 6),
            ("marine insurance", 8), ("cargo insurance", 8), ("institute cargo clauses", 7),
        ],
        "PHYTOSANITARY": [
            ("phytosanitary certificate", 10), ("phytosanitary", 9),
            ("plant protection", 7), ("fumigation", 6), ("treatment", 4),
            ("pest free", 5), ("ippc", 6), ("nppo", 5),
            ("fumigation certificate", 7), ("methyl bromide", 5),
        ],
    }

    def classify(self, text: str) -> ClassificationResult:
        """
        Classify OCR text into a document type.

        Returns the best match with confidence score.
        If two types are close, flags for manual review.
        """
        text_lower = text.lower()
        scores: dict[str, float] = {}

        for doc_type, keywords in self.SIGNATURES.items():
            score = 0.0
            matched: list[str] = []
            for keyword, weight in keywords:
                if keyword in text_lower:
                    score += weight
                    matched.append(keyword)
            scores[doc_type] = score

        if not scores or max(scores.values()) == 0:
            return ClassificationResult(
                doc_type="OTHER",
                confidence=0.0,
                matched_keywords=[],
                suggested_review=True,
            )

        # Normalize to 0-1 confidence
        best_type = max(scores, key=scores.get)
        best_score = scores[best_type]
        max_possible = sum(w for _, w in self.SIGNATURES[best_type])
        confidence = min(1.0, best_score / max(0.25 * max_possible, 1))

        # Check if runner-up is close (within 20% of winner)
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        suggested_review = confidence < 0.4 or (
            len(sorted_scores) > 1
            and sorted_scores[1][1] > best_score * 0.8
        )

        return ClassificationResult(
            doc_type=best_type,
            confidence=round(confidence, 3),
            matched_keywords=[
                kw for kw, _ in self.SIGNATURES.get(best_type, [])
                if kw in text_lower
            ][:10],
            suggested_review=suggested_review,
        )
