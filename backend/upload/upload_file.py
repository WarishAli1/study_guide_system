import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from config import Config
from .file_processor import extract_text_from_pdf, save_raw_text

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
RAW_TEXT_DIR = os.path.join(BASE_DIR, "datasets", "raw_text")

os.makedirs(RAW_TEXT_DIR, exist_ok=True)

@router.post("/upload/")
async def upload_file(file: UploadFile = File(...), type: str = "note"):
    try:
        file_location = os.path.join(RAW_TEXT_DIR, file.filename)
        
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        if file.filename.endswith('.pdf'):
            raw_text = extract_text_from_pdf(file_location)
        else:
            raw_text = "Image/Doc parsing not implemented yet."

        if not raw_text:
             raise HTTPException(status_code=400, detail="Could not extract text")

        text_file_path = save_raw_text(raw_text, file.filename, RAW_TEXT_DIR)

        return {
            "status": "success",
            "filename": file.filename, 
            "extracted_path": text_file_path
        }

    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))