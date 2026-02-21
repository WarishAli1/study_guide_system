import json
import os
import re
import time
import logging
from config import Config
from openai import OpenAI

logger = logging.getLogger(__name__)

client = OpenAI(
    api_key=Config.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)
MODEL_NAME = Config.MODEL_NAME


def load_syllabus_json(subject_name: str) -> dict:
    """Load the syllabus JSON for the given subject."""
    syllabus_dir = os.path.join(Config.SYLLABUS_JSON_DIR, subject_name)
    if not os.path.isdir(syllabus_dir):
        logger.warning(f"No syllabus directory found at: {syllabus_dir}")
        return {}

    json_files = sorted(
        f for f in os.listdir(syllabus_dir) if f.endswith(".json")
    )
    if not json_files:
        logger.warning(f"No syllabus JSON files found in: {syllabus_dir}")
        return {}

    path = os.path.join(syllabus_dir, json_files[0])
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    logger.info(f"Loaded syllabus JSON from: {path}")
    return data


def get_chapter_list(syllabus_data: dict) -> list:
    """Extract chapter list from syllabus data."""
    chapters = syllabus_data.get("chapters", [])
    return [
        {
            "chapter_id": ch.get("chapter_id"),
            "chapter_name": ch.get("chapter_name", ""),
        }
        for ch in chapters
    ]


QUESTION_EXTRACTION_PROMPT = """You are a question extraction engine for past exam papers.

Given raw text from a past exam paper, extract EVERY question.

For each question, return:
- "question": the full question text (clean it up, remove question numbers)
- "marks": integer marks if visible, otherwise null
- "year": the exam year if detectable from the document, otherwise null
- "section": the section label if visible (e.g., "A", "B", "Part I"), otherwise null

Return ONLY valid JSON (no markdown fences):
{
  "year": "2023" or null,
  "questions": [
    {
      "question": "...",
      "marks": 5 or null,
      "section": "A" or null
    }
  ]
}

Rules:
- Extract ALL questions, including sub-questions (a, b, c etc.) as separate entries
- Remove leading numbers/letters like "1.", "a)", "Q1" from the question text
- Preserve technical terms, formulas, and specific details
- If you see "OR" between questions, treat each alternative as a separate question
- Return ONLY the JSON object"""


CHAPTER_MAPPING_PROMPT = """You are a chapter classification engine.

Given a list of chapters from a syllabus and a question from an exam paper, determine which chapter(s) the question belongs to.

Chapters:
{chapters}

Question: {question}

Return ONLY valid JSON (no markdown fences):
{{
  "chapter_ids": [1, 2]
}}

Rules:
- A question can belong to multiple chapters
- Use ONLY chapter IDs from the provided list
- If unsure, pick the most likely chapter
- Return ONLY the JSON object"""


def extract_questions_from_text(raw_text: str) -> dict:
    """Use LLM to extract questions from past paper text."""
    chunks = []
    max_chunk = 3000
    if len(raw_text) > max_chunk:
        lines = raw_text.split("\n")
        current_chunk = ""
        for line in lines:
            if len(current_chunk) + len(line) > max_chunk:
                chunks.append(current_chunk)
                current_chunk = line
            else:
                current_chunk += "\n" + line
        if current_chunk.strip():
            chunks.append(current_chunk)
    else:
        chunks = [raw_text]

    all_questions = []
    detected_year = None

    for i, chunk in enumerate(chunks):
        max_retries = 3
        base_delay = 3

        for attempt in range(max_retries):
            try:
                resp = client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=[
                        {"role": "system", "content": QUESTION_EXTRACTION_PROMPT},
                        {"role": "user", "content": f"Extract questions from this exam paper text:\n\n{chunk}"},
                    ],
                    temperature=0,
                    max_tokens=4000,
                )
                time.sleep(base_delay)

                content = resp.choices[0].message.content.strip()
                content = re.sub(r"^```(?:json)?\s*", "", content)
                content = re.sub(r"\s*```$", "", content)

                data = json.loads(content)
                if data.get("year") and not detected_year:
                    detected_year = str(data["year"])

                for q in data.get("questions", []):
                    q_text = q.get("question", "").strip()
                    if q_text and len(q_text) > 10:
                        all_questions.append({
                            "question": q_text,
                            "marks": q.get("marks"),
                            "section": q.get("section"),
                        })
                break

            except json.JSONDecodeError:
                logger.warning(f"Non-JSON response for chunk {i+1}")
                break
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "rate limit" in err_str:
                    wait = base_delay * (2 ** attempt)
                    logger.info(f"Rate-limited, waiting {wait}s ...")
                    time.sleep(wait)
                    continue
                logger.error(f"LLM extraction failed for chunk {i+1}: {e}")
                break

    return {
        "year": detected_year,
        "questions": all_questions,
    }


