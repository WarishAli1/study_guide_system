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

client = OpenAI(
    api_key=Config.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)
MODEL_NAME = Config.MODEL_NAME
device = 'cuda' if torch.cuda.is_available() else 'cpu'

CLEAN_PROMPT = Config.QUESTION_CLEAN_PROMPT


TITLE_WEIGHT  = 0.30
KW_WEIGHT     = 0.25
SEM_WEIGHT    = 0.45
KW_NORM_CAP   = 8.0
TITLE_BOOST   = 2.0
TITLE_BOOST_THRESHOLD = 0.5

CHAPTER_ASSIGNMENT_CONFIDENCE = 0.25


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
    r"TRIBHUVAN\s+UNIVERSITY", r"INSTITUTE\s+OF\s+ENGINEERING",
    r"Examination\s+Control\s+Division",
    r"^Exam\.", r"^Level\b", r"Programme", r"Full\s+Marks", r"Pass\s+Marks",
    r"Year\s*/?\s*Part", r"^Time\b",
    r"Candidates\s+are\s+required", r"Attempt\s+[Aa]ll",
    r"figures\s+in\s+the\s+margin", r"Assume\s+suitable\s+data",
    r"Subject\s*[:\-]+\s*.{3,80}\(.*?\)",
    r"^\*+$", r"^\d+$", r"^\s*-{3,}\s*$", r"^\s*={3,}\s*$",
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
        r'[\[\{\(\|]'
        r'(\d[\d\+\×xX\*\s]*)'
        r'[\]\}\)\|]',
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
            year = re.sub(r'\s+', ' ', parts[i].strip())
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
        year = re.sub(r'\s+', ' ', year_sections[i].strip())
        section = year_sections[i + 1].strip()
        lines = section.split("\n")
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

_STOPWORDS = {
    "what", "is", "a", "the", "and", "its", "describe", "steps", "of", "in",
    "an", "for", "are", "to", "be", "that", "how", "explain", "with", "or",
    "any", "two", "define", "list", "also", "does", "this", "it", "by", "as",
    "on", "at", "from", "into", "if", "then", "was", "were", "which", "their",
    "why", "give", "write", "discuss", "about", "can", "not", "no", "us",
    "we", "they", "he", "she", "you", "me", "my", "your", "our",
}


def _query_words(query: str) -> list:
    """Tokenise query into content words (no stopwords, length ≥ 3)."""
    return [
        w.lower() for w in re.findall(r"\b[a-z]{3,}\b", query.lower())
        if w.lower() not in _STOPWORDS
    ]


def _title_match_score(q_words: list, subtopic_name: str) -> float:
    title_words = set(re.findall(r"\b[a-z]{3,}\b", subtopic_name.lower())) - _STOPWORDS
    if not title_words:
        return 0.0
    return len(title_words & set(q_words)) / len(title_words)


def _keyword_overlap_score(q_words: list, kw_list: list) -> float:
    q_set = set(q_words)
    k_set = set(kw_list)
    exact   = len(q_set & k_set)
    partial = sum(
        0.5 for qk in q_set for tk in k_set
        if qk != tk and (qk in tk or tk in qk)
    )
    return exact + partial


def _subtopic_score(
    q_words: list,
    q_embedding,
    sub_name: str,
    sub_keywords: list,
    sub_embedding,
) -> float:
    title  = _title_match_score(q_words, sub_name)
    kw     = _keyword_overlap_score(q_words, sub_keywords)
    sem    = float(np.dot(q_embedding, sub_embedding))

    title_eff = title * (TITLE_BOOST if title >= TITLE_BOOST_THRESHOLD else 1.0)

    return (
        TITLE_WEIGHT * title_eff
        + KW_WEIGHT  * min(kw / KW_NORM_CAP, 1.0)
        + SEM_WEIGHT * max(sem, 0.0)
    )


def _build_subtopic_records(chapters: list) -> tuple:
    records = []
    texts   = []

    for chap in chapters:
        chap_id   = chap["chapter_id"]
        chap_name = chap["chapter_name"]

        for sub in chap.get("subtopics", []):
            name     = sub.get("subtopic_name", "")
            keywords = sub.get("keywords", [])
            para     = sub.get("paragraph", "")[:600]

            text = " ".join([name] * 3 + keywords + [para]).strip()

            records.append({
                "chapter_id":    chap_id,
                "chapter_name":  chap_name,
                "subtopic_id":   sub.get("subtopic_id", ""),
                "subtopic_name": name,
                "keywords":      keywords,
            })
            texts.append(text)

    return records, texts



