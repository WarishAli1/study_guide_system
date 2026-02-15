import json
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from report.report_generator import generate_report, _find_json_file, _subject_dir
from config import Config

CHAPTER_JSON_DIR  = Config.CHAPTER_JSON_DIR
QUESTION_JSON_DIR = Config.QUESTION_JSON_DIR
SYLLABUS_JSON_DIR = Config.SYLLABUS_JSON_DIR
REPORTS_DIR       = Config.REPORTS_DIR

router = APIRouter()


class SubjectInfo(BaseModel):
    subject_name: str
    has_syllabus: bool
    has_chapters: bool
    has_questions: bool
    report_cached: bool


class PriorityItem(BaseModel):
    chapter_id: int | str
    chapter_name: str
    importance_score: float
    study_priority: str
    faq_count: int


class ReportSummary(BaseModel):
    subject_name: str
    total_chapters: int
    total_credit_hours: float | None
    total_marks: float | None
    total_past_questions: int
    generated_at: str
    study_priority_order: list[PriorityItem]


def _cached_report_path(subject_name: str) -> str:
    return os.path.join(REPORTS_DIR, subject_name, "report.json")


def _load_cached_report(subject_name: str) -> Optional[dict]:
    path = _cached_report_path(subject_name)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def _subject_exists(subject_name: str) -> bool:
    return bool(
        _find_json_file(_subject_dir(SYLLABUS_JSON_DIR, subject_name))
        and _find_json_file(_subject_dir(CHAPTER_JSON_DIR, subject_name))
    )


def _require_subject(subject_name: str):
    if not _subject_exists(subject_name):
        raise HTTPException(status_code=404, detail=f"Subject '{subject_name}' not found.")


@router.get("/subjects")
def list_subjects() -> list[SubjectInfo]:
    all_names: set[str] = set()
    for base_dir in [SYLLABUS_JSON_DIR, CHAPTER_JSON_DIR, QUESTION_JSON_DIR]:
        p = Path(base_dir)
        if p.exists():
            all_names.update(d.name for d in p.iterdir() if d.is_dir())
    return [
        SubjectInfo(
            subject_name=name,
            has_syllabus=bool(_find_json_file(_subject_dir(SYLLABUS_JSON_DIR, name))),
            has_chapters=bool(_find_json_file(_subject_dir(CHAPTER_JSON_DIR, name))),
            has_questions=bool(_find_json_file(_subject_dir(QUESTION_JSON_DIR, name))),
            report_cached=os.path.exists(_cached_report_path(name)),
        )
        for name in sorted(all_names)
    ]


@router.get("/report/{subject_name}")
def get_report(subject_name: str, use_cache: bool = Query(default=True)) -> JSONResponse:
    _require_subject(subject_name)
    if use_cache:
        cached = _load_cached_report(subject_name)
        if cached:
            return JSONResponse(content=cached)
    try:
        report = generate_report(subject_name, save=True)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return JSONResponse(content=report)


@router.get("/report/{subject_name}/summary", response_model=ReportSummary)
def get_report_summary(subject_name: str) -> ReportSummary:
    _require_subject(subject_name)
    report = _load_cached_report(subject_name)
    if not report:
        try:
            report = generate_report(subject_name, save=True)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return ReportSummary(
        subject_name=report["subject_name"],
        total_chapters=report["total_chapters"],
        total_credit_hours=report.get("total_credit_hours"),
        total_marks=report.get("total_marks"),
        total_past_questions=report.get("total_past_questions", 0),
        generated_at=report["generated_at"],
        study_priority_order=[PriorityItem(**item) for item in report["study_priority_order"]],
    )


@router.get("/report/{subject_name}/chapter/{chapter_id}")
def get_chapter_insight(subject_name: str, chapter_id: str) -> JSONResponse:
    _require_subject(subject_name)
    report = _load_cached_report(subject_name)
    if not report:
        try:
            report = generate_report(subject_name, save=True)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    match = next((c for c in report.get("chapters", []) if str(c["chapter_id"]) == str(chapter_id)), None)
    if not match:
        available = [str(c["chapter_id"]) for c in report.get("chapters", [])]
        raise HTTPException(status_code=404, detail=f"Chapter '{chapter_id}' not found. Available: {available}")
    return JSONResponse(content=match)


@router.post("/report/{subject_name}/regenerate")
def regenerate_report(subject_name: str) -> JSONResponse:
    _require_subject(subject_name)
    cached_path = _cached_report_path(subject_name)
    if os.path.exists(cached_path):
        os.remove(cached_path)
    try:
        report = generate_report(subject_name, save=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return JSONResponse(content={
        "status": "regenerated",
        "subject_name": subject_name,
        "total_chapters": report["total_chapters"],
        "generated_at": report["generated_at"],
        "report": report,
    })


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Study Insight Report API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix="/api/v1")

@app.get("/", include_in_schema=False)
def root():
    return {"docs": "/docs"}