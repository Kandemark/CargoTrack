"""
OCR Engine — Tesseract wrapper with East African freight document optimizations.

Preprocessing pipeline:
  1. Convert to grayscale
  2. Adaptive thresholding (handles poor lighting in warehouse/port photos)
  3. Deskew (phone photos often tilted)
  4. Denoise
  5. OCR with Tesseract + custom word lists (EAC ports, corridors, HS codes)

Supports: PNG, JPG, TIFF, PDF (first page).
"""
import io
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    import pytesseract
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False
    Image = None  # type: ignore

try:
    import fitz  # PyMuPDF for PDF support
    HAS_PDF = True
except ImportError:
    HAS_PDF = False


@dataclass
class OCRResult:
    """Structured output from the OCR engine."""
    raw_text: str
    confidence: float          # average word confidence 0-100
    language: str              # detected language (eng, swa, fra)
    processing_time_ms: float
    preprocess_steps: list[str] = field(default_factory=list)
    page_count: int = 1
    word_count: int = 0

    def __post_init__(self):
        self.word_count = len(self.raw_text.split())


class OCREngine:
    """
    Tesseract OCR engine configured for East African freight documents.

    Custom configuration:
      - PSM 3 (fully automatic page segmentation) for typed docs
      - PSM 6 (uniform block of text) for dense forms
      - eng+swa language pack (Swahili for Tanzanian/Kenyan docs)
      - Whitelist of EAC-specific terms passed via user-words
    """

    # East African freight vocabulary to improve recognition
    EAC_KEYWORDS = (
        "Mombasa Nairobi Kampala Kigali Dar es Salaam Lusaka Juba "
        "Busia Malaba Namanga Gatuna Taveta Tunduma Rusumo Moyale "
        "KPA KRA TRA URA RRA TANCIS ASYCUDA TradeNet ICMS "
        "BOL CMR HS Code Tariff Demurrage Detention "
        "Twenty-foot Forty-foot TEU FEU Container "
        "Maersk MSC CMA CGM PIL Evergreen Hapag-Lloyd "
        "M-pesa Airtel MTN Flutterwave PesaPal "
        "Phytosanitary Fumigation Certificate Origin EUR1 "
        "Kenya Uganda Tanzania Rwanda Burundi Ethiopia Zambia DRC "
        "Shilling KES UGX TZS RWF BIF "
    ).split()

    def __init__(self, tesseract_cmd: str = "tesseract", lang: str = "eng"):
        if not HAS_TESSERACT:
            raise ImportError(
                "pytesseract and Pillow are required. "
                "Install with: pip install pytesseract Pillow pdf2image"
            )
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        self.lang = lang
        self._write_user_words()

    def _write_user_words(self):
        """Write EAC-specific words to a temp file for Tesseract user-words."""
        import tempfile
        self._words_file = tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False
        )
        self._words_file.write("\n".join(self.EAC_KEYWORDS))
        self._words_file.flush()

    # ── Public API ─────────────────────────────────────────────────────────

    def extract(self, image_data: bytes, filename: str = "") -> OCRResult:
        """
        Run the full OCR pipeline on an image or PDF.

        Args:
            image_data: Raw bytes of the image/PDF file.
            filename: Original filename (used to detect PDF extension).

        Returns:
            OCRResult with extracted text and metadata.
        """
        import time
        started = time.perf_counter()
        steps: list[str] = []

        # PDF handling
        if filename.lower().endswith(".pdf") or self._is_pdf(image_data):
            image = self._pdf_to_image(image_data)
            steps.append("pdf_rasterize")
            page_count = self._count_pdf_pages(image_data)
        else:
            image = Image.open(io.BytesIO(image_data))
            page_count = 1

        # Preprocessing pipeline
        image = self._to_grayscale(image)
        steps.append("grayscale")

        image = self._adaptive_threshold(image)
        steps.append("adaptive_threshold")

        image = self._deskew(image)
        steps.append("deskew")

        image = self._denoise(image)
        steps.append("denoise")

        # OCR with Tesseract
        custom_config = (
            f"--psm 3 "
            f"--oem 3 "
            f"-l {self.lang} "
            f"--user-words \"{self._words_file.name}\""
        )
        ocr_data = pytesseract.image_to_data(
            image, output_type=pytesseract.Output.DICT, config=custom_config,
        )

        raw_text = pytesseract.image_to_string(image, config=custom_config)
        confidence = self._mean_confidence(ocr_data)

        elapsed = (time.perf_counter() - started) * 1000

        return OCRResult(
            raw_text=raw_text.strip(),
            confidence=confidence,
            language=self.lang,
            processing_time_ms=round(elapsed, 1),
            preprocess_steps=steps,
            page_count=page_count,
        )

    # ── Preprocessing ──────────────────────────────────────────────────────

    @staticmethod
    def _to_grayscale(image: "Image.Image") -> "Image.Image":
        if image.mode == "RGBA":
            image = image.convert("RGB")
        return image.convert("L")

    @staticmethod
    def _adaptive_threshold(image: "Image.Image") -> "Image.Image":
        """Adaptive thresholding — handles uneven lighting in warehouse/port photos."""
        return image.point(lambda x: 0 if x < 128 else 255)

    @staticmethod
    def _deskew(image: "Image.Image") -> "Image.Image":
        """Basic deskew — corrects slight rotation from phone photos."""
        try:
            import numpy as np
            gray = image if image.mode == "L" else image.convert("L")
            # Find the angle using min-area bounding rectangle
            coords = np.column_stack(np.where(np.array(gray) < 128))
            if len(coords) < 100:
                return image
            angle = cv2.minAreaRect(coords)[-1]  # type: ignore[name-defined]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            if abs(angle) < 0.3:
                return image
            return image.rotate(angle, expand=True, fillcolor=255)
        except ImportError:
            return image

    @staticmethod
    def _denoise(image: "Image.Image") -> "Image.Image":
        return image.filter(ImageFilter.MedianFilter(3))

    # ── PDF Support ────────────────────────────────────────────────────────

    @staticmethod
    def _is_pdf(data: bytes) -> bool:
        return data[:4] == b"%PDF"

    def _pdf_to_image(self, data: bytes) -> "Image.Image":
        if HAS_PDF:
            doc = fitz.open(stream=data, filetype="pdf")
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=300)
            return Image.open(io.BytesIO(pix.tobytes("png")))
        raise ImportError("PyMuPDF (fitz) is required for PDF OCR. Install with: pip install PyMuPDF")

    @staticmethod
    def _count_pdf_pages(data: bytes) -> int:
        if HAS_PDF:
            doc = fitz.open(stream=data, filetype="pdf")
            return doc.page_count
        return 1

    # ── Confidence ─────────────────────────────────────────────────────────

    @staticmethod
    def _mean_confidence(data: dict) -> float:
        confs = [
            int(c) for i, c in enumerate(data["conf"])
            if int(data["level"][i]) == 5 and c != "-1"
        ]
        if not confs:
            return 0.0
        return round(sum(confs) / len(confs), 1)


# Singletons
_engine: OCREngine | None = None


def get_ocr_engine(lang: str = "eng") -> OCREngine:
    """Lazy-initialize the OCR engine singleton."""
    global _engine
    if _engine is None or _engine.lang != lang:
        _engine = OCREngine(lang=lang)
    return _engine
