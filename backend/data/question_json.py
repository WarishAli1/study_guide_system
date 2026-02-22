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
        "pey": "pay",
        "trros": "taxes",
        "texeg": "taxes",
        "erpldr": "explain",
        "coniunctive": "conjunctive",
        "dlfrerent": "different",
        "MeCulloch": "McCulloch",
        "Pittg": "Pitts"
    }
    for wrong, correct in replacements.items():
        text = re.sub(rf"\b{wrong}\b", correct, text, flags=re.IGNORECASE)
    return text

HEADER_PATTERNS = [
    r"TRIBHUVAN UNIVERSITY",
    r"INSTITUTE OF ENGINEERING",
    r"Examination Control Division",
    r"Exam\.",
    r"Level",
    r"Programme",
    r"Full Marks",
    r"Pass Marks",
    r"Year\s*/?\s*Part",
    r"Time",
    r"Candidates are required",
    r"Attempt All",
    r"The figures in the margin",
    r"Assume suitable data",
    r"\*+",
    r"^\d+$"
]
def remove_headers(text: str) -> str:
    lines = text.split("\n")
    cleaned_lines = [line.strip() for line in lines if not any(re.search(p, line, re.IGNORECASE) for p in HEADER_PATTERNS)]
    return "\n".join(cleaned_lines)

def split_by_year(text: str):
    year_pattern = r"(20[5-9]\d\s+[A-Za-z]{3,})"
    parts = re.split(year_pattern, text)
    sections = []
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            year = parts[i].strip()
            content = parts[i + 1].strip() if i + 1 < len(parts) else ""
            sections.append(f"{year}\n{content}")
    return sections

