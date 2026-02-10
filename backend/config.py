import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

# Root of the entire project (one level above backend/)
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)


class Config:
    # ── Auth ──────────────────────────────────────────────
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key")

    # ── Database ──────────────────────────────────────────
    DB_PATH = os.path.join(_BACKEND_DIR, "database.db")

    # ── Directory layout ──────────────────────────────────
    # datasets/ lives at the project root, next to backend/
    DATASETS_DIR = os.path.join(_PROJECT_ROOT, "datasets")
    UPLOAD_DIR = os.path.join(DATASETS_DIR, "uploads")        # original files
    RAW_TEXT_DIR = os.path.join(DATASETS_DIR, "raw_text")      # extracted .txt
    CHAPTER_JSON_DIR = os.path.join(DATASETS_DIR, "chapter_json")
    QUESTION_JSON_DIR = os.path.join(DATASETS_DIR, "question_json")

    # ── OCR ───────────────────────────────────────────────
    # If tesseract is not on PATH, set the full path here:
    #   e.g. "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
    TESSERACT_CMD = os.getenv("TESSERACT_CMD", None)

    # DPI used when rendering scanned PDF pages for OCR.
    # 300 is a good balance between quality and speed.
    OCR_DPI = int(os.getenv("OCR_DPI", "300"))

    DEBUG = True