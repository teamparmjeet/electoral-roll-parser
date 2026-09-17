import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import PlainTextResponse

from app.services.pdf_service import db
from app.services.export_service import (
    export_to_json,
    export_to_xlsx,
    export_to_csv,
    export_to_aligned_txt
)

router = APIRouter()

@router.get("/export/{job_id}/json")
async def get_export_json(job_id: str, filter: str = Query("all")):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    records = db.get_records(job_id)
    json_str = export_to_json(records, filter_type=filter)
    
    filename = f"voter_records_{job_id[:8]}_{filter}.json"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=json_str, media_type="application/json", headers=headers)

@router.get("/export/{job_id}/xlsx")
async def get_export_xlsx(job_id: str, filter: str = Query("all")):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    records = db.get_records(job_id)
    xlsx_bytes = export_to_xlsx(records, filter_type=filter)
    
    filename = f"voter_records_{job_id[:8]}_{filter}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

@router.get("/export/{job_id}/csv")
async def get_export_csv(job_id: str, filter: str = Query("all")):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    records = db.get_records(job_id)
    csv_bytes = export_to_csv(records, filter_type=filter)
    
    filename = f"voter_records_{job_id[:8]}_{filter}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=csv_bytes, media_type="text/csv; charset=utf-8", headers=headers)

@router.get("/export/{job_id}/txt")
async def get_export_txt(job_id: str, filter: str = Query("all")):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    records = db.get_records(job_id)
    txt_str = export_to_aligned_txt(records, filter_type=filter)
    
    filename = f"voter_records_{job_id[:8]}_{filter}.txt"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return PlainTextResponse(content=txt_str, headers=headers)

@router.get("/export/{job_id}/report")
async def get_extraction_report(job_id: str):
    """
    Generates actual extraction_report.json containing real processing metrics.
    """
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    records = db.get_records(job_id)
    verified = sum(1 for r in records if r.verification_status == "verified")
    needs_review = sum(1 for r in records if r.needs_review)
    
    report = {
        "document": job.filename,
        "job_id": job.job_id,
        "status": job.status,
        "total_pages": job.total_pages,
        "processed_pages": job.current_page,
        "failed_pages": job.failed_pages,
        "cards_detected": job.cards_detected,
        "records_extracted": len(records),
        "verified_records": verified,
        "needs_review": needs_review,
        "ocr_pages_count": job.ocr_pages_count,
        "errors": job.errors,
        "created_at": job.created_at,
        "completed_at": job.completed_at
    }
    
    headers = {"Content-Disposition": f'attachment; filename="extraction_report_{job_id[:8]}.json"'}
    return Response(content=json.dumps(report, indent=2, ensure_ascii=False), media_type="application/json", headers=headers)

@router.get("/export/{job_id}/raw-txt")
async def get_raw_txt(job_id: str):
    """
    Exports concatenated raw text extracted across all pages.
    """
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    pages = db.get_raw_pages(job_id)
    parts = []
    for p in pages:
        parts.append(f"=== PAGE {p.page_number} (OCR: {p.is_ocr}, Cards: {p.cards_count}) ===\n{p.raw_text_snippet}\n")
        
    filename = f"raw_extracted_text_{job_id[:8]}.txt"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return PlainTextResponse(content="\n\n".join(parts), headers=headers)
