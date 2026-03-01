import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from quiz.quiz_generator import generate_quiz

_quiz_cache: dict = {}

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/quiz/{subject_name}")
def get_quiz(subject_name: str, new: bool = False) -> JSONResponse:
    if subject_name in _quiz_cache and not new:
        logger.info(f"[Quiz] Returning cached quiz for '{subject_name}'")
        return JSONResponse(content=_quiz_cache[subject_name])

    try:
        logger.info(f"[Quiz] Generating quiz for subject: {subject_name}")
        quiz = generate_quiz(subject_name, num_questions=10)
        logger.info(f"[Quiz] Generated {len(quiz['questions'])} questions")
    except ValueError as e:
        logger.error(f"[Quiz] ValueError: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"[Quiz] Quiz generation failed for '{subject_name}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate quiz: {str(e)}",
        )

    _quiz_cache[subject_name] = quiz
    return JSONResponse(content=quiz)