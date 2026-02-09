"""
Configuration file for the study assistant application
"""

import os
import json
from pathlib import Path
from dotenv import load_dotenv


# Paths
BASE_DIR = Path(__file__).resolve().parent      # backend/
PROJECT_ROOT = BASE_DIR.parent                  # project-root/

# Load both .env files (if they exist)
load_dotenv(dotenv_path=PROJECT_ROOT / ".env")
load_dotenv(dotenv_path=BASE_DIR / ".env")
print("Loading env from:", PROJECT_ROOT / ".env")
print("Loading env from:", BASE_DIR / ".env")


class Config:
    """Application configuration."""

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key")
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    DEBUG = True
    # ===== ONLY CHANGED THESE 5 LINES =====
    # Change from BACKEND_DIR to PROJECT_ROOT for datasets
    DATASETS_DIR = PROJECT_ROOT / "datasets"
    RAW_TEXT_DIR = DATASETS_DIR / "raw_text"
    CHAPTER_JSON_DIR = DATASETS_DIR / "chapter_json"
    QUESTION_JSON_DIR = DATASETS_DIR / "question_json"
    FINE_TUNE_DATASET = DATASETS_DIR / "fine_tune_dataset.json"
    # ======================================

    MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.pptx', '.doc', '.ppt'}
    MIN_TEXT_LENGTH = 50

    API_HOST = os.getenv("API_HOST", "0.0.0.0")
    API_PORT = int(os.getenv("API_PORT", 8000))

    FILE_TYPE_MAP = {
        "notes": "notes",
        "note": "notes",
        "syllabus": "syllabus",
        "question_paper": "questions",
        "question": "questions",
        "questions": "questions",
        "qp": "questions"
    }

    @classmethod
    def create_directories(cls):
        os.makedirs(cls.UPLOAD_FOLDER, exist_ok=True)

        cls.DATASETS_DIR.mkdir(exist_ok=True)
        cls.RAW_TEXT_DIR.mkdir(exist_ok=True)
        cls.CHAPTER_JSON_DIR.mkdir(exist_ok=True)
        cls.QUESTION_JSON_DIR.mkdir(exist_ok=True)
        
        # Add this line to create empty fine_tune_dataset.json
        if not cls.FINE_TUNE_DATASET.exists():
            with open(cls.FINE_TUNE_DATASET, 'w', encoding='utf-8') as f:
                json.dump([], f, indent=2)

    @classmethod
    def get_subject_dir(cls, subject: str, file_type: str) -> Path:
        normalized_type = cls.FILE_TYPE_MAP.get(file_type.lower(), "notes")
        return cls.RAW_TEXT_DIR / subject.upper() / normalized_type

    @classmethod
    def validate_config(cls):
        missing = []

        if not cls.GOOGLE_CLIENT_ID:
            missing.append("GOOGLE_CLIENT_ID")
        if not cls.JWT_SECRET_KEY:
            missing.append("JWT_SECRET_KEY")

        if missing:
            print(f"⚠️  Missing environment variables: {', '.join(missing)}")
            return False

        return True



Config.create_directories()
# Config.validate_config()  # Uncomment if you want strict checking