def map_questions_to_chapters(questions: list, chapters: list) -> list:
    """Use LLM to map each question to chapter(s)."""
    if not chapters:
        logger.warning("No chapters provided for mapping. Skipping.")
        return questions

    chapter_text = "\n".join(
        f"  Chapter {ch['chapter_id']}: {ch['chapter_name']}"
        for ch in chapters
    )

    mapped = []
    base_delay = 3

    for i, q in enumerate(questions):
        max_retries = 3
        chapter_ids = []

        for attempt in range(max_retries):
            try:
                prompt = CHAPTER_MAPPING_PROMPT.format(
                    chapters=chapter_text,
                    question=q["question"][:500],
                )
                resp = client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=[
                        {"role": "system", "content": "You are a chapter classification engine. Return only JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0,
                    max_tokens=200,
                )
                time.sleep(base_delay)

                content = resp.choices[0].message.content.strip()
                content = re.sub(r"^```(?:json)?\s*", "", content)
                content = re.sub(r"\s*```$", "", content)

                data = json.loads(content)
                chapter_ids = data.get("chapter_ids", [])
                break

            except json.JSONDecodeError:
                logger.warning(f"Non-JSON for question {i+1} mapping")
                break
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "rate limit" in err_str:
                    wait = base_delay * (2 ** attempt)
                    logger.info(f"Rate-limited, waiting {wait}s ...")
                    time.sleep(wait)
                    continue
                logger.error(f"Chapter mapping failed for question {i+1}: {e}")
                break

        mapped.append({
            **q,
            "chapter_id": chapter_ids,
        })

    return mapped


def merge_questions(existing: list, new_questions: list, year: str = None) -> list:
    """Merge new questions into existing, updating frequency and years."""
    q_lookup = {}
    for q in existing:
        key = re.sub(r"\s+", " ", q["question"].lower().strip())
        q_lookup[key] = q

    for nq in new_questions:
        key = re.sub(r"\s+", " ", nq["question"].lower().strip())
        if key in q_lookup:
            eq = q_lookup[key]
            eq["freq"] = eq.get("freq", 1) + 1
            if year and year not in eq.get("years", []):
                eq.setdefault("years", []).append(year)
            new_marks = nq.get("marks")
            if new_marks is not None:
                eq.setdefault("marks", []).append(new_marks)
            for cid in nq.get("chapter_id", []):
                if cid not in eq.get("chapter_id", []):
                    eq.setdefault("chapter_id", []).append(cid)
        else:
            entry = {
                "question": nq["question"],
                "chapter_id": nq.get("chapter_id", []),
                "freq": 1,
                "years": [year] if year else [],
                "marks": [nq["marks"]] if nq.get("marks") is not None else [],
                "section": nq.get("section"),
            }
            q_lookup[key] = entry

    return list(q_lookup.values())


def process_raw_and_questions(subject_name: str, raw_text_path: str) -> dict:
    """
    Main entry: extract questions from raw text, map to chapters, merge, save.
    """
    if not os.path.isfile(raw_text_path):
        raise FileNotFoundError(f"Raw text file not found: {raw_text_path}")

    with open(raw_text_path, "r", encoding="utf-8") as f:
        raw_text = f.read()

    if not raw_text.strip():
        raise ValueError("Raw text file is empty.")

    logger.info(f"Extracting questions from: {raw_text_path}")

    extraction = extract_questions_from_text(raw_text)
    questions = extraction["questions"]
    detected_year = extraction.get("year")

    if not questions:
        logger.warning("No questions extracted from the past paper.")
        return {
            "success": True,
            "message": "No questions could be extracted.",
            "questions_extracted": 0,
        }

    logger.info(f"Extracted {len(questions)} questions, year: {detected_year}")

    syllabus_data = load_syllabus_json(subject_name)
    chapters = get_chapter_list(syllabus_data)

    if chapters:
        logger.info(f"Mapping questions to {len(chapters)} chapters...")
        questions = map_questions_to_chapters(questions, chapters)
    else:
        logger.warning(f"No syllabus chapters found for '{subject_name}'. "
                       f"Questions will not be mapped to chapters.")
        for q in questions:
            q["chapter_id"] = []

    out_dir = os.path.join(Config.QUESTION_JSON_DIR, subject_name)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "questions.json")

    existing = []
    if os.path.isfile(out_path):
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing = data if isinstance(data, list) else data.get("questions", [])
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Could not load existing questions: {e}")

    merged = merge_questions(existing, questions, detected_year)

    output = {
        "subject": subject_name,
        "total_questions": len(merged),
        "questions": merged,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved {len(merged)} questions to: {out_path}")

    return {
        "success": True,
        "message": f"Extracted {len(questions)} questions, total: {len(merged)}",
        "questions_extracted": len(questions),
        "total_questions": len(merged),
        "detected_year": detected_year,
        "output_path": out_path,
    }