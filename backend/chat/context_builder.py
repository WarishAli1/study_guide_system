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

        for i, chunk in enumerate(chunks, 1):
            chapter_id = chunk.get("chapter_id", "?")
            chapter_name = chunk.get("chapter_name", "Unknown")
            subtopic_name = chunk.get("subtopic_name", "")
            content = chunk.get("content", "")

            # Truncate source_text for display (first 500 chars)
            source_text = content.strip()
            if len(source_text) > 500:
                source_text = source_text[:500].rsplit(" ", 1)[0] + "…"

            source_list.append({
                "index": i,
                "chapter_id": chapter_id,
                "chapter_name": chapter_name,
                "subtopic_id": chunk.get("subtopic_id", ""),
                "subtopic_name": subtopic_name,
                "source_text": source_text,
            })

            # Make the label very explicit so the LLM maps citations correctly
            parts.append(f"")
            parts.append(f"━━━ [Source {i}] ━━━")
            parts.append(f"Chapter: {chapter_id} – {chapter_name}")
            parts.append(f"Section: {subtopic_name}")
            parts.append(f"Content:")
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
based on their course notes and past papers.

CRITICAL CITATION RULES:
1. ONLY use information from the PROVIDED CONTEXT to answer. Do NOT hallucinate or invent information.
   If the topic is not present in the context, DO NOT answer it using general knowledge — treat it as unknown.
2. Each piece of context is labeled as [Source 1], [Source 2], etc. with its chapter and section clearly marked.
3. You MUST cite sources inline using [1], [2], etc. matching the EXACT source number where you found the information.
   - IMPORTANT: [1] means the information came from the content under "[Source 1]", [2] from "[Source 2]", etc.
   - Do NOT mix up source numbers. If you use information from [Source 3], cite it as [3], NOT [1] or [2].
   - Place the citation at the END of the sentence or clause that uses information from that source.
   - Example: "AI was coined by John McCarthy in 1956 [1]. There are several approaches to AI [3]."
   - You can cite multiple sources: "This concept involves reasoning and planning [1][3]."
   - Every factual claim MUST have at least one citation.
4. VERIFY your citations: Before writing [N], confirm that the fact you're citing actually appears in [Source N]'s content.

FORMATTING RULES:
1. Use proper Markdown formatting:
   - Use ## for section headings, ### for subsection headings
   - Use **bold** for key terms and important concepts
   - Use bullet points (- ) and numbered lists (1. ) to organize information
   - Use `inline code` for technical terms, formulas variable names etc.
   - Use code blocks with language tags for code/algorithms
2. For mathematical expressions:
   - Use $...$ for inline math (e.g., $E = mc^2$)
   - Use $$...$$ for display/block math equations
   - Use proper LaTeX notation for all mathematical formulas
3. If a related past exam question is shown in context, mention it (e.g., "This topic was asked in 2081 Ashwin for 10 marks").
4. If the context does NOT contain information relevant to the question, respond with ONLY:
   "The provided context does not contain information about [topic]. This topic may not be covered in your course notes."
   Do NOT provide any general knowledge, background information, or partial answers about the topic.
   Do NOT mention related topics from the context unless the user explicitly asked about them.
   Stop your response there — do not continue with other content.
5. Keep answers concise but complete. Aim for exam-ready answers.
6. Do NOT restate the question. Do NOT list sources at the end — only cite inline.
"""