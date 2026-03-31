import time
import logging
import random
import re
import json
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


INLINE_QUIZ_SYSTEM_PROMPT = """You are a quiz question generator for an exam preparation system.
Generate exactly ONE multiple-choice question based on the provided context.

RULES:
1. The question must be directly answerable from the context provided.
2. Create 4 options labeled A, B, C, D. Only one must be correct.
3. The correct answer must come from the context, not general knowledge.
4. Write a brief explanation (1-2 sentences) citing the context.
5. Keep the question focused and exam-appropriate.
6. Do NOT repeat the user's question verbatim — test understanding of the answer.

Respond ONLY with valid JSON in this exact format:
{
  "question": "...",
  "A": "...",
  "B": "...",
  "C": "...",
  "D": "...",
  "correct": "A",
  "explanation": "..."
}"""


def _generate_inline_question(
    user_query: str,
    answer: str,
    chunks: List[Dict],
    subject_name: str,
) -> Optional[Dict]:
    """Generate a single MCQ inline question from the chat context."""
    if not chunks:
        return None

    try:
        # Build a short context from the top 3 retrieved chunks
        context_parts = []
        for chunk in chunks[:3]:
            sub_name = chunk.get("subtopic_name", "")
            content = chunk.get("content", "")[:600]
            context_parts.append(f"[{sub_name}]\n{content}")
        context_text = "\n\n".join(context_parts)

        user_prompt = (
            f"Subject: {subject_name}\n\n"
            f"The student asked: {user_query}\n\n"
            f"The answer provided was:\n{answer[:800]}\n\n"
            f"Context from course materials:\n{context_text}\n\n"
            f"Generate one MCQ that tests understanding of this answer."
        )

        client = _get_client()
        response = client.chat.completions.create(
            model=Config.MODEL_NAME,
            messages=[
                {"role": "system", "content": INLINE_QUIZ_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=500,
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        raw = raw.strip()

        q = json.loads(raw)

        # Validate required fields
        required = ["question", "A", "B", "C", "D", "correct", "explanation"]
        if not all(k in q for k in required):
            logger.warning("[Chat] Inline question missing required fields")
            return None

        correct = q["correct"].upper()
        if correct not in ("A", "B", "C", "D"):
            correct = "A"

        # Shuffle correct answer position
        labels = ["A", "B", "C", "D"]
        correct_text = q[correct]
        wrong_texts = [q[l] for l in labels if l != correct]
        random.shuffle(wrong_texts)
        new_correct_pos = random.randint(0, 3)
        new_options = wrong_texts.copy()
        new_options.insert(new_correct_pos, correct_text)
        for i, label in enumerate(labels):
            q[label] = new_options[i]
        q["correct"] = labels[new_correct_pos]

        # Pick source from top chunk
        top_chunk = chunks[0]
        source = {
            "chapter_name": top_chunk.get("chapter_name", ""),
            "subtopic_name": top_chunk.get("subtopic_name", ""),
        }

        return {
            "id": 1,
            "question": q["question"],
            "options": {
                "A": q["A"],
                "B": q["B"],
                "C": q["C"],
                "D": q["D"],
            },
            "correct": q["correct"],
            "explanation": q["explanation"],
            "source": source,
        }

    except Exception as e:
        logger.warning(f"[Chat] Inline question generation failed: {e}")
        return None


def chat(
    query: str,
    subject_name: str,
    conversation_history: Optional[List[Dict]] = None,
    top_k: int = 8,
) -> Dict:
    """
    Full RAG chat pipeline:
    1. Retrieve relevant chunks from chapter/question JSONs
    2. Build context with numbered sources
    3. Generate answer via Groq LLM with inline citation instructions
    4. Generate one inline MCQ from the answer context
    """
    retrieval = retrieve(query, subject_name, top_k=top_k)
    chunks = retrieval["chunks"]

    if chunks:
        best_score = max(c.get("score", 0) for c in chunks)
        if best_score < 0.15:
            logger.info(
                f"[Chat] Low relevance score ({best_score:.3f}), "
                f"documents may not cover this topic"
            )
            retrieval["low_relevance"] = True

    related_questions = retrieval["related_questions"]

    if not chunks:
        return {
            "answer": (
                "The provided context does not contain information about this topic. "
                "It may not be covered in the uploaded documents."
            ),
            "sources": [],
            "related_questions": [],
            "inline_question": None,
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

    low_relevance = retrieval.get("low_relevance", False)
    relevance_warning = ""
    if low_relevance:
        relevance_warning = """
IMPORTANT: The retrieved context has LOW relevance to this question.
This likely means the topic is NOT covered in the uploaded documents.
You MUST respond that the information is not available in the notes.
DO NOT attempt to answer from your own knowledge."""

    user_message = f"""CONTEXT FROM COURSE MATERIALS:
{context}
{relevance_warning}

STUDENT'S QUESTION:
{query}

Remember: cite sources inline as [1], [2], etc. Use Markdown and LaTeX for math.
If the context does not contain relevant information for this question, say so clearly."""

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

    # Only generate inline question if we have a real answer and relevant chunks
    inline_question = None
    if answer and not low_relevance and chunks:
        inline_question = _generate_inline_question(
            user_query=query,
            answer=answer,
            chunks=chunks,
            subject_name=subject_name,
        )

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
        "inline_question": inline_question,
        "metadata": retrieval.get("metadata", {}),
    }