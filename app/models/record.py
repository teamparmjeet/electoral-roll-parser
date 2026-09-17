from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float

class ConfidenceScores(BaseModel):
    serial_number: float = 1.0
    voter_id: float = 1.0
    elector_name: float = 1.0
    relation_name: float = 1.0
    house_number: float = 1.0
    age: float = 1.0
    gender: float = 1.0

class VoterRecord(BaseModel):
    id: str
    document_id: str
    source_file: str
    source_page: int
    card_index: int
    source_bbox: Optional[BoundingBox] = None
    
    serial_number: Optional[int] = None
    part_number: Optional[int] = None
    voter_id: Optional[str] = None
    elector_name: Optional[str] = None
    relation_type: Optional[str] = None  # 'father', 'husband', 'mother', 'other'
    relation_name: Optional[str] = None
    house_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None  # 'male', 'female', 'third_gender'
    gender_original: Optional[str] = None  # 'पुरुष', 'महिला', 'तृतीय लिंग'
    photo_available: bool = False
    
    # Optional fields if clearly present in the document
    section: Optional[str] = None
    address: Optional[str] = None
    assembly_constituency: Optional[str] = None
    polling_station: Optional[str] = None
    
    # Internal integrity and review tracking
    raw_card_text: Optional[str] = None
    confidence: Dict[str, float] = Field(default_factory=dict)
    needs_review: bool = False
    review_reasons: list[str] = Field(default_factory=list)
    verification_status: str = "unverified"  # 'unverified', 'verified', 'needs_review'
    extraction_method: str = "native"  # 'native' or 'ocr'
    
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class RecordUpdate(BaseModel):
    serial_number: Optional[int] = None
    part_number: Optional[int] = None
    voter_id: Optional[str] = None
    elector_name: Optional[str] = None
    relation_type: Optional[str] = None
    relation_name: Optional[str] = None
    house_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    gender_original: Optional[str] = None
    photo_available: Optional[bool] = None
    verification_status: Optional[str] = None
    needs_review: Optional[bool] = None
