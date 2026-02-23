import os
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from data.dataset import generate_dataset
from config import Config

router = APIRouter()

COMBINED_DATASET_PATH = os.path.join(Config.DATASETS_DIR, "generated_datasets", "combined_dataset.json")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_combined() -> list:
    if not os.path.exists(COMBINED_DATASET_PATH):
        return []
    with open(COMBINED_DATASET_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_combined(data: list) -> None:
    os.makedirs(os.path.dirname(COMBINED_DATASET_PATH), exist_ok=True)
    with open(COMBINED_DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _already_processed(subject_name: str) -> bool:
    """Return True if this subject already has its own dataset file."""
    path = os.path.join(Config.DATASETS_DIR, "generated_datasets", f"{subject_name}_dataset.json")
    return os.path.exists(path)


def _questions_exist(subject_name: str) -> bool:
    path = os.path.join(Config.QUESTION_JSON_DIR, subject_name, f"{subject_name}_questions.json")
    return os.path.exists(path)


def _chapters_exist(subject_name: str) -> bool:
    path = os.path.join(Config.CHAPTER_JSON_DIR, subject_name, f"{subject_name}_chapters.json")
    return os.path.exists(path)


# ── Single endpoint ───────────────────────────────────────────────────────────

@router.post("/dataset/generate/{subject_name}")
def generate_subject_dataset(subject_name: str) -> JSONResponse:
    """
    Generate dataset for a subject and append it to the combined dataset.

    - Same subject called again → skipped (no duplicate work).
    - New subject → generated and appended to combined dataset.
    - Combined dataset grows as you add more subjects over time.
    """
    # 1. Validate source files exist
    if not _questions_exist(subject_name):
        raise HTTPException(
            status_code=404,
            detail=f"Questions JSON not found for '{subject_name}'. Upload and process a question paper first."
        )
    if not _chapters_exist(subject_name):
        raise HTTPException(
            status_code=404,
            detail=f"Chapters JSON not found for '{subject_name}'. Upload and process chapter notes first."
        )

    # 2. Skip if subject already processed
    if _already_processed(subject_name):
        return JSONResponse(content={
            "status":       "skipped",
            "reason":       f"'{subject_name}' dataset already exists.",
            "subject_name": subject_name,
        })

    # 3. Generate dataset for this subject
    try:
        new_records = generate_dataset(subject_name=subject_name)
    except RuntimeError as e:
        raise HTTPException(status_code=402, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    # 4. Append plain records (no subject tag) to combined dataset
    combined = _load_combined()
    combined.extend(new_records)
    _save_combined(combined)

    return JSONResponse(content={
        "status":        "generated",
        "subject_name":  subject_name,
        "new_records":   len(new_records),
        "total_records": len(combined),
        "dataset_path":  COMBINED_DATASET_PATH,
    })