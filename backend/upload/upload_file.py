"""
Updated Upload Handler for Marker + Ollama (Async)
Handles async PDF extraction from new Marker API.

Location: backend/upload/upload_file.py
"""

import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from .file_processor import FileProcessorMarker
from config import Config
from data.background_processor import trigger_processing

router = APIRouter()

# Initialize Marker+Ollama processor
processor = FileProcessorMarker(ollama_model='llama3.2')

# Use Config paths
RAW_TEXT_DIR = Config.RAW_TEXT_DIR
TEMP_UPLOAD_FOLDER = Config.UPLOAD_FOLDER

# Ensure directories exist
os.makedirs(RAW_TEXT_DIR, exist_ok=True)
os.makedirs(TEMP_UPLOAD_FOLDER, exist_ok=True)


@router.post("/upload/")
async def upload_file(  # ← Now async!
    file: UploadFile = File(...),
    subject: str = Form(...),
    file_type: str = Form(...),
    uploaded_by: str = Form(default="student123")
):
    """
    Upload and process study material (PDF, DOCX, PPTX).
    Uses Marker + Ollama for accurate PDF extraction and structuring.
    """
    try:
        # Validate file extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in processor.supported_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format. Supported: {', '.join(processor.supported_formats)}"
            )
        
        # Check file size
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
        if file_size > Config.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {Config.MAX_UPLOAD_SIZE / (1024*1024)}MB"
            )
        
        # Validate file_type
        valid_types = ["notes", "note", "syllabus", "question_paper", "question", "questions", "qp"]
        if file_type.lower() not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file_type. Use: notes, syllabus, or question_paper"
            )
        
        # Save uploaded file temporarily
        import uuid
        temp_filename = f"{uuid.uuid4()}_{file.filename}"
        temp_file_path = os.path.join(TEMP_UPLOAD_FOLDER, temp_filename)
        
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"✓ File saved temporarily: {temp_file_path}")
        
        # Get file statistics
        file_stats = processor.get_file_stats(temp_file_path)
        
        # Extract text from file (ASYNC CALL for Marker)
        print(f"\nProcessing {file.filename}...")
        raw_text, extraction_method, structured_data = await processor.extract_text(
            temp_file_path,
            file_type=file_type
        )
        
        if not raw_text or len(raw_text.strip()) < Config.MIN_TEXT_LENGTH:
            # Clean up temp file
            os.remove(temp_file_path)
            raise HTTPException(
                status_code=400,
                detail="Could not extract meaningful text from file. File might be corrupted or empty."
            )
        
        # Create organized folder structure
        output_dir = processor.create_folder_structure(
            base_dir=str(RAW_TEXT_DIR),
            subject=subject,
            file_type=file_type
        )
        
        # Save as JSON with metadata (including Ollama-structured data)
        json_path = processor.save_as_json(
            raw_text=raw_text,
            filename=file.filename,
            file_type=file_type,
            subject=subject.upper(),
            uploaded_by=uploaded_by,
            output_dir=output_dir,
            structured_data=structured_data  # From Ollama
        )
        
        # Remove temporary uploaded file
        os.remove(temp_file_path)
        print(f"✓ Removed temporary file: {temp_file_path}")
        
        # Trigger background processing
        try:
            trigger_processing(subject.upper())
            print(f"✓ Triggered background processing for {subject.upper()}")
        except Exception as bg_error:
            print(f"⚠️  Background processing trigger failed: {bg_error}")
        
        # Prepare response
        return {
            "status": "success",
            "message": "File processed successfully",
            "data": {
                "filename": file.filename,
                "subject": subject.upper(),
                "file_type": file_type,
                "uploaded_by": uploaded_by,
                "extraction_method": extraction_method,
                "json_path": json_path,
                "storage_location": output_dir,
                "has_structured_data": structured_data is not None,
                "statistics": {
                    "character_count": len(raw_text),
                    "word_count": len(raw_text.split()),
                    "file_size_mb": file_stats["size_mb"]
                }
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        
        print(f"✗ Error processing file: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/files/{subject}")
async def list_subject_files(subject: str, file_type: Optional[str] = None):
    """List all uploaded files for a subject."""
    try:
        subject = subject.upper()
        subject_dir = os.path.join(str(RAW_TEXT_DIR), subject)
        
        if not os.path.exists(subject_dir):
            return {
                "status": "success",
                "subject": subject,
                "files": [],
                "message": "No files found for this subject"
            }
        
        files_data = []
        
        # Determine which directories to scan
        if file_type:
            normalized_type = Config.FILE_TYPE_MAP.get(file_type.lower(), file_type)
            scan_dirs = [normalized_type]
        else:
            scan_dirs = ["notes", "syllabus", "questions"]
        
        # Scan directories for JSON files
        for dir_name in scan_dirs:
            dir_path = os.path.join(subject_dir, dir_name)
            if os.path.exists(dir_path):
                for filename in os.listdir(dir_path):
                    if filename.endswith('.json'):
                        json_path = os.path.join(dir_path, filename)
                        try:
                            with open(json_path, 'r', encoding='utf-8') as f:
                                import json
                                metadata = json.load(f)
                                # Don't include raw_text in listing
                                metadata_summary = {k: v for k, v in metadata.items() if k != 'raw_text'}
                                metadata_summary['json_path'] = json_path
                                metadata_summary['has_structured_data'] = 'structured_data' in metadata
                                files_data.append(metadata_summary)
                        except Exception as e:
                            print(f"Error reading {json_path}: {e}")
                            continue
        
        return {
            "status": "success",
            "subject": subject,
            "total_files": len(files_data),
            "files": sorted(files_data, key=lambda x: x.get('upload_time', ''), reverse=True)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file/{subject}/{file_type}/{filename}")
async def get_file_content(subject: str, file_type: str, filename: str):
    """Get the full content of a specific file."""
    try:
        import json
        subject = subject.upper()
        normalized_type = Config.FILE_TYPE_MAP.get(file_type.lower(), file_type)
        
        json_path = os.path.join(str(RAW_TEXT_DIR), subject, normalized_type, filename)
        
        if not os.path.exists(json_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            content = json.load(f)
        
        return {
            "status": "success",
            "data": content
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/file/{subject}/{file_type}/{filename}")
async def delete_file(subject: str, file_type: str, filename: str):
    """Delete a specific file."""
    try:
        subject = subject.upper()
        normalized_type = Config.FILE_TYPE_MAP.get(file_type.lower(), file_type)
        
        json_path = os.path.join(str(RAW_TEXT_DIR), subject, normalized_type, filename)
        
        if not os.path.exists(json_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        os.remove(json_path)
        
        return {
            "status": "success",
            "message": f"File {filename} deleted successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))