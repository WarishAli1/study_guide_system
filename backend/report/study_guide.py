import json
import os
import re
import time
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from config import Config
from openai import OpenAI

logger = logging.getLogger(__name__)

client = OpenAI(
    api_key=Config.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)
MODEL_NAME = Config.MODEL_NAME


def _load_json(path: str) -> Any:
    if not path or not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _find_json_files(directory: str) -> List[str]:
    p = directory if isinstance(directory, str) else str(directory)
    if not os.path.isdir(p):
        return []
    return sorted(
        os.path.join(p, f) for f in os.listdir(p) if f.endswith(".json")
    )


def _find_first_json(directory: str) -> Optional[str]:
    files = _find_json_files(directory)
    return files[0] if files else None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


TOPIC_EXTRACT_PROMPT = """You are a data extraction engine.
Given a chapter name and its syllabus description, extract the important topics and keywords.

Return ONLY valid JSON (no markdown fences) in this exact format:
{
  "topics": ["Topic A", "Topic B", ...],
  "keywords": ["keyword1", "keyword2", ...]
}

Rules:
- Topics are the main sub-subjects or concepts covered in the chapter.
- Keywords are specific technical terms that a student should know.
- Do NOT add topics or keywords that are not mentioned or implied.
- Keep each list to at most 10 items.
- Return ONLY the JSON object, nothing else."""


def _extract_topics_keywords_llm(chapter_name: str, description: str) -> Dict:
    if not description or len(description.strip()) < 10:
        return {"topics": [], "keywords": []}

    max_retries = 3
    base_delay = 3
    for attempt in range(max_retries):
        try:
            resp = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": TOPIC_EXTRACT_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"Chapter: {chapter_name}\n\n"
                            f"Syllabus content:\n{description[:2000]}"
                        ),
                    },
                ],
                temperature=0,
                max_tokens=600,
            )
            time.sleep(base_delay)
            raw = resp.choices[0].message.content.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
            data = json.loads(raw)
            return {
                "topics": data.get("topics", [])[:10],
                "keywords": data.get("keywords", [])[:10],
            }
        except json.JSONDecodeError:
            logger.warning("LLM returned non-JSON for chapter '%s'", chapter_name)
            return {"topics": [], "keywords": []}
        except Exception as e:
            err = str(e).lower()
            if "429" in err or "rate limit" in err:
                wait = base_delay * (2 ** attempt)
                logger.info("Rate-limited, waiting %ss ...", wait)
                time.sleep(wait)
                continue
            logger.error("LLM topic extraction failed: %s", e)
            return {"topics": [], "keywords": []}

    return {"topics": [], "keywords": []}


def _build_question_map(questions: list) -> Dict[str, Dict]:
    q_map: Dict[str, Dict] = defaultdict(lambda: {
        "questions": [],
        "total_freq": 0,
    })
    for q in questions:
        chapter_ids = q.get("chapter_id", [])
        if isinstance(chapter_ids, (int, str)):
            chapter_ids = [chapter_ids]
        freq = q.get("freq", 1)
        seen = set()
        for cid in chapter_ids:
            cid_str = str(cid)
            if cid_str in seen:
                continue
            seen.add(cid_str)
            q_map[cid_str]["questions"].append({
                "question": q.get("question", ""),
                "freq": freq,
                "years": [str(y) for y in q.get("years", [])],
                "marks": [m if m is not None else None for m in q.get("marks", [])],
            })
            q_map[cid_str]["total_freq"] += freq
    return dict(q_map)


def _compute_importance(
    credit_hours: Optional[int],
    marks_dist: Optional[int],
    max_credits: int,
    max_marks: int,
    question_freq: int,
    max_freq: int,
) -> float:
    ch = ((credit_hours or 0) / max_credits * 10) if max_credits else 0
    mk = ((marks_dist or 0) / max_marks * 10) if max_marks else 0
    qf = (question_freq / max_freq * 10) if max_freq else 0
    return round(min(0.35 * ch + 0.35 * mk + 0.30 * qf, 10), 2)


def _priority_label(score: float) -> str:
    if score >= 7.0:
        return "HIGH"
    if score >= 4.0:
        return "MEDIUM"
    return "LOW"


def _allocate_time(chapters: List[Dict], total_hours: Optional[int] = None) -> List[Dict]:
    total = total_hours or 40
    total_score = sum(c["importance_score"] for c in chapters) or 1
    for ch in chapters:
        ratio = ch["importance_score"] / total_score
        ch["recommended_hours"] = round(ratio * total, 1)
    return chapters


def _resolve_subject_name(syllabus_data: dict, folder_name: str) -> str:
    """
    Extract the real subject name from syllabus JSON.
    Falls back to folder_name if not found.
    """
    for key in ["subject_name", "subject", "course_name", "course_title", "title", "name"]:
        val = syllabus_data.get(key)
        if val and isinstance(val, str) and val.strip():
            return val.strip()

    if folder_name and folder_name not in ("general", "default", ""):
        return folder_name.replace("_", " ").title()

    return folder_name


