import json
import os
import sqlite3
import uuid
import shutil
import logging
import sys
from typing import Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from config import Config
from upload.file_processor import extract_text, save_raw_text
from data.chapter_json import process_and_save_chapter
from data.question_json import process_raw_and_questions
from data.syllabus_json import process_raw_syllabus
logger = logging.getLogger(__name__)
router = APIRouter()

# ── Constants ────────────────────────────────────────────────────────────────

DB_PATH = Config.DB_PATH
UPLOAD_DIR = Config.UPLOAD_DIR
RAW_TEXT_DIR = Config.RAW_TEXT_DIR

VALID_DOC_TYPES = {"syllabus", "notes", "past_paper"}
VALID_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}


# ── Database helpers ─────────────────────────────────────────────────────────

def init_uploads_table() -> None:
    """Create the uploads table if it doesn't already exist."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS uploads (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            original_filename TEXT NOT NULL,
            stored_filename   TEXT NOT NULL,
            doc_type          TEXT NOT NULL,
            year              INTEGER,
            subject           TEXT,
            file_path         TEXT NOT NULL,
            text_path         TEXT,
            page_count        INTEGER,
            ocr_used          INTEGER DEFAULT 0,
            ocr_pages         TEXT DEFAULT '[]',
            extraction_method TEXT,
            status            TEXT DEFAULT 'processing',
            created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def _insert_upload(record: dict) -> int:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        """
        INSERT INTO uploads
            (original_filename, stored_filename, doc_type, year, subject,
             file_path, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record["original_filename"],
            record["stored_filename"],
            record["doc_type"],
            record.get("year"),
            record.get("subject"),
            record["file_path"],
            "processing",
        ),
    )
    conn.commit()
    upload_id = cur.lastrowid
    conn.close()
    return upload_id


def _update_upload(upload_id: int, fields: dict) -> None:
    set_parts = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [upload_id]
    conn = sqlite3.connect(DB_PATH)
    conn.execute(f"UPDATE uploads SET {set_parts} WHERE id = ?", values)
    conn.commit()
    conn.close()


def _row_to_dict(row: tuple) -> dict:
    """Map a full SELECT * row to a dict."""
    keys = [
        "id", "original_filename", "stored_filename", "doc_type",
        "year", "subject", "file_path", "text_path", "page_count",
        "ocr_used", "ocr_pages", "extraction_method", "status", "created_at",
    ]
    d = dict(zip(keys, row))
    # Deserialise ocr_pages from JSON string.
    try:
        d["ocr_pages"] = json.loads(d["ocr_pages"]) if d["ocr_pages"] else []
    except (json.JSONDecodeError, TypeError):
        d["ocr_pages"] = []
    d["ocr_used"] = bool(d["ocr_used"])
    return d


def _fetch_upload(upload_id: int) -> Optional[dict]:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute("SELECT * FROM uploads WHERE id = ?", (upload_id,))
    row = cur.fetchone()
    conn.close()
    return _row_to_dict(row) if row else None


def _fetch_uploads(doc_type: Optional[str] = None) -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    if doc_type:
        cur = conn.execute(
            "SELECT * FROM uploads WHERE doc_type = ? ORDER BY created_at DESC",
            (doc_type,),
        )
    else:
        cur = conn.execute("SELECT * FROM uploads ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    year: Optional[int] = Form(None),
    subject: str = Form(...),
):
    """
    Upload a PDF or image file for text extraction and processing.

    Form fields
    -----------
    file     : the document (PDF, PNG, JPG …)
    doc_type : one of  syllabus | notes | past_paper
    year     : (required for past_paper) e.g. 2023
    subject  : REQUIRED - subject name (e.g., "Artificial Intelligence", "CN")
    """
    # ── validate inputs ──────────────────────────────────────────────────
    if doc_type not in VALID_DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"doc_type must be one of: {', '.join(sorted(VALID_DOC_TYPES))}",
        )

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in VALID_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(VALID_EXTENSIONS))}",
        )
    
    if not subject:
        raise HTTPException(
            status_code=400,
            detail="'subject' is required.",
        )

    # ── persist the original file TEMPORARILY ────────────────────────────
    uid = uuid.uuid4().hex[:8]
    stored_filename = f"{uid}_{file.filename}"
    type_upload_dir = os.path.join(UPLOAD_DIR, doc_type)
    os.makedirs(type_upload_dir, exist_ok=True)
    file_path = os.path.join(type_upload_dir, stored_filename)

    try:
        with open(file_path, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    # ── create a tracking record (status = processing) ───────────────────
    upload_id = _insert_upload(
        {
            "original_filename": file.filename,
            "stored_filename": stored_filename,
            "doc_type": doc_type,
            "year": year,
            "subject": subject,
            "file_path": file_path,
        }
    )

    # ── extract text ─────────────────────────────────────────────────────
    try:
        result = extract_text(file_path)
    except RuntimeError as exc:
        _update_upload(upload_id, {"status": "failed"})
        # Delete temp file
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        _update_upload(upload_id, {"status": "failed"})
        logger.exception("Extraction failed for upload %s", upload_id)
        # Delete temp file
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {exc}")

    if not result["text"].strip():
        _update_upload(upload_id, {"status": "failed"})
        # Delete temp file
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=400,
            detail="No text could be extracted from the uploaded file.",
        )

    # ── save extracted text with NEW structure ───────────────────────────
    # New path: datasets/raw_text/{subject_name}/{type}/
    subject_slug = subject
    type_text_dir = os.path.join(RAW_TEXT_DIR, subject_slug, doc_type)
    text_path = save_raw_text(result["text"], stored_filename, type_text_dir)

    # ── process content based on doc_type ────────────────────────────────
    processing_result = {}
    
    try:
        if doc_type == "syllabus":
            processing_result = process_raw_syllabus(subject, text_path)
            logger.info(f"Syllabus processing result: {processing_result}")

        elif doc_type == "notes":
            processing_result = process_and_save_chapter(subject, text_path)
            logger.info(f"Chapter processing result: {processing_result}")

        elif doc_type == "past_paper":
            process_raw_and_questions(subject, text_path)
            processing_result = {
                "success": True,
                "message": "Past paper processed successfully."
            }              
    except Exception as e:
        logger.error(f"Content processing failed for upload {upload_id}: {e}")
        # Continue even if processing fails
        processing_result = {'success': False, 'error': str(e)}

    # ── finalise the tracking record ─────────────────────────────────────
    _update_upload(
        upload_id,
        {
            "text_path": text_path,
            "page_count": result["page_count"],
            "ocr_used": int(result["ocr_used"]),
            "ocr_pages": json.dumps(result["ocr_pages"]),
            "extraction_method": result["method"],
            "status": "completed",
        },
    )

    # ── DELETE temporary upload file ─────────────────────────────────────
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Deleted temporary upload file: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to delete temporary file {file_path}: {e}")

    # ── response ─────────────────────────────────────────────────────────
    preview = result["text"][:500]
    if len(result["text"]) > 500:
        preview += " …"

    response_data = {
        "status": "success",
        "upload_id": upload_id,
        "filename": file.filename,
        "doc_type": doc_type,
        "year": year,
        "subject": subject,
        "page_count": result["page_count"],
        "ocr_used": result["ocr_used"],
        "ocr_pages": result["ocr_pages"],
        "extraction_method": result["method"],
        "text_preview": preview,
        "text_path": text_path,
        "processing": processing_result
    }

    return response_data


