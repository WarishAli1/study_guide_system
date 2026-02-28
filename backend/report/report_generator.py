import json
import os
from collections import defaultdict
from pathlib import Path
from typing import Optional
from config import Config
from collections import Counter

CHAPTER_JSON_DIR  = Config.CHAPTER_JSON_DIR
QUESTION_JSON_DIR = Config.QUESTION_JSON_DIR
SYLLABUS_JSON_DIR = Config.SYLLABUS_JSON_DIR
REPORTS_DIR       = Config.REPORTS_DIR


def _load_json(path: str):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON at {path}: {e}")


def _subject_dir(base: str, subject_name: str) -> str:
    return os.path.join(base, subject_name)


def _find_json_file(directory: str) -> Optional[str]:
    p = Path(directory)
    if not p.exists():
        return None
    for f in p.iterdir():
        if f.suffix == ".json":
            return str(f)
    return None


def _build_question_map(questions: list) -> dict:
    q_map = defaultdict(lambda: {
        "all_questions": [],
        "repeat_questions": [],
        "total_marks_pool": 0,
        "max_marks_seen": 0,
    })
    for q in questions:
        chapter_ids = q.get("chapter_id", [])
        if isinstance(chapter_ids, int):
            chapter_ids = [chapter_ids]

        if not chapter_ids:
            continue
        cid = Counter(chapter_ids).most_common(1)[0][0]
        if cid == -1 and len(Counter(chapter_ids)) > 1:
            cid = Counter(c for c in chapter_ids if c != -1).most_common(1)[0][0] if any(c != -1 for c in chapter_ids) else -1

        freq  = q.get("freq", 1)
        marks = [
            m for m in (q.get("marks") or [])
            if m is not None and isinstance(m, (int, float)) and 1 <= int(m) <= 30
        ]

        entry = q_map[cid]
        entry["all_questions"].append(q)
        if freq > 1:
            entry["repeat_questions"].append({
                "question": q["question"],
                "freq": freq,
                "years": q.get("years", []),
                "marks": marks,
            })
        if marks:
            entry["total_marks_pool"] += sum(marks)
            entry["max_marks_seen"] = max(entry["max_marks_seen"], max(marks))
    return q_map


def _build_faq_list(all_questions: list) -> list:
    """
    Build the FAQ list from ALL questions mapped to a chapter,
    sorted by frequency (descending), then by max marks (descending).

    This ensures every question shows up in the study guide,
    not just repeated ones.
    """
    faq = []
    for q in all_questions:
        freq = q.get("freq", 1)
        marks = [m for m in (q.get("marks") or []) if m is not None]
        years = q.get("years", [])

        faq.append({
            "question": q["question"],
            "freq": freq,
            "years": years,
            "marks": marks,
        })

    faq.sort(key=lambda x: (
        x["freq"],
        max(x["marks"]) if x["marks"] else 0,
    ), reverse=True)

    return faq


def _compute_importance_score(
    credit_hours, marks_dist,
    max_credits, max_marks,
    repeat_q_count, total_q_count,
) -> float:
    """
    Score 0-10 using relative comparison across chapters (not subject totals).
    - credit_hours   vs max_credits in this subject   → 40%
    - marks_dist     vs max_marks in this subject      → 40%
    - repeat ratio   (repeat / total questions)        → 20%
    """
    ch_score = ((credit_hours or 0) / max_credits * 10) if max_credits else 0
    mk_score = ((marks_dist or 0) / max_marks * 10) if max_marks else 0
    rq_score = (repeat_q_count / total_q_count * 10) if total_q_count else 0
    return round(min(0.40 * ch_score + 0.40 * mk_score + 0.20 * rq_score, 10), 2)


def _study_priority(score: float) -> str:
    if score >= 7.0: return "HIGH"
    elif score >= 4.0: return "MEDIUM"
    return "LOW"


def _estimate_study_hours(credit_hours, score: float) -> str:
    hours = round((credit_hours or 2) * 1.5 * (1 + (score / 10) * 0.5), 1)
    return f"{hours} hrs recommended"


