from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ExtractionJobStatus(BaseModel):
    job_id: str
    filename: str
    status: str  # 'queued', 'processing', 'completed', 'failed', 'cancelled'
    current_page: int = 0
    total_pages: int = 0
    cards_detected: int = 0
    records_extracted: int = 0
    records_processed: int = 0
    needs_review_count: int = 0
    verified_count: int = 0
    ocr_pages_count: int = 0
    errors_count: int = 0
    failed_pages: List[int] = Field(default_factory=list)
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: Optional[str] = None
    completed_at: Optional[str] = None

class PageRawInfo(BaseModel):
    page_number: int
    text_length: int
    is_ocr: bool
    cards_count: int
    raw_text_snippet: str
    has_error: bool = False
    error_message: Optional[str] = None