@router.get("/uploads")
async def list_uploads(doc_type: Optional[str] = None):
    """
    List all uploads, optionally filtered by doc_type.

    Query params
    ------------
    doc_type : syllabus | notes | past_paper  (optional)
    """
    if doc_type and doc_type not in VALID_DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"doc_type must be one of: {', '.join(sorted(VALID_DOC_TYPES))}",
        )
    return _fetch_uploads(doc_type)


@router.get("/uploads/{upload_id}")
async def get_upload(upload_id: int):
    """Return metadata for a single upload."""
    record = _fetch_upload(upload_id)
    if not record:
        raise HTTPException(status_code=404, detail="Upload not found.")
    return record


@router.get("/uploads/{upload_id}/text")
async def get_extracted_text(upload_id: int):
    """Return the full extracted text for an upload."""
    record = _fetch_upload(upload_id)
    if not record:
        raise HTTPException(status_code=404, detail="Upload not found.")
    if record["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Text not available. Upload status: {record['status']}",
        )
    text_path = record["text_path"]
    if not text_path or not os.path.isfile(text_path):
        raise HTTPException(status_code=404, detail="Extracted text file is missing.")

    with open(text_path, "r", encoding="utf-8") as fh:
        text = fh.read()

    return {
        "upload_id": upload_id,
        "doc_type": record["doc_type"],
        "filename": record["original_filename"],
        "text": text,
    }


@router.delete("/uploads/{subject_name}/{doc_type}")
async def delete_uploads_by_subject_doc(subject_name: str, doc_type: str):
    """
    Delete all files for a subject and document type (notes | syllabus | past_paper)
    from RAW_TEXT_DIR and CLEANED_TEXT_DIR, without touching the DB.
    """
    if doc_type not in {"syllabus", "notes", "past_paper"}:
        raise HTTPException(status_code=400, detail="Invalid doc_type")

    deleted_paths = []

    # RAW_TEXT_DIR
    raw_path = os.path.join(Config.RAW_TEXT_DIR, subject_name, doc_type)
    if os.path.exists(raw_path):
        shutil.rmtree(raw_path)
        deleted_paths.append(raw_path)

    # CLEANED_TEXT_DIR
    clean_path = os.path.join(Config.CLEANED_TEXT_DIR, subject_name, doc_type)
    if os.path.exists(clean_path):
        shutil.rmtree(clean_path)
        deleted_paths.append(clean_path)

    # Only delete corresponding JSON folder based on doc_type
    if doc_type == "syllabus":
        json_path = os.path.join(Config.SYLLABUS_JSON_DIR, subject_name)
    elif doc_type == "notes":
        json_path = os.path.join(Config.CHAPTER_JSON_DIR, subject_name)
    elif doc_type == "past_paper":
        json_path = os.path.join(Config.QUESTION_JSON_DIR, subject_name)
    else:
        json_path = None

    if json_path and os.path.exists(json_path):
        shutil.rmtree(json_path)
        deleted_paths.append(json_path)

    if not deleted_paths:
        return {
            "status": "already_deleted",
            "message": "No folders found. Data was already deleted."
        }
    return {"status": "deleted", "paths": deleted_paths}