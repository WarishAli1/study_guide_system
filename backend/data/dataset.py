"""
Dataset Generator
=================
Generates a structured Q&A dataset from:
  - question_json  → questions with marks & chapter mapping
  - chapter_json   → chapter content (subtopics + paragraphs)

Output format (mirrors the screenshot):
[
  {
    "context":  "<relevant paragraph(s) from chapter JSON>",
    "question": "<question text>",
    "marks":    <int>,
    "answer":   "<structured LLM answer grounded in context>"
  },
  ...
]
"""

import os
import re
import json
import time
from typing import List, Dict, Optional, Tuple

from config import Config
from openai import OpenAI

client = OpenAI(
    api_key=Config.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)
MODEL_NAME = Config.MODEL_NAME
DATASET_PROMPT = Config.DATASET_PROMPT
MARKS_GUIDE = Config.MARKS_GUIDE

def _marks_guide(marks: int) -> str:
    for (lo, hi), guide in MARKS_GUIDE.items():
        if lo <= marks <= hi:
            return guide
    return MARKS_GUIDE[(9, 99)]

def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(path: str, data) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved → {path}")

def build_chapter_index(chapters: List[Dict]) -> Dict[int, List[Dict]]:
    index: Dict[int, List[Dict]] = {}
    for ch in chapters:
        cid = ch["chapter_id"]
        index[cid] = ch.get("subtopics", [])
    return index

def _keyword_overlap(text: str, keywords: List[str]) -> int:
    text_lower = text.lower()
    return sum(1 for kw in keywords if kw.lower() in text_lower)

def retrieve_context(
    question_text: str,
    chapter_ids: List[int],
    chapter_index: Dict[int, List[Dict]],
    top_k: int = 3,
) -> Tuple[str, List[str]]:
    """
    Return (context_string, list_of_source_labels) for the question.
    Scores each subtopic paragraph by keyword overlap with the question.
    """
    q_words = set(re.findall(r"\b\w{4,}\b", question_text.lower()))
    scored: List[Tuple[float, str, str]] = []  # (score, label, paragraph)

    for cid in chapter_ids:
        subtopics = chapter_index.get(cid, [])
        for st in subtopics:
            para  = st.get("paragraph", "")
            name  = st.get("subtopic_name", "")
            kws   = st.get("keywords", [])
            para_words = set(re.findall(r"\b\w{4,}\b", para.lower()))
            overlap    = len(q_words & para_words)
            kw_overlap = _keyword_overlap(question_text, kws)
            score      = overlap + kw_overlap * 2
            if score > 0:
                label = f"Chapter {cid} – {name}"
                scored.append((score, label, para))

    scored.sort(key=lambda x: -x[0])
    seen_paras: set = set()
    deduped = []
    for item in scored:
        para_key = item[2][:120]
        if para_key not in seen_paras:
            seen_paras.add(para_key)
            deduped.append(item)
    top = deduped[:top_k]

    if not top:
        fallback_paras = []
        for cid in chapter_ids:
            subtopics = chapter_index.get(cid, [])
            if subtopics:
                st = subtopics[0]
                fallback_paras.append(st.get("paragraph", ""))
        context = "\n\n".join(fallback_paras).strip()
        return context, ["fallback"]

    context = "\n\n".join(p for _, _, p in top)
    sources = [lbl for _, lbl, _ in top]
    return context, sources

def generate_answer(
    question: str,
    context: str,
    marks: int,
    max_retries: int = 5,
    base_delay: int = 5,
) -> str:
    guide = _marks_guide(marks)
    user_msg = f"""CONTEXT:
{context}

QUESTION: {question}
MARKS: {marks}
MARKS GUIDE: {guide}

Write a structured exam answer grounded strictly in the context above."""

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": DATASET_PROMPT},
                    {"role": "user",   "content": user_msg},
                ],
                temperature=0.2,
                top_p=0.9,
                max_tokens=1024,
            )
            time.sleep(base_delay)
            return response.choices[0].message.content.strip()
        except Exception as e:
            err = str(e).lower()
            if "429" in err or "rate limit" in err:
                wait = base_delay * (2 ** attempt)
                print(f"  [Rate Limit] Waiting {wait}s …")
                time.sleep(wait)
            elif "402" in err or "quota" in err:
                raise RuntimeError("API quota exceeded.")
            else:
                print(f"  [Error] {e}")
                if attempt >= max_retries - 1:
                    return "Answer could not be generated due to API error."
                time.sleep(2 ** attempt)
    return "Answer could not be generated."

