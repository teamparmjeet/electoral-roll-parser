import uuid
from typing import List, Dict, Any, Optional, Tuple
import fitz
from PIL import Image
from datetime import datetime

from app.models.record import VoterRecord, BoundingBox
from app.services.pdf_text import has_usable_native_text, extract_text_in_bbox
from app.services.card_detector import (
    detect_cards_from_vector_lines,
    detect_cards_from_image_cv,
    detect_cards_from_text_clusters,
    sort_cards_reading_order
)
from app.services.pdf_render import render_page_to_image, crop_card_image, save_page_image_temp
from app.services.ocr_service import extract_text_with_ocr
from app.services.field_extractor import parse_card_fields
from app.services.validator import is_summary_or_header_block, validate_record

class PageProcessingResult:
    def __init__(
        self,
        page_number: int,
        records: List[VoterRecord],
        is_ocr: bool,
        cards_detected_count: int,
        raw_text: str,
        error: Optional[str] = None
    ):
        self.page_number = page_number
        self.records = records
        self.is_ocr = is_ocr
        self.cards_detected_count = cards_detected_count
        self.raw_text = raw_text
        self.error = error

def process_page_records(
    doc: fitz.Document,
    page_number: int,
    job_id: str,
    filename: str,
    doc_header: Dict[str, Any],
    dpi: int = 300
) -> PageProcessingResult:
    """
    Processes a single page of an electoral roll:
    1. Check for native text layer
    2. Detect rectangular voter card regions
    3. Crop/extract each card independently (preventing neighbor contamination)
    4. Parse fields from each card
    5. Discard summary/header blocks
    6. Return structured VoterRecord list with source tracking and confidence
    """
    page_idx = page_number - 1
    page = doc[page_idx]
    page_w = page.rect.width
    page_h = page.rect.height
    
    use_native = has_usable_native_text(page)
    raw_page_text = page.get_text()
    
    # 1. Detect cards
    # Try vector lines first
    detected_rects = detect_cards_from_vector_lines(page)
    
    page_img: Optional[Image.Image] = None
    
    # If vector detection gave few or no cards, render page image and use CV
    if len(detected_rects) < 3:
        page_img = render_page_to_image(doc, page_number, dpi=dpi)
        cv_rects = detect_cards_from_image_cv(page_img, page_w, page_h)
        if len(cv_rects) >= len(detected_rects):
            detected_rects = cv_rects
            
    # If still few cards and native text exists, try text block anchors
    if len(detected_rects) < 3 and use_native:
        blocks = []
        raw_blocks = page.get_text("blocks")
        for b in raw_blocks:
            blocks.append({
                "bbox": (b[0], b[1], b[2], b[3]),
                "text": b[4]
            })
        cluster_rects = detect_cards_from_text_clusters(blocks, page_w, page_h)
        if len(cluster_rects) > len(detected_rects):
            detected_rects = cluster_rects
            
    # Always save page image to temp storage so UI can render preview & highlight bboxes
    if page_img is None:
        page_img = render_page_to_image(doc, page_number, dpi=dpi)
    save_page_image_temp(job_id, page_number, page_img)
    
    # Sort detected cards into true document reading order
    ordered_rects = sort_cards_reading_order(detected_rects, page_w)
    
    records: List[VoterRecord] = []
    is_ocr = not use_native
    now_str = datetime.utcnow().isoformat()
    
    # If this entire page is just a title or summary page (e.g. Page 1 or last revision table),
    # verify if any cards were found. If 0 cards, this is a title/header/summary page.
    if not ordered_rects:
        return PageProcessingResult(
            page_number=page_number,
            records=[],
            is_ocr=is_ocr,
            cards_detected_count=0,
            raw_text=raw_page_text
        )
        
    for idx, rect in enumerate(ordered_rects, start=1):
        card_text = ""
        method_used = "native"
        
        # Strategy: Native PDF text first
        if use_native:
            card_text = extract_text_in_bbox(page, rect)
            
        # If native text in this card is empty or very short, fallback to OCR on this card crop
        if not card_text or len(card_text.strip()) < 15:
            card_img = crop_card_image(page_img, rect, page_w, page_h)
            ocr_text = extract_text_with_ocr(card_img)
            if len(ocr_text.strip()) > len(card_text.strip()):
                card_text = ocr_text
                method_used = "ocr"
                is_ocr = True
                
        if not card_text or len(card_text.strip()) < 5:
            continue
            
        # Check if this card region is actually a summary table or header
        if is_summary_or_header_block(card_text):
            continue
            
        # Parse fields from the isolated card
        parsed = parse_card_fields(card_text)
        
        # Validate record
        is_valid, reasons = validate_record(parsed)
        if not is_valid:
            continue
            
        # Enrich with document header info if not present in card
        part_num = parsed.get("part_number")
        if part_num is None and doc_header.get("part_number"):
            try:
                part_num = int(doc_header["part_number"])
            except (ValueError, TypeError):
                pass
                
        # Generate clean VoterRecord
        bbox_obj = BoundingBox(
            x=round(rect["x"], 2),
            y=round(rect["y"], 2),
            width=round(rect["width"], 2),
            height=round(rect["height"], 2)
        )
        
        # Combine review reasons
        all_reasons = list(set(parsed.get("review_reasons", []) + reasons))
        needs_review = parsed.get("needs_review", False) or len(reasons) > 0
        status = "needs_review" if needs_review else "unverified"
        
        record = VoterRecord(
            id=str(uuid.uuid4()),
            document_id=job_id,
            source_file=filename,
            source_page=page_number,
            card_index=idx,
            source_bbox=bbox_obj,
            serial_number=parsed.get("serial_number"),
            part_number=part_num,
            voter_id=parsed.get("voter_id"),
            elector_name=parsed.get("elector_name"),
            relation_type=parsed.get("relation_type"),
            relation_name=parsed.get("relation_name"),
            house_number=parsed.get("house_number"),
            age=parsed.get("age"),
            gender=parsed.get("gender"),
            gender_original=parsed.get("gender_original"),
            photo_available=parsed.get("photo_available", False),
            section=doc_header.get("section"),
            assembly_constituency=doc_header.get("assembly_constituency"),
            polling_station=doc_header.get("polling_station"),
            raw_card_text=card_text,
            confidence=parsed.get("confidence", {}),
            needs_review=needs_review,
            review_reasons=all_reasons,
            verification_status=status,
            extraction_method=method_used,
            created_at=now_str,
            updated_at=now_str
        )
        records.append(record)
        
    return PageProcessingResult(
        page_number=page_number,
        records=records,
        is_ocr=is_ocr,
        cards_detected_count=len(ordered_rects),
        raw_text=raw_page_text
    )
