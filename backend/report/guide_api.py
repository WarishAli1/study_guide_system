import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from report.study_guide import generate_study_guide, get_cached_guide

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/generate/{subject_name}")
def api_generate_guide(
    subject_name: str,
    use_cache: bool = Query(default=True),
):
    """Generate (or return cached) study guide for a subject."""
    if use_cache:
        cached = get_cached_guide(subject_name)
        if cached:
            return JSONResponse(content=cached)

    try:
        report = generate_study_guide(subject_name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Study guide generation failed for '%s'", subject_name)
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse(content=report)


@router.post("/regenerate/{subject_name}")
def api_regenerate_guide(subject_name: str):
    """Force-regenerate (ignore cache)."""
    try:
        report = generate_study_guide(subject_name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Study guide regeneration failed for '%s'", subject_name)
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse(content=report)