import os
from PyPDF2 import PdfReader

def extract_text_from_pdf(file_path):
    text = ""
    try:
        reader = PdfReader(file_path)
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return None

def save_raw_text(text, filename, output_dir):
    base_name = os.path.splitext(filename)[0]
    txt_filename = f"{base_name}.txt"
    output_path = os.path.join(output_dir, txt_filename)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    
    return output_path