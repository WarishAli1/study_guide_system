import os
import re
import json
import time
from config import Config
from openai import OpenAI

client = OpenAI(
    api_key=Config.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

MODEL_NAME = Config.MODEL_NAME
CLEAN_PROMPT = Config.SYLLABUS_CLEAN_PROMPT


def clean_syllabus_with_llm(text: str) -> str:
    max_tokens = min(max(800, int(len(text.split()) * 1.2)), 2000)

    response = client.responses.create(
        model=MODEL_NAME,
        input=f"{CLEAN_PROMPT}\n\n{text}",
        temperature=0,
        max_output_tokens=max_tokens
    )

    time.sleep(3)
    return response.output_text.strip()


def extract_syllabus_data(cleaned_text: str):
    chapters = []

    chapter_pattern = re.compile(
        r"(Chapter|Unit)\s*(\d+)\s*[:\-]?\s*(.*?)\n"
        r"(?:Credit\s*Hours\s*[:\-]?\s*(\d+))?.*?\n?"
        r"(?:Marks\s*Distribution\s*[:\-]?\s*(\d+))?",
        re.IGNORECASE | re.DOTALL
    )

    matches = chapter_pattern.findall(cleaned_text)

    for match in matches:
        chapters.append({
            "chapter_id": match[1].strip(),
            "chapter_name": match[2].strip(),
            "credit_hours": int(match[3]) if match[3] else None,
            "marks_distribution": int(match[4]) if match[4] else None
        })

    if not chapters:
        return None

    total_credit = None
    total_marks = None

    total_match = re.search(
        r"Total.*?(\d+).*?(\d+)",
        cleaned_text,
        re.IGNORECASE | re.DOTALL
    )

    if total_match:
        nums = re.findall(r"\d+", total_match.group())
        if len(nums) >= 2:
            total_credit = int(nums[0])
            total_marks = int(nums[1])

    if total_credit is None:
        total_credit = sum(
            c["credit_hours"] for c in chapters if c["credit_hours"] is not None
        ) or None

    if total_marks is None:
        total_marks = sum(
            c["marks_distribution"] for c in chapters if c["marks_distribution"] is not None
        ) or None

    return {
        "chapters": chapters,
        "total_credit_hours": total_credit,
        "total_marks": total_marks
    }


def save_cleaned_text(subject_name: str, input_file_path: str, cleaned_text: str):
    output_dir = os.path.join(
        Config.CLEANED_TEXT_DIR,
        subject_name,
        "syllabus"
    )
    os.makedirs(output_dir, exist_ok=True)

    file_name = os.path.basename(input_file_path)
    save_path = os.path.join(output_dir, file_name)

    with open(save_path, "w", encoding="utf-8") as f:
        f.write(cleaned_text)

    return save_path


def create_syllabus_json(subject_name: str, syllabus_data: dict):
    output_dir = os.path.join(
        Config.SYLLABUS_JSON_DIR,
        subject_name
    )
    os.makedirs(output_dir, exist_ok=True)

    save_path = os.path.join(
        output_dir,
        f"{subject_name}_syllabus.json"
    )

    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(syllabus_data, f, indent=4, ensure_ascii=False)

    return save_path


def process_raw_syllabus(subject_name: str, input_file_path: str):

    if not os.path.exists(input_file_path):
        raise FileNotFoundError(f"Raw text not found: {input_file_path}")

    with open(input_file_path, "r", encoding="utf-8") as f:
        raw_text = f.read()

    cleaned_text = clean_syllabus_with_llm(raw_text)

    cleaned_path = save_cleaned_text(
        subject_name,
        input_file_path,
        cleaned_text
    )

    syllabus_data = extract_syllabus_data(cleaned_text)

    if syllabus_data is None:
        print("No chapters detected. Check cleaned format.")
        return None

    json_path = create_syllabus_json(subject_name, syllabus_data)

    print(f"Cleaned text saved → {cleaned_path}")
    print(f"Syllabus JSON saved → {json_path}")

    return syllabus_data
