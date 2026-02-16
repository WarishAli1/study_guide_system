import os
import re
import json
import time
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from collections import Counter

from config import Config
from openai import OpenAI

client = OpenAI(
    api_key=Config.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

_keybert_model = None
MODEL_NAME = Config.MODEL_NAME
CLEAN_PROMPT = Config.CHAPTER_CLEAN_PROMPT

HEADER_PATTERNS = [
    r"page\s*\d+", r"download(ed)?\s+from.*", r"copyright.*",
    r"all rights reserved.*", r"author[:\-].*", r"written\s+by",
    r"prof\.\s+[a-z\s]+", r"dr\.\s+[a-z\s]+", r"www\.\S+",
    r"http\S+", r"https\S+", r"\*{3,}", r"^\s*\d+\s*$",
    r"table\s+of\s+contents", r"index\s*$", r"references\s*$",
    r"bibliography\s*$", r"prepared\s+by", r"lecture\s+notes",
    r"©", r"®", r"™", r"isbn", r"edition", r"published\s+by",
    r"printing", r"^\s*[-_=]{3,}\s*$",
]

def remove_blank_lines(text: str) -> str:
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)

def remove_headers_and_footers(text: str) -> str:
    cleaned = []
    for line in text.split("\n"):
        s = line.strip()
        if not s:
            continue
        if any(re.search(p, s, re.IGNORECASE) for p in HEADER_PATTERNS):
            continue
        if len(s) <= 3 and s.isdigit():
            continue
        cleaned.append(s)
    return "\n".join(cleaned)

def fix_common_ocr_errors(text: str) -> str:
    text = re.sub(r"[zZ]0?(\d{2})", r"20\1", text)
    text = re.sub(r"2O(\d{2})", r"20\1", text)
    text = re.sub(r"(?<=\d)[lI](?=\d)", "1", text)
    text = re.sub(r"(?<=\d)[Oo](?=\d)", "0", text)
    replacements = {
        "pey": "pay", "trros": "taxes", "texeg": "taxes",
        "erpldr": "explain", "coniunctive": "conjunctive",
        "dlfrerent": "different", "MeCulloch": "McCulloch", "Pittg": "Pitts",
    }
    for wrong, correct in replacements.items():
        text = re.sub(rf"\b{re.escape(wrong)}\b", correct, text, flags=re.IGNORECASE)
    return text

