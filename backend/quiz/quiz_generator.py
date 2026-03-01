"""
Quiz generator — LLM + RAG approach.
1. Load chapter notes and past questions for the subject.
2. Sample diverse content chunks across chapters.
3. Send to LLM with strict instructions to generate MCQs grounded ONLY in provided content.
4. Parse and return structured quiz data.
"""

import os
import json
import random
import logging
import re
from typing import List, Dict, Optional

from config import Config

logger = logging.getLogger(__name__)

# ── File loaders ────────────────────────────────────────────────────

def _find_json_files(directory: str) -> List[str]:
    """Find all JSON files in a directory."""
    if not os.path.isdir(directory):
        return []
    return [
        os.path.join(directory, f)
        for f in sorted(os.listdir(directory))
        if f.endswith(".json")
    ]


def _load_json(path: str):
    if not path or not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_chapter_data(subject_name: str) -> List[Dict]:
    """Load chapter JSON data for the subject."""
    chapter_dir = os.path.join(Config.CHAPTER_JSON_DIR, subject_name)
    files = _find_json_files(chapter_dir)
    all_chapters = []
    for f in files:
        data = _load_json(f)
        if isinstance(data, list):
            all_chapters.extend(data)
        elif isinstance(data, dict):
            all_chapters.append(data)
    return all_chapters


def _load_dataset(subject_name: str) -> List[Dict]:
    """Load generated dataset (past exam Q&A) for the subject."""
    path = os.path.join(
        Config.DATASETS_DIR, "generated_datasets", f"{subject_name}_dataset.json"
    )
    data = _load_json(path)
    if data and isinstance(data, list):
        return data
    return []


def _load_question_data(subject_name: str) -> List[Dict]:
    """Load scanned question data for the subject."""
    question_dir = os.path.join(Config.QUESTION_JSON_DIR, subject_name)
    files = _find_json_files(question_dir)
    all_questions = []
    for f in files:
        data = _load_json(f)
        if isinstance(data, dict):
            all_questions.extend(data.get("questions", []))
        elif isinstance(data, list):
            all_questions.extend(data)
    return all_questions


# ── Content preparation ─────────────────────────────────────────────

def _build_context_chunks(chapters: List[Dict], dataset: List[Dict]) -> List[Dict]:
    """
    Build a list of content chunks from chapters and dataset entries.
    Each chunk has: text, chapter_name, subtopic_name
    """
    chunks = []

    # From chapter subtopics
    for ch in chapters:
        ch_name = ch.get("chapter_name", "Unknown Chapter")
        for sub in ch.get("subtopics", []):
            para = sub.get("paragraph", "").strip()
            sub_name = sub.get("subtopic_name", "")
            if para and len(para) > 30:
                # Trim very long paragraphs
                text = para[:1500] if len(para) > 1500 else para
                chunks.append({
                    "text": text,
                    "chapter_name": ch_name,
                    "subtopic_name": sub_name,
                    "source": "notes",
                })

    # From dataset (past exam Q&A pairs — these give good quiz material)
    for item in dataset:
        context = item.get("context", "").strip()
        question = item.get("question", "").strip()
        answer = item.get("answer", "").strip()
        if context and len(context) > 30:
            combined = f"Past exam question: {question}\nAnswer: {answer}\nContext: {context[:800]}"
            chunks.append({
                "text": combined,
                "chapter_name": "",
                "subtopic_name": question[:80],
                "source": "past_paper",
            })

    return chunks


def _select_diverse_chunks(chunks: List[Dict], max_chunks: int = 15) -> List[Dict]:
    """Select diverse chunks spread across chapters."""
    if len(chunks) <= max_chunks:
        return chunks

    # Group by chapter
    by_chapter: Dict[str, List[Dict]] = {}
    for c in chunks:
        key = c.get("chapter_name", "other")
        by_chapter.setdefault(key, []).append(c)

    # Shuffle within each chapter
    for v in by_chapter.values():
        random.shuffle(v)

    # Round-robin selection
    selected = []
    keys = list(by_chapter.keys())
    random.shuffle(keys)
    idx = 0
    while len(selected) < max_chunks:
        available_keys = [k for k in keys if by_chapter.get(k)]
        if not available_keys:
            break
        key = available_keys[idx % len(available_keys)]
        selected.append(by_chapter[key].pop(0))
        idx += 1

    return selected


# ── LLM call ────────────────────────────────────────────────────────

_client = None

