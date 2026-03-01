import logging
from typing import Optional, List, Union

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from chat.chat_engine import chat

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="The user's question")
    subject: str = Field(..., min_length=1, description="Subject name (session name)")
    history: Optional[List[ChatMessage]] = Field(
        default=None,
        description="Previous conversation messages for context",
    )


class SourceInfo(BaseModel):
    index: int
    chapter_id: Union[int, str]
    chapter_name: str
    subtopic_id: str
    subtopic_name: str
    source_text: str = ""


class RelatedQuestion(BaseModel):
    question: str
    freq: int
    years: List[str]
    marks: List[int]


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceInfo]
    related_questions: List[RelatedQuestion]


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    """
    Send a message and get a RAG-powered response with inline citations.
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    if not req.subject.strip():
        raise HTTPException(status_code=400, detail="Subject is required.")

    history = None
    if req.history:
        history = [{"role": m.role, "content": m.content} for m in req.history]

    try:
        result = chat(
            query=req.message.strip(),
            subject_name=req.subject.strip(),
            conversation_history=history,
        )
    except Exception as e:
        logger.exception(f"Chat failed for subject '{req.subject}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )

    return ChatResponse(
        answer=result["answer"],
        sources=[SourceInfo(**s) for s in result["sources"]],
        related_questions=[RelatedQuestion(**q) for q in result["related_questions"]],
    )