def normalize_whitespace(text: str) -> str:
    text = re.sub(r" +", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def pre_clean_text(text: str) -> str:
    text = remove_blank_lines(text)
    text = remove_headers_and_footers(text)
    text = fix_common_ocr_errors(text)
    text = normalize_whitespace(text)
    return text

def extract_chapter_from_filename(filepath: str) -> Tuple[int, str]:
    basename = os.path.basename(filepath)
    patterns = [
        r"[Cc]hapter[_\s]*(\d+)[_\s]*(.+?)(?:_\d+)?\.(?:pdf|txt)",
        r"[Cc]h[_\s]*(\d+)[_\s]*(.+?)(?:_\d+)?\.(?:pdf|txt)",
        r"[Uu]nit[_\s]*(\d+)[_\s]*(.+?)(?:_\d+)?\.(?:pdf|txt)",
    ]
    for pattern in patterns:
        match = re.search(pattern, basename)
        if match:
            num = int(match.group(1))
            name = match.group(2).replace("_", " ").strip()
            name = re.sub(r"\s+\d+$", "", name)
            return num, name
    return 1, "Untitled"

def detect_primary_structure(text: str) -> Tuple[str, Dict]:
    chapter_matches = list(re.finditer(r"\b(chapter)\s+(\d+)", text, re.I))
    unit_matches    = list(re.finditer(r"\b(unit)\s+(\d+)", text, re.I))
    chapter_numbers = set(int(m.group(2)) for m in chapter_matches)
    unit_numbers    = set(int(m.group(2)) for m in unit_matches)
    stats = {
        "chapter_total": len(chapter_matches), "unit_total": len(unit_matches),
        "chapter_unique": len(chapter_numbers), "unit_unique": len(unit_numbers),
    }
    if len(unit_matches) > len(chapter_matches) and len(unit_numbers) >= len(chapter_numbers):
        return "unit", stats
    return "chapter", stats

def detect_watermarks(text: str, structure: str) -> set:
    pattern = rf"({structure}\s+\d+[:\-]?\s*[^\n]{{0,100}})"
    matches = re.findall(pattern, text, re.I)
    return {h.strip() for h, count in Counter(matches).items() if count >= 5}

def detect_chapter_boundaries(text: str, structure: str, watermarks: set) -> List[Tuple[int, str]]:
    pattern = rf"({structure}\s+\d+[:\-]?\s*[^\n]{{0,100}})"
    filtered = []
    for m in re.finditer(pattern, text, re.I):
        heading = m.group().strip()
        if heading in watermarks:
            continue
        if any(heading.lower() in wm.lower() or wm.lower() in heading.lower() for wm in watermarks):
            continue
        filtered.append((m.start(), heading))
    return sorted(filtered, key=lambda x: x[0])

def split_into_chapters(text: str, source_filepath: Optional[str] = None) -> List[Dict]:
    structure, stats = detect_primary_structure(text)
    watermarks       = detect_watermarks(text, structure)
    boundaries       = detect_chapter_boundaries(text, structure, watermarks)
    if not boundaries:
        if source_filepath:
            chapter_num, chapter_name = extract_chapter_from_filename(source_filepath)
            return [{"title": f"Chapter {chapter_num}: {chapter_name}", "content": text}]
        return [{"title": "Chapter 1: Untitled", "content": text}]
    chapters = []
    for i, (pos, title) in enumerate(boundaries):
        end     = boundaries[i + 1][0] if i + 1 < len(boundaries) else len(text)
        content = text[pos:end].strip()
        lines   = content.split("\n", 1)
        if len(lines) > 1:
            content = lines[1].strip()
        chapters.append({"title": title, "content": content})
    return chapters

def clean_chapter_with_llm(chapter_text: str, chapter_title: str) -> str:
    max_retries    = 5
    base_delay     = 5
    estimated_tokens = int(len(chapter_text.split()) * 1.3)
    max_output     = min(max(800, estimated_tokens), 3000)
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": CLEAN_PROMPT},
                    {"role": "user", "content": f"Clean this chapter:\n\n{chapter_title}\n\n{chapter_text}"}
                ],
                temperature=0, top_p=0.9, max_tokens=max_output
            )
            time.sleep(base_delay)
            return response.choices[0].message.content.strip()
        except Exception as e:
            err_msg = str(e).lower()
            if "429" in err_msg or "rate limit" in err_msg:
                wait_time = base_delay * (2 ** attempt)
                print(f"[Rate Limit] Waiting {wait_time}s...")
                time.sleep(wait_time)
            elif "402" in err_msg or "quota" in err_msg:
                raise RuntimeError("API quota exceeded (402).")
            else:
                print(f"Request failed: {e}")
                if attempt >= max_retries - 1:
                    return chapter_text
                time.sleep(2 ** attempt)
    return chapter_text

def parse_chapter_info(title_line: str) -> Tuple[int, str]:
    match = re.search(r"(chapter|unit)\s+(\d+)", title_line, re.I)
    if match:
        return int(match.group(2)), title_line.strip()
    return 1, title_line.strip()

def save_cleaned_chapters(subject_name: str, chapters_data: List[Dict]) -> str:
    subject_slug = re.sub(r"[^\w]+", "_", subject_name.lower())
    output_dir   = os.path.join(Config.CLEANED_TEXT_DIR, subject_slug, "notes")
    os.makedirs(output_dir, exist_ok=True)
    for chapter in chapters_data:
        chapter_id = chapter["chapter_id"]
        safe_name  = re.sub(r"[^\w]+", "_", chapter["chapter_name"].lower())
        filename   = f"chapter_{chapter_id:02d}_{safe_name}.txt"
        filepath   = os.path.join(output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"{chapter['chapter_name']}\n")
            f.write("=" * len(chapter['chapter_name']) + "\n\n")
            f.write(chapter["formatted_text"])
        print(f"  ✓ Saved: {filename}")
    return output_dir

def get_subject_slug(subject: str) -> str:
    return re.sub(r"[^\w]+", "_", subject.lower())