def assign_chapters_to_questions(subject_name: str, questions: list) -> list:
    chapters = load_chapters(subject_name)
    model    = SentenceTransformer("all-MiniLM-L6-v2", device=device)

    records, texts = _build_subtopic_records(chapters)

    if not records:
        raise ValueError("No subtopics found in chapter JSON.")

    all_embeddings = model.encode(
        texts + [q["question"] for q in questions],
        convert_to_tensor=False,
        normalize_embeddings=True,
        device=device,
        batch_size=64,
        show_progress_bar=False,
    )
    sub_embeddings = all_embeddings[:len(records)]
    q_embeddings   = all_embeddings[len(records):]

    assigned = []

    for q_idx, q_dict in enumerate(questions):
        q_text   = q_dict["question"]
        q_words  = _query_words(q_text)
        q_emb    = q_embeddings[q_idx]

        chapter_best: dict = {}

        for s_idx, rec in enumerate(records):
            score = _subtopic_score(
                q_words, q_emb,
                rec["subtopic_name"], rec["keywords"],
                sub_embeddings[s_idx],
            )
            cid = rec["chapter_id"]
            if cid not in chapter_best or score > chapter_best[cid]["score"]:
                chapter_best[cid] = {
                    "score":    score,
                    "subtopic": rec["subtopic_name"],
                }

        if not chapter_best:
            assigned.append({
                "chapter_id":   -1,
                "chapter_name": "Unassigned (no subtopics found)",
            })
            continue

        ranked    = sorted(chapter_best.items(), key=lambda x: -x[1]["score"])
        best_cid  = ranked[0][0]
        best_info = ranked[0][1]
        best_score = best_info["score"]

        if best_score < CHAPTER_ASSIGNMENT_CONFIDENCE:
            print(
                f"  ⚠ Low confidence ({best_score:.3f}): {q_text[:70]}\n"
                f"    best subtopic: Ch{best_cid} – {best_info['subtopic']}"
            )
            assigned.append({
                "chapter_id":   -1,
                "chapter_name": "Unassigned (upload missing chapter notes)",
            })
            continue

        if len(ranked) > 1:
            runner_score = ranked[1][1]["score"]
            if runner_score > 0 and (best_score / runner_score) < 1.3:
                print(
                    f"  ~ Close call ({best_score:.3f} vs {runner_score:.3f}): "
                    f"{q_text[:55]}\n"
                    f"    winner: Ch{best_cid} – {best_info['subtopic']}\n"
                    f"    runner: Ch{ranked[1][0]} – {ranked[1][1]['subtopic']}"
                )

        best_chap = next(c for c in chapters if c["chapter_id"] == best_cid)
        assigned.append({
            "chapter_id":   best_cid,
            "chapter_name": best_chap["chapter_name"],
        })

    return assigned


def cluster_similar_questions(questions, threshold=0.7):
    model      = SentenceTransformer('all-MiniLM-L6-v2', device=device)
    embeddings = model.encode(
        [q["question"] for q in questions],
        convert_to_tensor=True, device=device
    )
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

    print("  Assigning chapters to questions (max-score subtopic matching)...")
    assigned = assign_chapters_to_questions(subject_name, question_list)
    for q, a in zip(question_list, assigned):
        q.update(a)

    clusters = cluster_similar_questions(question_list, threshold=0.7)

    final_json_list = []
    for cluster_indices in clusters.values():
        cluster_questions = [question_list[idx] for idx in cluster_indices]
        final_json_list.append({
            "freq":         len(cluster_questions),
            "question":     cluster_questions[0]["question"],
            "years":        [q["year"]         for q in cluster_questions],
            "marks":        [q["mark"]          for q in cluster_questions],
            "chapter_id":   [q["chapter_id"]    for q in cluster_questions],
            "chapter_name": [q["chapter_name"]  for q in cluster_questions],
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
    file_name = os.path.basename(input_file_path)
    save_path = os.path.join(output_dir, file_name)
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

    final_json = create_question_json(
        subject_name, filtered_questions, filtered_years, filtered_marks
    )
    return final_json


if __name__ == "__main__":
    subject_name    = "AI"
    input_file_path = os.path.join(
        Config.CLEANED_TEXT_DIR, subject_name, "past_paper", "ai_2064_2075.txt"
    )
    process_raw_and_questions(subject_name, input_file_path)