def generate_study_guide(subject_name: str) -> Dict:
    syl_dir = os.path.join(Config.SYLLABUS_JSON_DIR, subject_name)
    syl_path = _find_first_json(syl_dir)
    if not syl_path:
        raise FileNotFoundError(
            f"No syllabus data found for subject '{subject_name}'. "
            "Please upload a syllabus first."
        )

    q_dir = os.path.join(Config.QUESTION_JSON_DIR, subject_name)
    q_path = _find_first_json(q_dir)

    ch_dir = os.path.join(Config.CHAPTER_JSON_DIR, subject_name)
    ch_path = _find_first_json(ch_dir)

    syllabus_data = _load_json(syl_path) or {}
    question_raw = _load_json(q_path) if q_path else None
    chapter_data = _load_json(ch_path) if ch_path else []

    if isinstance(question_raw, dict):
        question_data = question_raw.get("questions", [])
    elif isinstance(question_raw, list):
        question_data = question_raw
    else:
        question_data = []

    logger.info(
        f"Study guide for '{subject_name}': "
        f"syllabus={syl_path}, questions={q_path} ({len(question_data)} Qs), "
        f"chapters={ch_path}"
    )

    if isinstance(chapter_data, dict):
        chapter_data = [chapter_data]

    syllabus_chapters = syllabus_data.get("chapters", [])
    if not syllabus_chapters:
        raise ValueError(
            "Syllabus was uploaded but no chapters were detected. "
            "The syllabus PDF may not have been parsed correctly."
        )

    display_name = _resolve_subject_name(syllabus_data, subject_name)

    total_credits = syllabus_data.get("total_credit_hours") or sum(
        c.get("credit_hours") or 0 for c in syllabus_chapters
    ) or None
    total_marks = syllabus_data.get("total_marks") or sum(
        c.get("marks_distribution") or 0 for c in syllabus_chapters
    ) or None

    max_credits = max((c.get("credit_hours") or 0) for c in syllabus_chapters) or 1
    max_marks = max((c.get("marks_distribution") or 0) for c in syllabus_chapters) or 1

    q_map = _build_question_map(question_data)
    max_freq = max((v["total_freq"] for v in q_map.values()), default=0) or 1
    logger.info(f"Question map: {len(q_map)} chapters, max_freq={max_freq}")

    ch_map: Dict[str, Dict] = {}
    for ch in chapter_data:
        ch_map[str(ch.get("chapter_id", ""))] = ch

    chapter_reports: List[Dict] = []

    cleaned_syl_dir = os.path.join(Config.CLEANED_TEXT_DIR, subject_name, "syllabus")
    cleaned_syl_text = ""
    if os.path.isdir(cleaned_syl_dir):
        for fn in os.listdir(cleaned_syl_dir):
            fp = os.path.join(cleaned_syl_dir, fn)
            if os.path.isfile(fp):
                with open(fp, "r", encoding="utf-8") as f:
                    cleaned_syl_text += f.read() + "\n"

    for syl_ch in syllabus_chapters:
        cid_str = str(syl_ch.get("chapter_id", ""))
        chapter_name = syl_ch.get("chapter_name", f"Chapter {cid_str}")
        credit_hours = syl_ch.get("credit_hours")
        marks_dist = syl_ch.get("marks_distribution")

        qinfo = q_map.get(cid_str, {"questions": [], "total_freq": 0})
        questions_sorted = sorted(
            qinfo["questions"], key=lambda x: x["freq"], reverse=True
        )

        ch_json = ch_map.get(cid_str)
        if ch_json and ch_json.get("subtopics"):
            topics = [
                s.get("subtopic_name", "")
                for s in ch_json["subtopics"]
                if s.get("subtopic_name")
            ]
            keywords = ch_json.get("keywords", [])
        else:
            desc = syl_ch.get("description", "")
            if not desc and cleaned_syl_text:
                pattern = re.compile(
                    rf"(?:Chapter|Unit)\s*{re.escape(cid_str)}\s*[:\-]?\s*{re.escape(chapter_name)}(.*?)(?=(?:Chapter|Unit)\s*\d|\Z)",
                    re.IGNORECASE | re.DOTALL,
                )
                m = pattern.search(cleaned_syl_text)
                if m:
                    desc = m.group(1).strip()[:2000]

            if not desc:
                topic_list = syl_ch.get("topics", [])
                if topic_list:
                    desc = f"{chapter_name}: " + ", ".join(
                        t if isinstance(t, str) else t.get("name", "")
                        for t in topic_list
                    )

            if desc:
                extracted = _extract_topics_keywords_llm(chapter_name, desc)
                topics = extracted["topics"]
                keywords = extracted["keywords"]
            else:
                topics = []
                keywords = []

        importance = _compute_importance(
            credit_hours, marks_dist,
            max_credits, max_marks,
            qinfo["total_freq"], max_freq,
        )

        chapter_reports.append({
            "chapter_id": cid_str,
            "chapter_name": chapter_name,
            "credit_hours": credit_hours,
            "marks_distribution": marks_dist,
            "importance_score": importance,
            "priority": _priority_label(importance),
            "topics": topics,
            "keywords": keywords,
            "questions": questions_sorted[:20],
            "total_questions": len(questions_sorted),
            "recommended_hours": 0,
        })

    chapter_reports = _allocate_time(chapter_reports, total_credits)

    chapter_reports.sort(key=lambda c: c["importance_score"], reverse=True)

    report = {
        "subject_name": display_name,
        "total_chapters": len(chapter_reports),
        "total_credit_hours": total_credits,
        "total_marks": total_marks,
        "total_questions": sum(c["total_questions"] for c in chapter_reports),
        "generated_at": _now_iso(),
        "chapters": chapter_reports,
    }

    out_dir = os.path.join(Config.REPORTS_DIR, subject_name)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "study_guide.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    return report


def get_cached_guide(subject_name: str) -> Optional[Dict]:
    path = os.path.join(Config.REPORTS_DIR, subject_name, "study_guide.json")
    return _load_json(path)