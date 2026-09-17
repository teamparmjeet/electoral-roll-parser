import io
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Response
from PIL import Image
import fitz

from app.services.pdf_service import db
from app.models.record import VoterRecord, RecordUpdate
from app.services.pdf_render import get_page_image_path, crop_card_image, render_page_to_image
from app.services.ocr_service import extract_text_with_ocr
from app.services.field_extractor import parse_card_fields
from app.services.validator import validate_record

router = APIRouter()

@router.get("/records/{job_id}")
async def get_records(
    job_id: str,
    search: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: Optional[int] = Query(None),
    min_age: Optional[int] = Query(None),
    max_age: Optional[int] = Query(None)
):
    """
    Returns extracted voter records for a job.
    Supports search across Name, Voter ID, Serial, House Number, Age with full Hindi Unicode.
    """
    records = db.get_records(job_id)
    
    if search:
        s_lower = search.strip().lower()
        def matches_search(r: VoterRecord) -> bool:
            fields = [
                str(r.serial_number or ""),
                (r.voter_id or "").lower(),
                (r.elector_name or "").lower(),
                (r.relation_name or "").lower(),
                (r.house_number or "").lower(),
                str(r.age or "")
            ]
            return any(s_lower in f for f in fields)
        records = [r for r in records if matches_search(r)]
        
    if gender:
        records = [r for r in records if r.gender == gender or r.gender_original == gender]
        
    if status:
        if status == "needs_review":
            records = [r for r in records if r.needs_review]
        elif status == "verified":
            records = [r for r in records if r.verification_status == "verified"]
        elif status == "unverified":
            records = [r for r in records if r.verification_status == "unverified"]
            
    if page is not None:
        records = [r for r in records if r.source_page == page]
        
    if min_age is not None:
        records = [r for r in records if r.age is not None and r.age >= min_age]
        
    if max_age is not None:
        records = [r for r in records if r.age is not None and r.age <= max_age]
        
    return {
        "job_id": job_id,
        "count": len(records),
        "records": records
    }

@router.get("/record/{record_id}")
async def get_record(record_id: str):
    record = db.get_record_by_id(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record

@router.put("/record/{record_id}")
async def update_record(record_id: str, updates: RecordUpdate):
    """
    Saves inline manual corrections by the user.
    Preserves original PDF intact and updates structured data.
    """
    update_dict = updates.model_dump(exclude_unset=True)
    # If user manually edited and didn't specify verification_status, set to verified
    if "verification_status" not in update_dict:
        update_dict["verification_status"] = "verified"
        update_dict["needs_review"] = False
        
    record = db.update_record(record_id, update_dict)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record

@router.post("/record/{record_id}/verify")
async def verify_record(record_id: str):
    record = db.update_record(record_id, {
        "verification_status": "verified",
        "needs_review": False
    })
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record

@router.post("/record/{record_id}/reprocess")
async def reprocess_card(record_id: str):
    """
    Reprocesses an individual card using the original PDF page and bounding box.
    """
    record = db.get_record_by_id(record_id)
    if not record or not record.source_bbox:
        raise HTTPException(status_code=404, detail="Record or bounding box not found")
        
    with db._get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT filepath FROM extraction_jobs WHERE job_id = ?", (record.document_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Original PDF file not found")
        filepath = row["filepath"]
        
    doc = fitz.open(filepath)
    page = doc[record.source_page - 1]
    page_img = render_page_to_image(doc, record.source_page, dpi=300)
    
    bbox_dict = {
        "x": record.source_bbox.x,
        "y": record.source_bbox.y,
        "width": record.source_bbox.width,
        "height": record.source_bbox.height
    }
    
    card_img = crop_card_image(page_img, bbox_dict, page.rect.width, page.rect.height)
    ocr_text = extract_text_with_ocr(card_img)
    doc.close()
    
    if not ocr_text:
        raise HTTPException(status_code=500, detail="OCR could not extract text from card crop")
        
    parsed = parse_card_fields(ocr_text)
    is_valid, reasons = validate_record(parsed)
    
    updated = db.update_record(record_id, {
        "serial_number": parsed.get("serial_number"),
        "voter_id": parsed.get("voter_id"),
        "elector_name": parsed.get("elector_name"),
        "relation_type": parsed.get("relation_type"),
        "relation_name": parsed.get("relation_name"),
        "house_number": parsed.get("house_number"),
        "age": parsed.get("age"),
        "gender": parsed.get("gender"),
        "gender_original": parsed.get("gender_original"),
        "photo_available": parsed.get("photo_available", False),
        "raw_card_text": ocr_text,
        "needs_review": parsed.get("needs_review", False),
        "verification_status": "needs_review" if parsed.get("needs_review") else "unverified"
    })
    
    return updated

@router.get("/record/{record_id}/image")
async def get_record_card_image(record_id: str):
    """
    Returns the real cropped image of this specific voter card from the uploaded PDF.
    No placeholders, no generic images.
    """
    record = db.get_record_by_id(record_id)
    if not record or not record.source_bbox:
        raise HTTPException(status_code=404, detail="Record or bounding box not found")
        
    # Get page image from temp storage or render on the fly
    page_img_path = get_page_image_path(record.document_id, record.source_page)
    page_img: Optional[Image.Image] = None
    
    with db._get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT filepath FROM extraction_jobs WHERE job_id = ?", (record.document_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Original PDF file not found")
        filepath = row["filepath"]
        
    doc = fitz.open(filepath)
    page = doc[record.source_page - 1]
    page_w = page.rect.width
    page_h = page.rect.height
    
    if page_img_path and page_img_path.exists():
        page_img = Image.open(page_img_path)
    else:
        page_img = render_page_to_image(doc, record.source_page, dpi=300)
    doc.close()
    
    bbox_dict = {
        "x": record.source_bbox.x,
        "y": record.source_bbox.y,
        "width": record.source_bbox.width,
        "height": record.source_bbox.height
    }
    
    card_img = crop_card_image(page_img, bbox_dict, page_w, page_h)
    
    buf = io.BytesIO()
    card_img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")

@router.get("/page-image/{job_id}/{page_number}")
async def get_full_page_image(job_id: str, page_number: int):
    """
    Returns the full rendered page image of the uploaded PDF for visual review.
    """
    page_img_path = get_page_image_path(job_id, page_number)
    if page_img_path and page_img_path.exists():
        with open(page_img_path, "rb") as f:
            return Response(content=f.read(), media_type="image/png")
            
    with db._get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT filepath FROM extraction_jobs WHERE job_id = ?", (job_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Original PDF file not found")
        filepath = row["filepath"]
        
    doc = fitz.open(filepath)
    img = render_page_to_image(doc, page_number, dpi=200)
    doc.close()
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")