def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI
        _client = OpenAI(
            api_key=Config.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
    return _client


def _call_llm(prompt: str) -> str:
    """Call the LLM using OpenAI client with Groq backend — same as chat module."""
    client = _get_client()
    response = client.chat.completions.create(
        model=Config.MODEL_NAME,
        messages=[
            {
                "role": "system",
                "content": "You are a quiz generator for exam preparation. You generate MCQ questions strictly based on provided study material.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=4000,
    )
    return response.choices[0].message.content


def _build_quiz_prompt(context_text: str, num_questions: int = 10) -> str:
    return f"""You are a quiz generator for exam preparation. Generate exactly {num_questions} multiple-choice questions (MCQs) based ONLY on the provided study material below. 

STRICT RULES:
1. Every question and every answer option MUST be directly based on the provided content. Do NOT use any external knowledge.
2. Questions should be short (1-3 sentences max), suitable for 1-mark MCQ format.
3. Each question has exactly 4 options: A, B, C, D. Only ONE is correct.
4. The correct answer must be factually accurate according to the provided content.
5. Distractor options (wrong answers) should be plausible but clearly wrong based on the content.
6. For technical/code subjects, you may ask about correct syntax, definitions, or short code snippets.
7. Spread questions across different topics from the content.
8. Keep answers concise — each option should be at most 1-2 sentences.

STUDY MATERIAL:
---
{context_text}
---

Respond with ONLY a valid JSON array. No markdown, no explanation, no extra text. Format:
[
  {{
    "question": "What is...?",
    "A": "Option A text",
    "B": "Option B text",
    "C": "Option C text",
    "D": "Option D text",
    "correct": "B",
    "explanation": "Brief 1-sentence explanation of why this is correct.",
    "source_topic": "The topic/subtopic name this question is about"
  }}
]

Generate exactly {num_questions} questions now:"""


def _parse_quiz_response(response_text: str) -> List[Dict]:
    """Parse the LLM response into structured quiz data."""
    text = response_text.strip()

    # Try to extract JSON array from response
    # Remove markdown code blocks if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    # Find the JSON array
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # Fallback: try to find individual JSON objects
    objects = []
    for match in re.finditer(r"\{[^{}]+\}", text):
        try:
            obj = json.loads(match.group())
            if "question" in obj and "correct" in obj:
                objects.append(obj)
        except json.JSONDecodeError:
            continue

    return objects


# ── Main entry point ────────────────────────────────────────────────

def generate_quiz(subject_name: str, num_questions: int = 10) -> Dict:
    """
    Generate a quiz with MCQ questions for the given subject.
    Uses RAG (retrieves content from documents) + LLM (generates questions).
    """
    logger.info(f"[Quiz] Starting quiz generation for '{subject_name}'")

    # Load all available content
    chapters = _load_chapter_data(subject_name)
    dataset = _load_dataset(subject_name)

    if not chapters and not dataset:
        raise ValueError(
            f"No study materials found for '{subject_name}'. "
            f"Checked: {Config.CHAPTER_JSON_DIR}/{subject_name}/ and "
            f"{Config.DATASETS_DIR}/generated_datasets/{subject_name}_dataset.json"
        )

    logger.info(
        f"[Quiz] Loaded {len(chapters)} chapters, {len(dataset)} dataset entries"
    )

    # Build and select diverse content chunks
    all_chunks = _build_context_chunks(chapters, dataset)
    selected_chunks = _select_diverse_chunks(all_chunks, max_chunks=15)

    logger.info(f"[Quiz] Using {len(selected_chunks)} content chunks for quiz generation")

    # Build context string for LLM
    context_parts = []
    chunk_sources = []
    for i, chunk in enumerate(selected_chunks, 1):
        ch_name = chunk.get("chapter_name", "")
        sub_name = chunk.get("subtopic_name", "")
        label = f"[Section {i}]"
        if ch_name:
            label += f" {ch_name}"
        if sub_name:
            label += f" > {sub_name}"
        context_parts.append(f"{label}\n{chunk['text']}")
        chunk_sources.append({
            "chapter_name": ch_name,
            "subtopic_name": sub_name,
        })

    context_text = "\n\n".join(context_parts)

    # Call LLM
    prompt = _build_quiz_prompt(context_text, num_questions)

    logger.info("[Quiz] Calling LLM for quiz generation...")
    response_text = _call_llm(prompt)

    logger.info(f"[Quiz] LLM response length: {len(response_text)}")

    # Parse response
    raw_questions = _parse_quiz_response(response_text)

    if not raw_questions:
        raise ValueError(
            "Failed to parse quiz questions from LLM response. "
            "The model may have returned an invalid format."
        )

    logger.info(f"[Quiz] Parsed {len(raw_questions)} questions from LLM response")

    # Build final structured output
    quiz_questions = []
    for i, q in enumerate(raw_questions[:num_questions], 1):
        question_text = q.get("question", "")
        if not question_text:
            continue

        correct = q.get("correct", "A").upper()
        if correct not in ("A", "B", "C", "D"):
            correct = "A"

        # Try to match source topic to our chunks
        source_topic = q.get("source_topic", "")
        matched_source = {"chapter_name": "", "subtopic_name": source_topic}
        for cs in chunk_sources:
            if (
                source_topic
                and (
                    source_topic.lower() in cs.get("subtopic_name", "").lower()
                    or source_topic.lower() in cs.get("chapter_name", "").lower()
                )
            ):
                matched_source = cs
                break

        quiz_questions.append({
            "id": i,
            "question": question_text,
            "options": {
                "A": q.get("A", ""),
                "B": q.get("B", ""),
                "C": q.get("C", ""),
                "D": q.get("D", ""),
            },
            "correct": correct,
            "explanation": q.get("explanation", ""),
            "source": matched_source,
        })

    if not quiz_questions:
        raise ValueError("No valid questions could be generated. Please try again.")

    return {
        "subject": subject_name,
        "total_questions": len(quiz_questions),
        "questions": quiz_questions,
    }