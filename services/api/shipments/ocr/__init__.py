"""
OCR Pipeline Orchestrator.

End-to-end flow:
  1. Receive image/PDF bytes + filename
  2. Run OCR engine (Tesseract with EAC vocabulary)
  3. Classify document type (BOL, customs, invoice, CMR, scale ticket, etc.)
  4. Extract structured fields using the type-specific extractor
  5. Return structured ExtractionResult

Usage:
    from shipments.ocr import OCRPipeline
    pipeline = OCRPipeline()
    result = pipeline.process(image_bytes, filename="bill_of_lading.jpg")
"""
from __future__ import annotations
import logging
from dataclasses import dataclass, field
from typing import Any

from .engine import get_ocr_engine, OCRResult
from .classifier import DocumentClassifier, ClassificationResult
from .extractors import extract_fields

logger = logging.getLogger(__name__)


@dataclass
class ExtractionResult:
    """Complete result from the OCR pipeline."""
    document_type: str                       # BOL, CUSTOMS, INVOICE, etc.
    type_confidence: float                   # classification confidence 0-1
    suggested_review: bool                   # True if confidence is borderline
    raw_text: str                            # full OCR text
    ocr_confidence: float                    # average word confidence 0-100
    extracted_fields: dict[str, Any] | None  # structured fields from extractor
    processing_time_ms: float
    word_count: int
    page_count: int
    preprocess_steps: list[str] = field(default_factory=list)
    matched_keywords: list[str] = field(default_factory=list)


class OCRPipeline:
    """
    End-to-end document extraction pipeline.

    Caches the OCR engine and classifier as singletons.
    Thread-safe — all state is passed through method parameters.
    """

    def __init__(self, tesseract_cmd: str = "tesseract", lang: str = "eng"):
        self._engine = get_ocr_engine(lang)
        self._classifier = DocumentClassifier()

    def process(self, image_data: bytes, filename: str = "") -> ExtractionResult:
        """
        Run the full OCR → classify → extract pipeline.

        Args:
            image_data: Raw bytes of the image or PDF.
            filename: Original filename (used for extension detection).

        Returns:
            ExtractionResult with document type, raw text, and structured fields.
        """
        # Step 1 — OCR
        ocr_result = self._engine.extract(image_data, filename)
        logger.info(
            "OCR complete: %d words, %.1f%% confidence, %.0f ms",
            ocr_result.word_count,
            ocr_result.confidence,
            ocr_result.processing_time_ms,
        )

        # Step 2 — Classify document type
        classification = self._classifier.classify(ocr_result.raw_text)
        logger.info(
            "Classified as %s (confidence=%.2f, review=%s)",
            classification.doc_type,
            classification.confidence,
            classification.suggested_review,
        )

        # Step 3 — Extract structured fields
        fields = extract_fields(classification.doc_type, ocr_result.raw_text)
        if fields:
            logger.info(
                "Extracted %d fields from %s",
                sum(1 for v in fields.values() if v),
                classification.doc_type,
            )
        else:
            logger.info("No structured extractor for %s", classification.doc_type)

        return ExtractionResult(
            document_type=classification.doc_type,
            type_confidence=classification.confidence,
            suggested_review=classification.suggested_review,
            raw_text=ocr_result.raw_text,
            ocr_confidence=ocr_result.confidence,
            extracted_fields=fields,
            processing_time_ms=ocr_result.processing_time_ms,
            word_count=ocr_result.word_count,
            page_count=ocr_result.page_count,
            preprocess_steps=ocr_result.preprocess_steps,
            matched_keywords=classification.matched_keywords,
        )
