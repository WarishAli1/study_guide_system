import os
import json
import random
import logging
import re
from typing import List, Dict, Optional

from config import Config

logger = logging.getLogger(__name__)


QUIZ_SYSTEM_PROMPT = Config.QUIZ_SYSTEM_PROMPT
QUIZ_USER_PROMPT = Config.QUIZ_USER_PROMPT


def _find_json_files(directory: str) -> List[str]:
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
    """Load ALL chapter JSON files for the subject."""
    chapter_dir = os.path.join(Config.CHAPTER_JSON_DIR, subject_name)
    if not os.path.isdir(chapter_dir):
        return []
    all_chapters = []
    for f in sorted(os.listdir(chapter_dir)):
        if f.endswith(".json"):
            path = os.path.join(chapter_dir, f)
            data = _load_json(path)
            if isinstance(data, list):
                all_chapters.extend(data)
            elif isinstance(data, dict):
                all_chapters.append(data)
    return all_chapters


def _load_dataset(subject_name: str) -> List[Dict]:
    path = os.path.join(
        Config.DATASETS_DIR, "generated_datasets", f"{subject_name}_dataset.json"
    )
    data = _load_json(path)
    if data and isinstance(data, list):
        return data
    return []


def _load_question_data(subject_name: str) -> List[Dict]:
    """Load ALL question JSON files for the subject."""
    question_dir = os.path.join(Config.QUESTION_JSON_DIR, subject_name)
    if not os.path.isdir(question_dir):
        return []
    all_questions = []
    for f in sorted(os.listdir(question_dir)):
        if f.endswith(".json"):
            path = os.path.join(question_dir, f)
            data = _load_json(path)
            if isinstance(data, dict):
                all_questions.extend(data.get("questions", []))
            elif isinstance(data, list):
                all_questions.extend(data)
    return all_questions


def _build_context_chunks(chapters: List[Dict], dataset: List[Dict]) -> List[Dict]:
    chunks = []

    for ch in chapters:
        ch_name = ch.get("chapter_name", "Unknown Chapter")
        for sub in ch.get("subtopics", []):
            para = sub.get("paragraph", "").strip()
            sub_name = sub.get("subtopic_name", "")
            if para and len(para) > 30:
                text = para[:1500] if len(para) > 1500 else para
                chunks.append({
                    "text": text,
                    "chapter_name": ch_name,
                    "subtopic_name": sub_name,
                    "source": "notes",
                })

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
    if len(chunks) <= max_chunks:
        return chunks

    by_chapter: Dict[str, List[Dict]] = {}
    for c in chunks:
        key = c.get("chapter_name", "other")
        by_chapter.setdefault(key, []).append(c)

    for v in by_chapter.values():
        random.shuffle(v)

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


def _call_llm(context_text: str, num_questions: int) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model=Config.MODEL_NAME,
        messages=[
            {
                "role": "system",
                "content": QUIZ_SYSTEM_PROMPT.strip(),
            },
            {
                "role": "user",
                "content": QUIZ_USER_PROMPT.format(
                    num_questions=num_questions,
                    context_text=context_text,
                ),
            },
        ],
        temperature=0.3,
        max_tokens=4000,
    )
    return response.choices[0].message.content


def _parse_quiz_response(response_text: str) -> List[Dict]:
    text = response_text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

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

    objects = []
    for match in re.finditer(r"\{[^{}]+\}", text):
        try:
            obj = json.loads(match.group())
            if "question" in obj and "correct" in obj:
                objects.append(obj)
        except json.JSONDecodeError:
            continue

    return objects


def _shuffle_correct_answer(q: Dict) -> Dict:
    labels = ["A", "B", "C", "D"]
    correct_label = q.get("correct", "A").upper()
    correct_text = q.get(correct_label, "")

    wrong_texts = [q[l] for l in labels if l != correct_label and q.get(l)]
    random.shuffle(wrong_texts)

    new_correct_pos = random.randint(0, 3)
    new_options = wrong_texts.copy()
    new_options.insert(new_correct_pos, correct_text)

    for i, label in enumerate(labels):
        q[label] = new_options[i]
    q["correct"] = labels[new_correct_pos]
    return q


def generate_quiz(subject_name: str, num_questions: int = 10) -> Dict:
    logger.info(f"[Quiz] Starting quiz generation for '{subject_name}'")

    chapters = _load_chapter_data(subject_name)
    dataset = _load_dataset(subject_name)

    if not chapters and not dataset:
        raise ValueError(
            f"No study materials found for '{subject_name}'. "
            f"Checked: {Config.CHAPTER_JSON_DIR}/{subject_name}/ and "
            f"{Config.DATASETS_DIR}/generated_datasets/{subject_name}_dataset.json"
        )

    logger.info(f"[Quiz] Loaded {len(chapters)} chapters, {len(dataset)} dataset entries")

    all_chunks = _build_context_chunks(chapters, dataset)
    selected_chunks = _select_diverse_chunks(all_chunks, max_chunks=15)

    logger.info(f"[Quiz] Using {len(selected_chunks)} content chunks for quiz generation")

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

    logger.info("[Quiz] Calling LLM for quiz generation...")
    response_text = _call_llm(context_text, num_questions)
    logger.info(f"[Quiz] LLM response length: {len(response_text)}")

    raw_questions = _parse_quiz_response(response_text)

    if not raw_questions:
        raise ValueError(
            "Failed to parse quiz questions from LLM response. "
            "The model may have returned an invalid format."
        )

    logger.info(f"[Quiz] Parsed {len(raw_questions)} questions from LLM response")

    quiz_questions = []
    for i, q in enumerate(raw_questions[:num_questions], 1):
        q = _shuffle_correct_answer(q)
        question_text = q.get("question", "")
        if not question_text:
            continue

        correct = q.get("correct", "A").upper()
        if correct not in ("A", "B", "C", "D"):
            correct = "A"

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