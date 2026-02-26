import os
import re
import json
import time
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sentence_transformers import SentenceTransformer, util
from config import Config
import torch
from openai import OpenAI

CHAPTER_ASSIGNMENT_CONFIDENCE = 0.25

client = OpenAI(
    api_key=Config.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)
MODEL_NAME = Config.MODEL_NAME
device = 'cuda' if torch.cuda.is_available() else 'cpu'

CLEAN_PROMPT = Config.QUESTION_CLEAN_PROMPT


def fix_common_ocr_errors(text: str) -> str:
    text = text.replace("\\n", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s+\n", "\n\n", text)
    text = re.sub(r"[zZ]0?(\d{2})", r"20\1", text)
    text = re.sub(r"2O(\d{2})", r"20\1", text)
    text = re.sub(r"20G(\d)", r"206\1", text)
    text = re.sub(r"206\s+(\d)", r"206\1", text)
    text = re.sub(r"207\s+(\d)", r"207\1", text)
    text = re.sub(r"(?<=\d)[lI](?=\d)", "1", text)
    text = re.sub(r"(?<=\d)[Oo](?=\d)", "0", text)
    replacements = {
        "pey": "pay", "trros": "taxes", "texeg": "taxes",
        "erpldr": "explain", "coniunctive": "conjunctive",
        "dlfrerent": "different", "MeCulloch": "McCulloch", "Pittg": "Pitts"
    }
    for wrong, correct in replacements.items():
        text = re.sub(rf"\b{wrong}\b", correct, text, flags=re.IGNORECASE)
    
    text = normalize_brackets(text)
    return text

HEADER_PATTERNS = [
    r"TRIBHUVAN\s+UNIVERSITY",r"INSTITUTE\s+OF\s+ENGINEERING",r"Examination\s+Control\s+Division",
    r"^Exam\.",r"^Level\b",r"Programme",r"Full\s+Marks",r"Pass\s+Marks",r"Year\s*/?\s*Part",r"^Time\b",
    r"Candidates\s+are\s+required",r"Attempt\s+[Aa]ll",r"figures\s+in\s+the\s+margin",r"Assume\s+suitable\s+data",
    r"Subject\s*[:\-]+\s*.{3,80}\(.*?\)",
    r"^\*+$",r"^\d+$",r"^\s*-{3,}\s*$",r"^\s*={3,}\s*$",
]

def clean_question_text(q: str) -> str:
    if not q:
        return q
    q = re.sub(r'\s*°[^\n]*', ' ', q)
    q = re.sub(r'(\[\d[\d\+\×xX]*\])\s+[A-Z]{2,8}\b', r'\1', q)
    q = re.sub(r'\b[A-Z]{2,3}\s*\d{3}\b', '', q)
    q = re.sub(r'Subject\s*[:\-]+[^\n]*', '', q, flags=re.IGNORECASE)
    q = re.sub(r'\s{2,}', ' ', q)
    return q.strip()

def extract_marks(q_text: str):
    if not q_text:
        return None

    matches = re.findall(r'\[(\d[\d\+\×xX\s]*)\]', q_text)
    if not matches:
        return None

    match = matches[-1].strip()
    if re.search(r'[×xX]', match):
        parts = re.split(r'[×xX]', match)
        nums = [int(p.strip()) for p in parts if p.strip().isdigit()]
        if len(nums) == 2:
            return nums[0] * nums[1]
        return sum(nums) if nums else None
    if '+' in match:
        parts = match.split('+')
        nums = [int(p.strip()) for p in parts if p.strip().isdigit()]
        return sum(nums) if nums else None
    if match.isdigit():
        return int(match)
    return None

def remove_headers(text: str) -> str:
    lines = text.split("\n")
    cleaned_lines = [
        line.strip() for line in lines
        if not any(re.search(p, line, re.IGNORECASE) for p in HEADER_PATTERNS)
    ]
    return "\n".join(cleaned_lines)

def normalize_brackets(text: str) -> str:
    def _fix(m):
        return f"[{m.group(1)}]"

    return re.sub(
        r'[\[\{\(\|]'           # any opening: [ { ( |
        r'(\d[\d\+\×xX\*\s]*)' # digits with operators
        r'[\]\}\)\|]',          # any closing: ] } ) |
        _fix,
        text
    )

def split_by_year(text: str):
    text = re.sub(r'(20[5-9]\d)\s*\n\s*([A-Za-z]{3,})', r'\1 \2', text)
    text = re.sub(r'(20[5-9]\d)([A-Z][a-z]{2,})', r'\1 \2', text)
    year_pattern = r"(20[5-9]\d\s+[A-Za-z]{3,})"
    parts = re.split(year_pattern, text)

    sections = []
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            year    = re.sub(r'\s+', ' ', parts[i].strip())
            content = parts[i + 1].strip() if i + 1 < len(parts) else ""
            sections.append(f"{year}\n{content}")
    return sections

def clean_with_llm(year_text: str) -> str:
    max_retries = 5
    base_delay = 5
    estimated_tokens = int(len(year_text.split()) * 1.3)
    max_output = min(max(800, estimated_tokens), 2000)
    for attempt in range(max_retries):
        try:
            response = client.responses.create(
                model=MODEL_NAME,
                input=f"{CLEAN_PROMPT}\n\n{year_text}",
                temperature=0, top_p=0.9, max_output_tokens=max_output
            )
            time.sleep(base_delay)
            return response.output_text.strip()
        except Exception as e:
            err_msg = str(e).lower()
            if "429" in err_msg or "rate limit" in err_msg:
                wait_time = base_delay * (2 ** attempt)
                print(f"[Rate Limit] Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
            elif "402" in err_msg or "quota" in err_msg:
                raise RuntimeError("API quota exceeded (402). Wait for reset.")
            else:
                print(f"Request failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    return year_text
    return year_text


def extract_questions(cleaned_text):
    questions, years, marks = [], [], []

    year_sections = re.split(r"(20[5-9]\d\s+[A-Za-z]{3,})", cleaned_text)
    if len(year_sections) < 2:
        return [], [], []

    for i in range(1, len(year_sections), 2):
        year    = re.sub(r'\s+', ' ', year_sections[i].strip())
        section = year_sections[i + 1].strip()
        lines   = section.split("\n")

        q_text = ""
        for line in lines:
            stripped = line.strip()
            is_new_question = bool(re.match(r"^\d{1,2}[\.\)]\s*", stripped))
            if is_new_question:
                if q_text:
                    q_clean = clean_question_text(q_text.strip())
                    m = extract_marks(q_clean)
                    questions.append(q_clean)
                    years.append(year)
                    marks.append(m)
                q_text = stripped
            elif len(stripped) > 20:
                q_text += " " + stripped
            elif stripped and not re.match(r"^\d+$", stripped):
                q_text += " " + stripped

        if q_text:
            q_clean = clean_question_text(q_text.strip())
            m = extract_marks(q_clean)
            questions.append(q_clean)
            years.append(year)
            marks.append(m)
    return questions, years, marks


def load_chapters(subject_name):
    subject_folder = os.path.join(Config.CHAPTER_JSON_DIR, subject_name)
    chapters = []
    for file_name in os.listdir(subject_folder):
        if file_name.endswith(".json"):
            path = os.path.join(subject_folder, file_name)
            with open(path, "r", encoding="utf-8") as f:
                chapters.extend(json.load(f))
    return chapters


# ─── FIX: NEW CHAPTER TEXT BUILDER ───────────────────────────────────────────
# OLD problem: _build_chapter_text dumped everything into one giant string.
# Chapter 7 had 22k chars vs Chapter 4 at 7k chars.
# Longer chapters dominated cosine similarity just by sheer term frequency,
# so questions about FOPL (Ch4) or Expert Systems (Ch7 misplaced) scored high
# against Ch1 which had broad AI terminology overlapping everything.
#
# NEW approach: build ONE short, focused text per SUBTOPIC, not per chapter.
# Then find the best-matching subtopic and use its parent chapter.
# This is fine-grained and length-normalized.

def _build_subtopic_texts(chapters: list) -> tuple:
    """
    Returns:
        subtopic_texts  - list of short focused strings, one per subtopic
        subtopic_meta   - list of {chapter_id, chapter_name, subtopic_id, subtopic_name}
    """
    subtopic_texts = []
    subtopic_meta  = []

    for chap in chapters:
        chap_id   = chap["chapter_id"]
        chap_name = chap["chapter_name"]

        for sub in chap.get("subtopics", []):
            # Build a focused, length-normalized text for this subtopic:
            # subtopic name repeated 3× (acts as a title weight) + keywords + paragraph[:400]
            name     = sub.get("subtopic_name", "")
            keywords = " ".join(sub.get("keywords", []))
            para     = sub.get("paragraph", "")[:400]

            text = f"{name} {name} {name} {keywords} {para}".strip()
            subtopic_texts.append(text)
            subtopic_meta.append({
                "chapter_id":    chap_id,
                "chapter_name":  chap_name,
                "subtopic_id":   sub.get("subtopic_id", ""),
                "subtopic_name": name,
            })

    return subtopic_texts, subtopic_meta


def assign_chapters_to_questions(subject_name: str, questions: list) -> list:
    """
    For each question, find the top-K most similar subtopics,
    then vote by chapter to pick the winning chapter.

    Fixes vs old version:
    1. Subtopic-level matching instead of whole-chapter blob → length-normalized
    2. Top-K voting (K=5) → one outlier subtopic can't flip the result
    3. Score-weighted vote (sum of cosine scores per chapter, not just count)
    """
    TOP_K = 5  # consider top-5 subtopic matches, vote among their chapters

    chapters = load_chapters(subject_name)
    model    = SentenceTransformer('all-MiniLM-L6-v2', device=device)

    subtopic_texts, subtopic_meta = _build_subtopic_texts(chapters)

    if not subtopic_texts:
        raise ValueError("No subtopics found in chapter JSON.")

    # Encode all subtopics + all questions
    sub_embeddings = model.encode(subtopic_texts, convert_to_tensor=True,
                                  device=device, batch_size=64, show_progress_bar=False)
    q_texts        = [q["question"] for q in questions]
    q_embeddings   = model.encode(q_texts, convert_to_tensor=True,
                                  device=device, batch_size=64, show_progress_bar=False)

    # cosine similarity: shape [num_questions × num_subtopics]
    cosine_scores = util.cos_sim(q_embeddings, sub_embeddings).cpu().numpy()

    assigned = []
    for q_idx, q in enumerate(q_texts):
        scores = cosine_scores[q_idx]  # shape [num_subtopics]

        # Get top-K subtopic indices
        top_k_indices = np.argsort(scores)[::-1][:TOP_K]

        # Vote: accumulate cosine score per chapter
        chapter_score: dict = {}
        for sub_idx in top_k_indices:
            meta  = subtopic_meta[sub_idx]
            cid   = meta["chapter_id"]
            score = float(scores[sub_idx])
            chapter_score[cid] = chapter_score.get(cid, 0.0) + score

        best_cid   = max(chapter_score, key=chapter_score.get)
        best_score = chapter_score[best_cid]

        if best_score < CHAPTER_ASSIGNMENT_CONFIDENCE:
            # Low score = chapter notes are missing from the system
            print(f"  ⚠ Low confidence ({best_score:.3f}): {q[:70]}")
            assigned.append({
                "chapter_id":   -1,
                "chapter_name": "Unassigned (upload missing chapter notes)",
            })
        else:
            best_chap = next(c for c in chapters if c["chapter_id"] == best_cid)
            assigned.append({
                "chapter_id":   best_cid,
                "chapter_name": best_chap["chapter_name"],
            })

    return assigned


def cluster_similar_questions(questions, threshold=0.7):
    model      = SentenceTransformer('all-MiniLM-L6-v2', device=device)
    embeddings = model.encode([q["question"] for q in questions],
                               convert_to_tensor=True, device=device)
    sim_matrix      = util.cos_sim(embeddings, embeddings).cpu().numpy()
    distance_matrix = 1 - sim_matrix
    clustering = AgglomerativeClustering(
        metric='precomputed', linkage='complete',
        distance_threshold=1 - threshold, n_clusters=None
    )
    labels   = clustering.fit_predict(distance_matrix)
    clusters = {}
    for idx, label in enumerate(labels):
        clusters.setdefault(label, []).append(idx)
    return clusters


def create_question_json(subject_name, questions, years, marks):
    output_dir = os.path.join(Config.QUESTION_JSON_DIR, subject_name)
    os.makedirs(output_dir, exist_ok=True)
    save_path = os.path.join(output_dir, f"{subject_name}_questions.json")

    new_question_list = [
        {"question": q, "year": y, "mark": m}
        for q, y, m in zip(questions, years, marks)
    ]

    if os.path.exists(save_path):
        with open(save_path, "r", encoding="utf-8") as f:
            existing_clusters = json.load(f)

        old_flat_questions = []
        for cluster in existing_clusters:
            for i in range(len(cluster["years"])):
                old_flat_questions.append({
                    "question":     cluster["question"],
                    "year":         cluster["years"][i],
                    "mark":         cluster["marks"][i],
                    "chapter_id":   cluster["chapter_id"][i],
                    "chapter_name": cluster["chapter_name"][i],
                })

        question_list = old_flat_questions + new_question_list
    else:
        question_list = new_question_list

    # Re-assign chapters for ALL questions (old + new) using the fixed method
    # This also retroactively corrects any old wrong mappings.
    print("  Assigning chapters to questions (subtopic-level matching)...")
    assigned = assign_chapters_to_questions(subject_name, question_list)
    for q, a in zip(question_list, assigned):
        q.update(a)

    # Re-cluster
    clusters = cluster_similar_questions(question_list, threshold=0.7)

    final_json_list = []
    for cluster_indices in clusters.values():
        cluster_questions = [question_list[idx] for idx in cluster_indices]
        final_json_list.append({
            "freq":         len(cluster_questions),
            "question":     cluster_questions[0]["question"],
            "years":        [q["year"] for q in cluster_questions],
            "marks":        [q["mark"] for q in cluster_questions],
            "chapter_id":   [q["chapter_id"] for q in cluster_questions],
            "chapter_name": [q["chapter_name"] for q in cluster_questions],
        })

    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(final_json_list, f, ensure_ascii=False, indent=4)

    print(f"  Updated question JSON saved to {save_path}")
    return final_json_list


def get_existing_years(subject_name):
    save_path = os.path.join(
        Config.QUESTION_JSON_DIR, subject_name, f"{subject_name}_questions.json"
    )
    if not os.path.exists(save_path):
        return set()
    with open(save_path, "r", encoding="utf-8") as f:
        existing_data = json.load(f)
    existing_years = set()
    for cluster in existing_data:
        existing_years.update(cluster["years"])
    return existing_years


def process_raw_and_questions(subject_name: str, input_file_path: str):
    with open(input_file_path, "r", encoding="utf-8") as f:
        raw_text = f.read()

    text = fix_common_ocr_errors(raw_text)
    text = remove_headers(text)
    print("DEBUG SAMPLE TEXT:\n", text[:500])

    year_sections = split_by_year(text)
    if not year_sections:
        print("No year sections found.")
        return

    final_sections = []
    for section in year_sections:
        cleaned = clean_with_llm(section)
        final_sections.append(cleaned)

    output_dir = os.path.join(Config.CLEANED_TEXT_DIR, subject_name, "past_paper")
    os.makedirs(output_dir, exist_ok=True)
    file_name  = os.path.basename(input_file_path)
    save_path  = os.path.join(output_dir, file_name)
    with open(save_path, "w", encoding="utf-8") as f:
        f.write("\n\n".join(final_sections))
    print(f"Saved cleaned file to {save_path}")

    questions, years, marks = extract_questions("\n\n".join(final_sections))
    existing_years = get_existing_years(subject_name)

    filtered_questions, filtered_years, filtered_marks = [], [], []
    for q, y, m in zip(questions, years, marks):
        if y in existing_years:
            print(f"Skipping existing year: {y}")
            continue
        filtered_questions.append(q)
        filtered_years.append(y)
        filtered_marks.append(m)

    if not filtered_questions:
        print("All cleaned years already exist. Nothing new to add.")
        return

    final_json = create_question_json(subject_name, filtered_questions,
                                      filtered_years, filtered_marks)
    return final_json


if __name__ == "__main__":
    subject_name    = "AI"
    input_file_path = os.path.join(
        Config.CLEANED_TEXT_DIR, subject_name, "past_paper", "ai_2064_2075.txt"
    )
    process_raw_and_questions(subject_name, input_file_path)