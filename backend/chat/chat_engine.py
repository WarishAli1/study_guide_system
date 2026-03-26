import time
import logging
from typing import List, Dict, Optional

from openai import OpenAI
from config import Config
from chat.retriever import retrieve, load_syllabus_data
from chat.context_builder import build_context, build_system_prompt

logger = logging.getLogger(__name__)

_client = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=Config.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
    return _client


def chat(
    query: str,
    subject_name: str,
    conversation_history: Optional[List[Dict]] = None,
    top_k: int = 5,
) -> Dict:
    """
    Full RAG chat pipeline:
    1. Retrieve relevant chunks from chapter/question JSONs
    2. Build context with numbered sources
    3. Generate answer via Groq LLM with inline citation instructions
    """
    retrieval = retrieve(query, subject_name, top_k=top_k)
    chunks = retrieval["chunks"]
    related_questions = retrieval["related_questions"]
    if not chunks:
        return {
            "answer": "The provided context does not contain information about this topic. It may not be covered in your course notes.",
            "sources": [],
            "related_questions": [],
            "metadata": retrieval.get("metadata", {}),
        }
    syllabus_data = load_syllabus_data(subject_name)
    context, source_list = build_context(
        chunks=chunks,
        related_questions=related_questions,
        subject_name=subject_name,
        syllabus_data=syllabus_data,
    )

    system_prompt = build_system_prompt(subject_name)

    messages = [{"role": "system", "content": system_prompt}]

    if conversation_history:
        recent = conversation_history[-6:]
        for msg in recent:
            messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

    user_message = f"""CONTEXT FROM COURSE MATERIALS:
{context}

STUDENT'S QUESTION:
{query}

Remember: cite sources inline as [1], [2], etc. Use Markdown and LaTeX for math."""

    messages.append({"role": "user", "content": user_message})

    client = _get_client()
    model = Config.MODEL_NAME
    max_retries = 3
    base_delay = 3
    answer = ""

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.3,
                max_tokens=2000,
                top_p=0.9,
            )
            answer = response.choices[0].message.content.strip()
            break
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "rate limit" in err_str:
                wait = base_delay * (2 ** attempt)
                logger.warning(f"[Chat] Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            elif "402" in err_str or "quota" in err_str:
                logger.error("[Chat] API quota exceeded")
                answer = "I'm sorry, the AI service quota has been exceeded. Please try again later."
                break
            else:
                logger.error(f"[Chat] LLM call failed: {e}")
                if attempt >= max_retries - 1:
                    answer = "I'm sorry, I encountered an error generating a response. Please try again."
                time.sleep(2 ** attempt)

    return {
        "answer": answer,
        "sources": source_list,
        "related_questions": [
            {
                "question": q["question"],
                "freq": q.get("freq", 1),
                "years": q.get("years", []),
                "marks": [m for m in q.get("marks", []) if m is not None],
            }
            for q in related_questions
        ],
        "metadata": retrieval.get("metadata", {}),
    }