def _build_exam_tips(repeat_questions, all_questions, important_topics, marks_dist, importance_score) -> list:
    """Build exam tips — now also considers total question count."""
    tips = []
    if importance_score >= 7.0:
        tips.append("High-weight chapter — allocate maximum study time.")
    if repeat_questions:
        tips.append(f"{len(repeat_questions)} question(s) repeated in past exams — prioritise these.")
    if len(all_questions) > 0 and not repeat_questions:
        tips.append(f"{len(all_questions)} unique question(s) found from past papers.")
    if marks_dist and marks_dist >= 14:
        tips.append("High marks allocation — expect long-answer questions.")
    elif marks_dist and marks_dist <= 7:
        tips.append("Lower marks allocation — likely short-answer or definition questions.")
    if important_topics:
        tips.append(f"Focus on: {', '.join(important_topics[:4])}.")
    if not all_questions:
        tips.append("No past paper questions mapped — study conceptually.")
    return tips


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def generate_report(subject_name: str, save: bool = True) -> dict:
    syllabus_path = _find_json_file(_subject_dir(SYLLABUS_JSON_DIR, subject_name))
    chapter_path  = _find_json_file(_subject_dir(CHAPTER_JSON_DIR, subject_name))
    question_path = _find_json_file(_subject_dir(QUESTION_JSON_DIR, subject_name))

    if not syllabus_path:
        raise FileNotFoundError(f"Syllabus JSON not found for '{subject_name}'")
    if not chapter_path:
        raise FileNotFoundError(f"Chapter JSON not found for '{subject_name}'")

    syllabus_data = _load_json(syllabus_path)
    chapter_data  = _load_json(chapter_path)
    question_data = _load_json(question_path) if question_path else []

    if isinstance(question_data, dict):
        question_data = question_data.get("questions", [])

    syllabus_chapters    = syllabus_data.get("chapters", [])
    total_credits        = syllabus_data.get("total_credit_hours") or sum(c.get("credit_hours", 0) for c in syllabus_chapters)
    total_marks_syllabus = syllabus_data.get("total_marks") or sum(c.get("marks_distribution", 0) for c in syllabus_chapters)

    max_credits = max((c.get("credit_hours") or 0) for c in syllabus_chapters) or 1
    max_marks   = max((c.get("marks_distribution") or 0) for c in syllabus_chapters) or 1

    syl_map = {str(c["chapter_id"]): c for c in syllabus_chapters}
    q_map   = _build_question_map(question_data)

    chapter_reports = []
    for ch in chapter_data:
        cid       = ch.get("chapter_id")
        cid_str   = str(cid)
        name      = ch.get("chapter_name", "").replace('\n', ' ').replace('\r', ' ').rstrip("]").strip()
        subtopics = ch.get("subtopics", [])
        important_topics = [s.get("subtopic_name", "") for s in subtopics if s.get("subtopic_name")]

        syl          = syl_map.get(cid_str, {})
        credit_hours = syl.get("credit_hours")
        marks_dist   = syl.get("marks_distribution")

        qinfo            = q_map.get(cid, q_map.get(int(cid_str) if cid_str.isdigit() else cid_str, {}))
        all_questions    = qinfo.get("all_questions", [])
        repeat_questions = qinfo.get("repeat_questions", [])
        max_marks_seen   = qinfo.get("max_marks_seen", 0)

        # Build FAQ from ALL questions, not just repeated ones
        faq = _build_faq_list(all_questions)

        importance_score = _compute_importance_score(
            credit_hours, marks_dist,
            max_credits, max_marks,
            len(repeat_questions), len(all_questions),
        )

        chapter_reports.append({
            "chapter_id":           cid,
            "chapter_name":         name,
            "credit_hours":         credit_hours,
            "marks_distribution":   marks_dist,
            "importance_score":     importance_score,
            "study_priority":       _study_priority(importance_score),
            "recommended_study":    _estimate_study_hours(credit_hours, importance_score),
            "important_topics":     important_topics,
            "total_subtopics":      len(subtopics),
            "total_past_questions": len(all_questions),
            "faq":                  faq,
            "faq_count":            len(faq),
            "max_marks_question":   max_marks_seen,
            "exam_tips":            _build_exam_tips(
                repeat_questions, all_questions,
                important_topics, marks_dist, importance_score
            ),
        })

    ranked_chapters = sorted(chapter_reports, key=lambda c: c["importance_score"], reverse=True)

    report = {
        "subject_name":         subject_name,
        "total_chapters":       len(chapter_reports),
        "total_credit_hours":   total_credits,
        "total_marks":          total_marks_syllabus,
        "total_past_questions": len(question_data),
        "generated_at":         _now_iso(),
        "study_priority_order": [
            {
                "chapter_id":       c["chapter_id"],
                "chapter_name":     c["chapter_name"],
                "importance_score": c["importance_score"],
                "study_priority":   c["study_priority"],
                "faq_count":        c["faq_count"],
            }
            for c in ranked_chapters
        ],
        "chapters": chapter_reports,
    }

    if save:
        out_dir = os.path.join(REPORTS_DIR, subject_name)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "report.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

    return report


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--subject", required=True)
    parser.add_argument("--no-save", action="store_true")
    args = parser.parse_args()
    report = generate_report(args.subject, save=not args.no_save)
    print(json.dumps(report if args.no_save else {
        "status": "ok",
        "subject": report["subject_name"],
        "chapters": report["total_chapters"],
        "top_priority": report["study_priority_order"][0]["chapter_name"] if report["study_priority_order"] else None,
    }, indent=2))