import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from quiz.quiz_generator import generate_quiz

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/quiz/{subject_name}")
def get_quiz(subject_name: str) -> JSONResponse:
    """Generate a 10-question MCQ quiz for the given subject."""
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
    return JSONResponse(content=quiz)