# ─── KeyBERT ──────────────────────────────────────────────────────────────────

def _get_keybert():
    global _keybert_model
    if _keybert_model is None:
        try:
            from keybert import KeyBERT
            _keybert_model = KeyBERT(model="all-MiniLM-L6-v2")
            print("[KeyBERT] Model loaded.")
        except ImportError:
            raise ImportError("Run: pip install keybert sentence-transformers")
    return _keybert_model

def extract_keywords(
    text: str,
    top_n: int = 15,
    ngram_range: Tuple[int, int] = (1, 2),
    diversity: float = 0.5,
) -> List[str]:
    if not text or not text.strip():
        return []
    results = _get_keybert().extract_keywords(
        text,
        keyphrase_ngram_range=ngram_range,
        stop_words="english",
        use_mmr=True,
        diversity=diversity,
        top_n=top_n,
    )
    return [kw.lower() for kw, _ in results]


# ─── FIX 1: weight subtopic name + truncate paragraph ────────────────────────

def _subtopic_keywords(subtopic_name: str, paragraph: str) -> List[str]:
    weighted = f"{subtopic_name} {subtopic_name} {subtopic_name} {paragraph[:800]}"
    return extract_keywords(weighted, top_n=15, ngram_range=(1, 2))


# ─── FIX 2: single combined pass for chapter keywords ────────────────────────

def _chapter_keywords(subtopics: List[Dict]) -> List[str]:
    combined = " ".join(
        f"{s.get('subtopic_name', '')} {s.get('paragraph', '')[:400]}"
        for s in subtopics
    )
    return extract_keywords(combined, top_n=15, ngram_range=(1, 2))


def _parse_topics_with_prefix(text: str, prefix: int) -> Dict[str, str]:
    topics: Dict[str, str] = {}
    current_topic: Optional[str] = None
    current_content: List[str] = []
    for line in text.split("\n"):
        match = re.match(rf"{prefix}\.(\d+)\s+(.+)", line.strip())
        if match:
            if current_topic:
                topics[current_topic] = "\n".join(current_content).strip()
            current_topic   = f"{prefix}.{match.group(1)} {match.group(2).strip()}"
            current_content = []
        else:
            if current_topic:
                current_content.append(line)
    if current_topic and current_content:
        topics[current_topic] = "\n".join(current_content).strip()
    return topics

def extract_topics_from_text(text: str, chapter_id: int) -> Dict[str, str]:
    topics = _parse_topics_with_prefix(text, chapter_id)
    if topics:
        return topics
    candidates = [int(m.group(1)) for m in re.finditer(r"(\d+)\.(\d+)\s+\S", text)]
    if not candidates:
        return {}
    for prefix in sorted(set(candidates)):
        topics = _parse_topics_with_prefix(text, prefix)
        if topics:
            normalized: Dict[str, str] = {}
            for key, val in topics.items():
                parts    = key.split(" ", 1)
                sub_num  = parts[0].split(".")[1]
                title    = parts[1] if len(parts) > 1 else key
                normalized[f"{chapter_id}.{sub_num} {title}"] = val
            return normalized
    return {}

def _subtopic_sort_key(subtopic_id: str) -> List[int]:
    try:
        return [int(x) for x in subtopic_id.split(".")]
    except ValueError:
        return [0]

def _topics_to_subtopic_list(topics: Dict[str, str], chapter_id: int) -> List[Dict]:
    result = []
    for key, paragraph in topics.items():
        m             = re.match(r"(\d+\.\d+)\s+(.*)", key.strip())
        subtopic_id   = m.group(1) if m else f"{chapter_id}.1"
        subtopic_name = m.group(2).strip() if m else key.strip()
        result.append({
            "subtopic_id":   subtopic_id,
            "subtopic_name": subtopic_name,
            "keywords":      _subtopic_keywords(subtopic_name, paragraph),
            "paragraph":     paragraph.strip(),
        })
    result.sort(key=lambda s: _subtopic_sort_key(s["subtopic_id"]))
    return result


def _load_subject_json(json_path: str) -> List[Dict]:
    if not os.path.exists(json_path):
        return []
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        return [data]
    return data if isinstance(data, list) else []

