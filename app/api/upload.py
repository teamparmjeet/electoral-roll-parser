import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
import fitz

from app.config import UPLOAD_DIR
from app.models.extraction import ExtractionJobStatus
from app.services.pdf_service import db

router = APIRouter()

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Receives an actual electoral roll PDF file.
    Validates PDF format, counts pages, and initializes an extraction job record.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid PDF (.pdf)")
        
    job_id = str(uuid.uuid4())
    safe_filename = Path(file.filename).name
    save_path = UPLOAD_DIR / f"{job_id}_{safe_filename}"
    
    # Save file to temporary upload directory
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Check PDF validity and page count
    try:
        doc = fitz.open(save_path)
        total_pages = len(doc)
        doc.close()
    except Exception as e:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(status_code=400, detail=f"Could not open or parse PDF document: {str(e)}")
        
    job_status = ExtractionJobStatus(
        job_id=job_id,
        filename=safe_filename,
        status="uploaded",
        current_page=0,
        total_pages=total_pages
    )
    db.save_job(job_status, str(save_path))
    
    return {
        "job_id": job_id,
        "filename": safe_filename,
        "total_pages": total_pages,
        "status": "uploaded",
        "message": f"PDF uploaded successfully with {total_pages} page(s)."
    }
