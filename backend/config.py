"""
Configuration file for the study assistant application
"""

import os
import json
from pathlib import Path
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

# Root of the entire project (one level above backend/)
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)


class Config:
    # ── Auth ──────────────────────────────────────────────
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key")

    # ── Database ──────────────────────────────────────────
    DB_PATH = os.path.join(_BACKEND_DIR, "database.db")

    # ── Directory layout ──────────────────────────────────
    # datasets/ lives at the project root, next to backend/
    DATASETS_DIR = os.path.join(_PROJECT_ROOT, "datasets")
    UPLOAD_DIR = os.path.join(DATASETS_DIR, "uploads")        # original files
    RAW_TEXT_DIR = os.path.join(DATASETS_DIR, "raw_text")      # extracted .txt
    CHAPTER_JSON_DIR = os.path.join(DATASETS_DIR, "chapter_json")
    QUESTION_JSON_DIR = os.path.join(DATASETS_DIR, "question_json")
    SYLLABUS_JSON_DIR = os.path.join(DATASETS_DIR, "syllabus_json")
    CLEANED_TEXT_DIR = os.path.join(DATASETS_DIR, "cleaned_text")

    REPORTS_DIR = os.path.join(DATASETS_DIR, "reports")  # final reports
    # ── OCR ───────────────────────────────────────────────
    # If tesseract is not on PATH, set the full path here:
    TESSERACT_CMD = os.getenv("TESSERACT_CMD", None)

    # DPI used when rendering scanned PDF pages for OCR.
    # 300 is a good balance between quality and speed.
    OCR_DPI = int(os.getenv("OCR_DPI", "300"))

    MODEL_NAME = os.getenv("MODEL_NAME", "meta-llama/llama-4-scout-17b-16e-instruct")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", None)
    QUESTION_CLEAN_PROMPT = """
    You are a text formatting engine tasked with cleaning OCR-extracted university exam question papers. STRICTLY FOLLOW THESE INSTRUCTIONS — DO NOT DEVIATE:

1. Keep ONLY:
   - Correct year with month (e.g., 2064 Jestha) for every section in the text
   - All questions under each year
   - Question numbers exactly as written (1., 2., 3., ...)
   - Marks if present (e.g., [10], (10), Full Marks: 60)

2. DO NOT:
   - Remove any question
   - Summarize or shorten questions
   - Merge multiple questions into one
   - Rewrite, reword, or paraphrase questions
   - Add any new content
   - Answer the questions
   - Explain anything

3. Remove completely:
   - University name
   - Institute name
   - Examination control division
   - Candidate instructions
   - Page numbers
   - Header/footer metadata
   - Random symbols (*, -, _, etc.)

4. Ensure formatting:
   - Each question must strictly start with its number (1., 2., 3., …)
   - Maintain clear separation between different years
   - Preserve all marks exactly as they appear
   - Preserve the order of questions under each year

5. Output requirements:
   - Output ONLY the cleaned, structured text
   - Do NOT include any notes, comments, or explanations
   - Treat the whole document as a single context; do not split into parts

You are NOT an AI assistant. You are ONLY a text formatting engine. DO NOT write anything except the cleaned paper.
    """

    CHAPTER_CLEAN_PROMPT = """
You are an OCR cleaning and formatting engine.

STRICT RULES:
1. DO NOT summarize or remove any content.
2. DO NOT remove technical terms, formulas, or diagrams.
3. ONLY fix OCR spelling errors and broken symbols (e.g., 'hlgh' -> 'high', 'comp\xfcter' -> 'computer').
4. Remove random garbage characters and OCR noise.
5. Preserve ALL original meaning and technical content.
6. DO NOT invent topics or headings that don't exist.
7. If the text has clear subtopics/headings, format them strictly as numbered sections:
   - For Chapter 1: use 1.1, 1.2, 1.3, etc.
   - For Chapter 2: use 2.1, 2.2, 2.3, etc.
   - For Unit 1: use 1.1, 1.2, 1.3, etc.
   - For Unit 2: use 2.1, 2.2, 2.3, etc.
   - DO NOT use any symbols like #, ##, *, -, or other Markdown headings. Only numbers followed by a single space and the topic title.
8. If NO subtopics/headings exist in the original, just format paragraphs cleanly without inventing topics.
9. Maintain the chapter/unit number and name exactly as given.
10. Fix common OCR errors:
    - Broken symbols: → (arrow), ≠ (not equal), ≤ (less than or equal)
    - Spelling mistakes from OCR
    - Merged words or broken words
11. STRICT CHAPTER BOUNDARY DETECTION:
    - Detect EVERY occurrence of "Chapter <number>" or "Unit <number>" in the text.
    - NEVER merge two different chapters or units into one.
    - If multiple chapters exist in the input, output ALL of them separately.
    - Even if the OCR formatting is broken, identify chapter numbers carefully and separate them correctly.
    - If Chapter 5 and Chapter 6 both exist in the text, they MUST appear as:
        Chapter 5: <Title>
        ...
        Chapter 6: <Title>
        ...
    - It is STRICTLY FORBIDDEN to combine two chapter numbers under one heading.
12. PRESERVE ORIGINAL CHAPTER COUNT:
    - If 7 chapters exist in the input, the output MUST contain 7 chapters.
    - Do NOT drop, merge, or skip any chapter or unit.
    - If a new chapter heading appears anywhere in the text, immediately close the previous chapter and start a new one.
13. DETECT OCR-BROKEN CHAPTER HEADINGS:
    - Correct OCR errors in chapter headings (e.g., "Chaptcr 3" → "Chapter 3").
    - If spacing is broken (e.g., "Chapter3"), fix it to "Chapter 3".
    - If Roman numerals are used (e.g., "Chapter IV"), preserve the numbering style exactly as given.
14. NEVER INFER OR GUESS MISSING CHAPTERS:
    - Only output chapters that actually appear in the input.
    - Do NOT invent missing chapter numbers.
    - Do NOT renumber chapters.

OUTPUT FORMAT:

Chapter <number>: <Clean Chapter Title>

[If topics exist:]
<number>.1 <Topic Title>
<Clean paragraph content>

<number>.2 <Topic Title>
<Clean paragraph content>

[If NO topics exist, just format paragraphs cleanly]

IMPORTANT:
- ALL headings MUST start with numbers as shown (1.1, 1.2, 2.1, etc.).
- DO NOT use symbols like #, ##, **, *, or any other formatting for headings.
- Return ONLY the formatted content. NO explanations or notes.
"""
    SYLLABUS_CLEAN_PROMPT = """
Clean the following OCR-extracted university syllabus text.

Rules:

1. Do NOT summarize.
2. Do NOT remove any chapter or unit content.
3. Do NOT rewrite or paraphrase.
4. Only fix OCR spelling mistakes and remove garbage characters.
5. Preserve chapter/unit numbers exactly as written.
6. Preserve credit hours and marks exactly as written.
7. If syllabus is in table form, convert it into this format:

Chapter 1: Introduction
Credit Hours: 4
Marks Distribution: 7

Chapter 2: Data Structures
Credit Hours: 5
Marks Distribution: 10

8. If "Unit" is used instead of Chapter, keep "Unit".
9. If a Total row exists, keep it like this:

Total Credit Hours: 45
Total Marks: 100

Remove completely:

- All headers and footers
- University name
- Institute name
- Faculty name
- Page numbers
- Examination board information
- Metadata lines such as:
  "Lecture:"
  "Tutorial:"
  "Practical:"
  "Course Objectives"
  "Objectives"
  "References"
  "Reference"
  Any similar non-chapter metadata section

Output only the cleaned syllabus text.
No explanations.
No JSON.
No extra formatting.
"""
    DATASET_PROMPT = """You are an expert academic answer writer for university exam papers.

Rules:
1. ONLY use information present in the provided CONTEXT. Do NOT hallucinate.
2. Structure your answer according to the MARKS GUIDE given.
3. Begin with "Definition:" or the core concept, then expand.
4. Use clear numbered/bulleted sections for multi-point answers.
5. Keep the answer concise yet complete — no padding, no repetition.
6. Do NOT restate the question in your answer.
7. If the context does not contain enough information, say "Based on available notes:" and answer from what is given.
"""

    MARKS_GUIDE = {
    (1, 2):  "Give a single concise definition or one-line fact.",
    (3, 5):  "Give a Definition, followed by 2-3 key points or a short explanation.",
    (6, 8):  "Structure as: Definition → Explanation → Key Points (bulleted) → Brief Example.",
    (9, 99): "Structure as: Definition → Detailed Explanation → Key Points → Example → Diagram description if applicable → Summary.",
}
    DEBUG = True