def clean_with_llm(year_text: str) -> str:
    """
    Clean text using Groq OpenAI-compatible client.
    Throttled for llama-4-scout (30K TPM safe).
    """

    max_retries = 5
    base_delay = 5  # 5 sec delay between calls (safe for 2500 token jobs)

    # Estimate safe output tokens (hard cap at 2000)
    estimated_tokens = int(len(year_text.split()) * 1.3)
    max_output = min(max(800, estimated_tokens), 2000)

    for attempt in range(max_retries):
        try:
            response = client.responses.create(
                model=MODEL_NAME,
                input=f"{CLEAN_PROMPT}\n\n{year_text}",
                temperature=0,
                top_p=0.9,
                max_output_tokens=max_output
            )

            # Small throttle after success
            time.sleep(base_delay)

            return response.output_text.strip()

        except Exception as e:
            err_msg = str(e).lower()

            if "429" in err_msg or "rate limit" in err_msg:
                wait_time = base_delay * (2 ** attempt)
                print(f"[Rate Limit] Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                continue

            elif "402" in err_msg or "quota" in err_msg:
                raise RuntimeError("API quota exceeded (402). Wait for reset.")

            else:
                print(f"Request failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    print("Max retries reached. Returning original text.")
                    return year_text

    return year_text



def extract_questions(cleaned_text):
    questions = []
    years = []
    marks = []

    # Split by year header
    year_sections = re.split(r"(20[5-9]\d\s+[A-Za-z]{3,})", cleaned_text)
    if len(year_sections) < 2:
        return [], [], []

    for i in range(1, len(year_sections), 2):
        year = year_sections[i].strip()
        section = year_sections[i+1].strip()
        # Split questions by 1., 2., 3. or fallback to blank line if short
        lines = section.split("\n")
        q_text = ""
        for line in lines:
            # Detect question number
            if re.match(r"^\d+\.", line.strip()):
                if q_text:
                    # Save previous question
                    questions.append(q_text.strip())
                    years.append(year)
                    # Extract marks
                    m = re.findall(r"[\[\(\{](\d+)[\]\)\}]", q_text)
                    marks.append(int(m[0]) if m else None)
                q_text = line.strip()
            elif len(line.strip()) > 20:
                q_text += " " + line.strip()
            elif len(line.strip()) <= 20 and q_text: # short line continuation
                q_text += " " + line.strip()
        if q_text:
            questions.append(q_text.strip())
            years.append(year)
            m = re.findall(r"[\[\(\{](\d+)[\]\)\}]", q_text)
            marks.append(int(m[0]) if m else None)
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

def _build_chapter_text(chap: dict) -> str:
    parts = []
    parts.append(chap.get("chapter_name", ""))
    parts.extend(chap.get("keywords", []))
    for s in chap.get("subtopics", []):
        parts.append(s.get("subtopic_name", ""))
        parts.extend(s.get("keywords", []))
        para = s.get("paragraph", "")
        if para:
            parts.append(para[:300])
    return " ".join(p for p in parts if p).strip()


def assign_chapters_to_questions(subject_name, questions):
    chapters = load_chapters(subject_name)
    model = SentenceTransformer('all-MiniLM-L6-v2', device=device)

    chapter_texts = [_build_chapter_text(c) for c in chapters]
    chapter_embeddings = model.encode(chapter_texts, convert_to_tensor=True, device=device)

    question_texts = [q["question"] for q in questions]
    question_embeddings = model.encode(question_texts, convert_to_tensor=True, device=device)

    cosine_scores = util.cos_sim(question_embeddings, chapter_embeddings).cpu()

    assigned = []
    for q_idx in range(len(question_texts)):
        best_idx = int(np.argmax(cosine_scores[q_idx]))
        chap = chapters[best_idx]
        assigned.append({"chapter_id": chap["chapter_id"], "chapter_name": chap["chapter_name"]})

    return assigned

def cluster_similar_questions(questions, threshold=0.7):
    model = SentenceTransformer('all-MiniLM-L6-v2', device=device)
    embeddings = model.encode([q["question"] for q in questions], convert_to_tensor=True, device=device)
    sim_matrix = util.cos_sim(embeddings, embeddings).cpu().numpy()
    distance_matrix = 1 - sim_matrix
    clustering = AgglomerativeClustering(metric='precomputed', linkage='complete', distance_threshold=1-threshold, n_clusters=None)
    labels = clustering.fit_predict(distance_matrix)
    clusters = {}
    for idx, label in enumerate(labels):
        clusters.setdefault(label, []).append(idx)
    return clusters

def create_question_json(subject_name, questions, years, marks):
    output_dir = os.path.join(Config.QUESTION_JSON_DIR, subject_name)
    os.makedirs(output_dir, exist_ok=True)
    save_path = os.path.join(output_dir, f"{subject_name}_questions.json")

    # Step 1: Prepare new flat question list
    new_question_list = [
        {"question": q, "year": y, "mark": m}
        for q, y, m in zip(questions, years, marks)
    ]

    # Step 2: If file exists, load old data and flatten it
    if os.path.exists(save_path):
        with open(save_path, "r", encoding="utf-8") as f:
            existing_clusters = json.load(f)

        old_flat_questions = []
        for cluster in existing_clusters:
            for i in range(len(cluster["years"])):
                old_flat_questions.append({
                    "question": cluster["question"],
                    "year": cluster["years"][i],
                    "mark": cluster["marks"][i],
                    "chapter_id": cluster["chapter_id"][i],
                    "chapter_name": cluster["chapter_name"][i],
                })

        # Merge old + new
        question_list = old_flat_questions + new_question_list
    else:
        question_list = new_question_list

    # Step 3: Assign chapters ONLY to new ones (optimization)
    assigned = assign_chapters_to_questions(subject_name, question_list)
    for q, a in zip(question_list, assigned):
        q.update(a)

    # Step 4: Re-cluster everything
    clusters = cluster_similar_questions(question_list, threshold=0.7)

    final_json_list = []

    for cluster_indices in clusters.values():
        cluster_questions = [question_list[idx] for idx in cluster_indices]

        final_json_list.append({
            "freq": len(cluster_questions),
            "question": cluster_questions[0]["question"],
            "years": [q["year"] for q in cluster_questions],
            "marks": [q["mark"] for q in cluster_questions],
            "chapter_id": [q["chapter_id"] for q in cluster_questions],
            "chapter_name": [q["chapter_name"] for q in cluster_questions]
        })

    # Step 5: Save (overwrite with merged version)
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(final_json_list, f, ensure_ascii=False, indent=4)

    print(f"Updated question JSON saved to {save_path}")

    return final_json_list



def process_raw_and_questions(subject_name: str, input_file_path: str):
    # Read raw
    with open(input_file_path, "r", encoding="utf-8") as f:
        raw_text = f.read()
    # Fix OCR
    text = fix_common_ocr_errors(raw_text)
    # Remove headers
    text = remove_headers(text)
    # Debug
    print("DEBUG SAMPLE TEXT:\n", text[:500])
    # Split by year
    year_sections = split_by_year(text)
    if not year_sections:
        print("No year sections found.")
        return
    final_sections = []
    for section in year_sections:
        cleaned = clean_with_llm(section)
        final_sections.append(cleaned)
    # Save cleaned
    output_dir = os.path.join(Config.CLEANED_TEXT_DIR, subject_name, "past_paper")
    os.makedirs(output_dir, exist_ok=True)
    file_name = os.path.basename(input_file_path)
    save_path = os.path.join(output_dir, file_name)
    with open(save_path, "w", encoding="utf-8") as f:
        f.write("\n\n".join(final_sections))
    print(f"Saved cleaned file to {save_path}")
    # Extract questions
    questions, years, marks = extract_questions("\n\n".join(final_sections))
    existing_years = get_existing_years(subject_name)

    filtered_questions = []
    filtered_years = []
    filtered_marks = []

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

    # Replace original lists with filtered ones
    questions = filtered_questions
    years = filtered_years
    marks = filtered_marks

    # Create JSON
    final_json = create_question_json(subject_name, questions, years, marks)
    return final_json

def get_existing_years(subject_name):
    save_path = os.path.join(
        Config.QUESTION_JSON_DIR,
        subject_name,
        f"{subject_name}_questions.json"
    )

    if not os.path.exists(save_path):
        return set()

    with open(save_path, "r", encoding="utf-8") as f:
        existing_data = json.load(f)

    existing_years = set()
    for cluster in existing_data:
        existing_years.update(cluster["years"])

    return existing_years


if __name__ == "__main__":
    subject_name = "AI"
    input_file_path = os.path.join(Config.CLEANED_TEXT_DIR, subject_name, "past_paper", "ai_2064_2075.txt")
    process_raw_and_questions(subject_name, input_file_path)