def clean_question(raw: str) -> str:
    """Strip leading numbering like '1.' or 'Q1.' from question text."""
    cleaned = re.sub(r"^\s*\d+[\.\)]\s*", "", raw).strip()
    # Remove trailing mark hints like [8] or (10)
    cleaned = re.sub(r"\s*[\[\(]\d+[\]\)]\s*$", "", cleaned).strip()
    return cleaned

def resolve_marks(marks_list) -> int:
    if isinstance(marks_list, (int, float)) and marks_list:
        return int(marks_list)
    if isinstance(marks_list, list):
        for m in marks_list:
            if m and isinstance(m, (int, float)):
                return int(m)
    return 5  # default

def generate_dataset(
    subject_name: str,
    questions_path: Optional[str] = None,
    chapters_path: Optional[str] = None,
    output_path: Optional[str] = None,
    top_k_context: int = 3,
) -> List[Dict]:
    """
    Build dataset for a given subject.

    Parameters
    ----------
    subject_name    : used to locate JSON files if paths not given explicitly
    questions_path  : override default path from Config
    chapters_path   : override default path from Config
    output_path     : where to save the dataset JSON
    top_k_context   : how many subtopic paragraphs to include as context
    """
    # ── Resolve file paths ────────────────────────────────────────────────────
    if questions_path is None:
        questions_path = os.path.join(
            Config.QUESTION_JSON_DIR, subject_name, f"{subject_name}_questions.json"
        )
    if chapters_path is None:
        chapters_path = os.path.join(
            Config.CHAPTER_JSON_DIR, subject_name, f"{subject_name}_chapters.json"
        )
    if output_path is None:
        output_path = os.path.join(
            Config.DATASETS_DIR, "generated_datasets", f"{subject_name}_dataset.json"
        )

    print(f"\n{'='*60}")
    print(f"  Subject      : {subject_name}")
    print(f"  Questions    : {questions_path}")
    print(f"  Chapters     : {chapters_path}")
    print(f"  Output       : {output_path}")
    print(f"{'='*60}\n")

    questions = load_json(questions_path)
    chapters  = load_json(chapters_path)

    chapter_index = build_chapter_index(chapters)
    dataset: List[Dict] = []

    total = len(questions)
    for idx, q_entry in enumerate(questions, 1):
        raw_question = q_entry.get("question", "").strip()
        chapter_ids  = q_entry.get("chapter_id", [])
        marks_raw    = q_entry.get("marks", [])

        if not raw_question:
            print(f"  [{idx}/{total}] Skipping empty question.")
            continue

        if isinstance(chapter_ids, int):
            chapter_ids = [chapter_ids]
        elif not isinstance(chapter_ids, list):
            chapter_ids = []

        marks   = resolve_marks(marks_raw)
        question_clean = clean_question(raw_question)

        print(f"  [{idx}/{total}] Marks={marks} | {question_clean[:80]} …")

        context, sources = retrieve_context(
            question_text=question_clean,
            chapter_ids=chapter_ids,
            chapter_index=chapter_index,
            top_k=top_k_context,
        )

        answer = generate_answer(
            question=question_clean,
            context=context,
            marks=marks,
        )

        dataset.append({
            "context":  context,
            "question": question_clean,
            "marks":    marks,
            "answer":   answer,
        })

        print(f"Answer generated ({len(answer)} chars) | Sources: {sources}")

    save_json(output_path, dataset)
    print(f"\n✓ Dataset complete — {len(dataset)} records saved to:\n  {output_path}\n")
    return dataset

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate Q&A dataset from chapter + question JSONs.")
    parser.add_argument("--subject",   default="AI",  help="Subject name (used for folder lookup)")
    parser.add_argument("--questions", default=None,  help="Explicit path to questions JSON")
    parser.add_argument("--chapters",  default=None,  help="Explicit path to chapters JSON")
    parser.add_argument("--output",    default=None,  help="Output path for dataset JSON")
    parser.add_argument("--top_k",     default=3, type=int, help="Top-K context paragraphs per question")
    args = parser.parse_args()

    generate_dataset(
        subject_name   = args.subject,
        questions_path = args.questions,
        chapters_path  = args.chapters,
        output_path    = args.output,
        top_k_context  = args.top_k,
    )