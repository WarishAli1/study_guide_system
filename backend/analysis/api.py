import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from analysis.topic_ranker import build_topic_graph, extractive_summary

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/analysis/topic-graph/{subject_name}")
def get_topic_graph(subject_name: str) -> JSONResponse:
    """Get topic importance graph using TF-IDF + PageRank."""
    try:
        result = build_topic_graph(subject_name)
    except Exception as e:
        logger.exception(f"Topic graph failed for '{subject_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return JSONResponse(content=result)

@router.get("/analysis/summary/{subject_name}")
def get_summary(subject_name: str, chapter_id: int = None, sentences: int = 5) -> JSONResponse:
    """Generate extractive summary using TextRank (no LLM)."""
    try:
        result = extractive_summary(subject_name, chapter_id, sentences)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return JSONResponse(content=result)