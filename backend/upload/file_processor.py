import os
import re
import logging
from typing import Optional
import fitz 
from PIL import Image
import pytesseract

from config import Config

logger = logging.getLogger(__name__)

_SCANNED_PAGE_CHAR_THRESHOLD = 50

_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}

_tesseract_available: Optional[bool] = None


def _check_tesseract() -> bool:
    """Check once whether tesseract is reachable."""
    global _tesseract_available
    if _tesseract_available is not None:
        return _tesseract_available

    if Config.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = Config.TESSERACT_CMD

    try:
        ver = pytesseract.get_tesseract_version()
        logger.info("Tesseract %s found.", ver)
        _tesseract_available = True
    except Exception:
        logger.warning(
            "Tesseract is NOT installed or not on PATH. "
            "OCR will be skipped for scanned pages / images."
        )
        _tesseract_available = False
    return _tesseract_available

def _is_scanned_page(text: str) -> bool:
    """Heuristic: a page with very little extractable text is likely scanned."""
    return len(text.strip()) < _SCANNED_PAGE_CHAR_THRESHOLD


def _ocr_pil_image(image: Image.Image) -> str:
    """Run pytesseract on a PIL Image and return the text."""
    return pytesseract.image_to_string(image)


def _render_page_to_pil(page: fitz.Page, dpi: int) -> Image.Image:
    """Render a single PDF page to a PIL Image using PyMuPDF's pixmap."""
    pix = page.get_pixmap(dpi=dpi, alpha=False)
    return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)


def _clean_text(text: str) -> str:
    text = text.replace("\x0c", "\n")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[^\S\n]+", " ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    return text.strip()

def extract_text_from_pdf(file_path: str) -> dict:
    has_tesseract = _check_tesseract()
    dpi = Config.OCR_DPI

    try:
        doc = fitz.open(file_path)
    except Exception as exc:
        raise RuntimeError(f"Could not open PDF: {exc}") from exc

    if doc.is_encrypted:
        doc.close()
        raise RuntimeError("PDF is password-protected. Please upload an unlocked file.")

    page_texts: list[str] = []
    ocr_pages: list[int] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")

        if _is_scanned_page(text):
            if has_tesseract:
                logger.info("Page %d appears scanned – running OCR.", page_num + 1)
                img = _render_page_to_pil(page, dpi)
                text = _ocr_pil_image(img)
                ocr_pages.append(page_num + 1)
            else:
                logger.warning(
                    "Page %d appears scanned but Tesseract is unavailable. "
                    "Page will contain little or no text.",
                    page_num + 1,
                )

        page_texts.append(text)

    doc.close()

    full_text = _clean_text("\n\n".join(page_texts))

    return {
        "text": full_text,
        "page_count": len(page_texts),
        "ocr_pages": ocr_pages,
        "ocr_used": len(ocr_pages) > 0,
        "method": "pymupdf+ocr" if ocr_pages else "pymupdf",
    }


def extract_text_from_image(file_path: str) -> dict:
    """
    Extract text from a single image file via pytesseract.

    Returns the same dict shape as extract_text_from_pdf for consistency.
    """
    if not _check_tesseract():
        raise RuntimeError(
            "Tesseract is not installed. Cannot extract text from image files."
        )

    try:
        img = Image.open(file_path)
        img.verify()
        img = Image.open(file_path)
    except Exception as exc:
        raise RuntimeError(f"Could not open image: {exc}") from exc

    text = _clean_text(_ocr_pil_image(img))

    return {
        "text": text,
        "page_count": 1,
        "ocr_pages": [1],
        "ocr_used": True,
        "method": "ocr",
    }


def extract_text(file_path: str) -> dict:
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext in _IMAGE_EXTENSIONS:
        return extract_text_from_image(file_path)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")


def save_raw_text(text: str, filename: str, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    base = os.path.splitext(filename)[0] + ".txt"
    path = os.path.join(output_dir, base)

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)

    return path