from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.services.pdf_service import pdf_service, db
from app.config import DEFAULT_DPI, ALLOWED_DPIS

router = APIRouter()

class ExtractRequest(BaseModel):
    job_id: str
    dpi: Optional[int] = DEFAULT_DPI

@router.post("/extract")
async def start_extraction(req: ExtractRequest):
    job = db.get_job(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job ID not found")
        
    dpi = req.dpi if req.dpi in ALLOWED_DPIS else DEFAULT_DPI
    
    with db._get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT filepath FROM extraction_jobs WHERE job_id = ?", (req.job_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="File path for job not found")
        filepath = row["filepath"]
        
    pdf_service.start_extraction_job(
        job_id=req.job_id,
        filepath=filepath,
        filename=job.filename,
        dpi=dpi
    )
    
    return {
        "job_id": req.job_id,
        "status": "processing",
        "total_pages": job.total_pages,
        "dpi": dpi
    }

@router.get("/extraction/{job_id}")
async def get_extraction_status(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job ID not found")
    return job

@router.get("/extraction/{job_id}/raw-pages")
async def get_raw_pages(job_id: str):
    pages = db.get_raw_pages(job_id)
    return {"job_id": job_id, "pages": pages}

@router.post("/page/{page_number}/retry")
async def retry_page(page_number: int, job_id: str = Query(...), dpi: int = Query(DEFAULT_DPI)):
    success = pdf_service.retry_page(job_id, page_number, dpi)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to retry page {page_number}")
    return {"job_id": job_id, "page_number": page_number, "status": "reprocessed"}
