import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


def build_context(
    chunks: List[Dict],
    related_questions: List[Dict],
    subject_name: str,
    syllabus_data: Optional[Dict] = None,
) -> tuple[str, List[Dict]]:
    """
    Assemble retrieved information into a structured context string.

    Returns
    -------
    tuple of (context_string, source_list)
        source_list is a numbered list of sources the LLM should cite as [1], [2], etc.
        Each source includes the actual text snippet for frontend display.
    """
    parts = []
    source_list = []

    parts.append(f"SUBJECT: {subject_name}")
    parts.append("")

    if chunks:
        parts.append("=" * 60)
        parts.append("RELEVANT NOTES CONTENT (with source numbers for citation):")
        parts.append("=" * 60)

        # Group chunks by chapter for clearer organization
        from collections import OrderedDict
        chapter_groups = OrderedDict()
        for i, chunk in enumerate(chunks, 1):
            ch_key = f"{chunk.get('chapter_id', '?')}"
            if ch_key not in chapter_groups:
                chapter_groups[ch_key] = []
            chapter_groups[ch_key].append((i, chunk))

        for ch_key, ch_chunks in chapter_groups.items():
            ch_name = ch_chunks[0][1].get("chapter_name", "Unknown")
            parts.append(f"\n{'─' * 40}")
            parts.append(f"CHAPTER {ch_key}: {ch_name}")
            parts.append(f"{'─' * 40}")

            for i, chunk in ch_chunks:
                subtopic_name = chunk.get("subtopic_name", "")
                content = chunk.get("content", "")

                source_text = content.strip()
                if len(source_text) > 500:
                    source_text = source_text[:500].rsplit(" ", 1)[0] + "…"

                source_list.append({
                    "index": i,
                    "chapter_id": chunk.get("chapter_id", "?"),
                    "chapter_name": ch_name,
                    "subtopic_id": chunk.get("subtopic_id", ""),
                    "subtopic_name": subtopic_name,
                    "source_text": source_text,
                })

                parts.append(f"")
                parts.append(f"━━━ [Source {i}] Section: {subtopic_name} ━━━")
                parts.append(content)
                parts.append(f"━━━ [End Source {i}] ━━━")
                parts.append("")
    else:
        parts.append("No relevant notes content found for this query.")
        parts.append("")

    if related_questions:
        parts.append("=" * 60)
        parts.append("RELATED PAST EXAM QUESTIONS:")
        parts.append("=" * 60)

        for i, q in enumerate(related_questions, 1):
            question_text = q.get("question", "")
            freq = q.get("freq", 1)
            years = q.get("years", [])
            marks = [m for m in q.get("marks", []) if m is not None]

            parts.append(f"\n{i}. {question_text}")
            meta_parts = []
            if freq > 1:
                meta_parts.append(f"Repeated {freq} times")
            if years:
                meta_parts.append(f"Years: {', '.join(str(y) for y in years)}")
            if marks:
                meta_parts.append(f"Marks: {', '.join(str(m) for m in marks)}")
            if meta_parts:
                parts.append(f"   ({'; '.join(meta_parts)})")
        parts.append("")

    if syllabus_data and syllabus_data.get("chapters"):
        relevant_chapter_ids = set()
        for chunk in chunks:
            relevant_chapter_ids.add(str(chunk.get("chapter_id", "")))

        relevant_syllabus = []
        for ch in syllabus_data.get("chapters", []):
            if str(ch.get("chapter_id", "")) in relevant_chapter_ids:
                relevant_syllabus.append(ch)

        if relevant_syllabus:
            parts.append("=" * 60)
            parts.append("SYLLABUS INFO FOR RELEVANT CHAPTERS:")
            parts.append("=" * 60)
            for ch in relevant_syllabus:
                ch_name = ch.get("chapter_name", "")
                credit = ch.get("credit_hours")
                marks = ch.get("marks_distribution")
                info = f"Chapter {ch.get('chapter_id', '?')}: {ch_name}"
                if credit:
                    info += f" | Credit Hours: {credit}"
                if marks:
                    info += f" | Marks: {marks}"
                parts.append(info)
            parts.append("")

    return "\n".join(parts), source_list


def build_system_prompt(subject_name: str) -> str:
    """Build the system prompt for the chat LLM."""
    return f"""You are an expert academic tutor for the subject "{subject_name}".
You help students prepare for university exams by answering their questions
based STRICTLY on their course notes and past papers provided in the context.

ABSOLUTE RULES — NEVER VIOLATE:
1. You may ONLY use information that appears in the PROVIDED CONTEXT below.
2. If the context does NOT contain information to answer the question, respond EXACTLY with:
   "I don't have information about this topic in your uploaded notes. The topic may be covered in a chapter that hasn't been uploaded yet. Please check your documents or upload additional notes covering this topic."
   DO NOT attempt to answer from your own knowledge. DO NOT provide partial answers. DO NOT guess.
3. If the context contains only tangentially related information (e.g., the question asks about topic X but the context only mentions X in passing without explaining it), say:
   "Your notes mention this topic briefly but don't contain enough detail to provide a complete answer. The relevant section appears to be in [chapter name]. You may want to review your full notes for this topic."

CITATION RULES:
4. You MUST cite sources inline using [1], [2], etc. matching the EXACT source number.
   - [1] = information from [Source 1], [2] = from [Source 2], etc.
   - Place citation at END of the sentence using that information.
   - Every factual claim MUST have a citation.
   - VERIFY: before writing [N], confirm the fact is actually in [Source N].
5. Do NOT list sources at the end. Only cite inline.

FORMATTING:
6. Use ## for headings, **bold** for key terms, bullet points for lists.
7. Use $...$ for inline math, $$...$$ for block math, LaTeX notation.
8. Use `inline code` for technical terms, code blocks for algorithms.
9. If a related past exam question is shown, mention it.
10. Keep answers concise but complete. Aim for exam-ready answers.
11. Do NOT restate the question.
"""