def _save_subject_json(json_path: str, chapters: List[Dict]) -> None:
    chapters_sorted = sorted(chapters, key=lambda c: c["chapter_id"])
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(chapters_sorted, f, indent=2, ensure_ascii=False)
    print(f"  ✓ JSON saved → {json_path}")

def build_chapter_json(subject_name: str, chapters_data: List[Dict]) -> str:
    subject_folder = os.path.join(Config.CHAPTER_JSON_DIR, subject_name)
    os.makedirs(subject_folder, exist_ok=True)

    subject_slug = get_subject_slug(subject_name)
    notes_dir    = os.path.join(Config.CLEANED_TEXT_DIR, subject_slug, "notes")
    save_path    = os.path.join(subject_folder, f"{subject_name}_chapters.json")

    existing_chapters = _load_subject_json(save_path)
    incoming_ids      = {c["chapter_id"] for c in chapters_data}
    kept_chapters     = [c for c in existing_chapters if c["chapter_id"] not in incoming_ids]
    dropped           = len(existing_chapters) - len(kept_chapters)
    if dropped:
        print(f"  Removed {dropped} existing chapter(s) for fresh rebuild.")

    new_entries: List[Dict] = []

    for chapter in chapters_data:
        chapter_id   = chapter["chapter_id"]
        chapter_name = chapter["chapter_name"]

        safe_name = re.sub(r"[^\w]+", "_", chapter_name.lower())
        txt_path  = os.path.join(notes_dir, f"chapter_{chapter_id:02d}_{safe_name}.txt")

        topics = _read_topics_from_txt(txt_path, chapter_id)
        if not topics:
            topics = extract_topics_from_text(chapter.get("formatted_text", ""), chapter_id)
        if not topics:
            topics = {f"{chapter_id}.1 Content": chapter.get("formatted_text", "")}

        print(f"\n  Chapter {chapter_id}: {chapter_name}  |  topics: {len(topics)}")

        subtopics = _topics_to_subtopic_list(topics, chapter_id)

        new_entries.append({
            "chapter_id":   chapter_id,
            "chapter_name": chapter_name,
            "keywords":     _chapter_keywords(subtopics),
            "subtopics":    subtopics,
            "timestamp":    datetime.now().isoformat(),
        })
        print(f"  ✚ Chapter {chapter_id} built fresh.")

    final_chapters = kept_chapters + new_entries
    _save_subject_json(save_path, final_chapters)
    print(f"\n  ✓ Total chapters in JSON: {len(final_chapters)}")
    return save_path

def _read_topics_from_txt(filepath: str, chapter_id: int) -> Dict[str, str]:
    if not os.path.exists(filepath):
        return {}
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    lines         = content.split("\n")
    separator_idx = next((i for i, l in enumerate(lines) if re.match(r"^=+$", l.strip())), -1)
    body          = "\n".join(lines[separator_idx + 1:]).strip() if separator_idx >= 0 else content
    return extract_topics_from_text(body, chapter_id)

def process_and_save_chapter(subject_name: str, file_path: str):
    if file_path.lower().endswith('.pdf'):
        try:
            import pdfplumber
            raw_text = ""
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        raw_text += text + "\n"
        except ImportError:
            print("ERROR: pip install pdfplumber")
            return []
    else:
        with open(file_path, "r", encoding="utf-8") as f:
            raw_text = f.read()

    cleaned_text   = pre_clean_text(raw_text)
    chapters       = split_into_chapters(cleaned_text, source_filepath=file_path)
    final_chapters = []

    for chapter in chapters:
        cleaned_content      = clean_chapter_with_llm(chapter["content"], chapter["title"])
        chapter_id, chapter_name = parse_chapter_info(chapter["title"])
        final_chapters.append({
            "chapter_id":     chapter_id,
            "chapter_name":   chapter_name,
            "formatted_text": cleaned_content,
            "timestamp":      datetime.now().isoformat()
        })

    save_cleaned_chapters(subject_name, final_chapters)
    build_chapter_json(subject_name, final_chapters)
    return final_chapters

if __name__ == "__main__":
    subject  = "AI"
    pdf_path = "/mnt/user-data/uploads/Chapter1_Artificial_Intelligence_1680197760558.pdf"
    process_and_save_chapter(subject, pdf_path)