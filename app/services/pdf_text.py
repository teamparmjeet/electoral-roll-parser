import fitz
from typing import List, Dict, Any, Optional, Tuple

def has_usable_native_text(page: fitz.Page) -> bool:
    """
    Checks if page has reliable native text layer with Devanagari or English words.
    If text length is very low or only contains garbage characters, returns False.
    """
    text = page.get_text()
    if not text or len(text.strip()) < 50:
        return False
        
    # Check for Devanagari characters or key electoral words
    devanagari_chars = sum(1 for c in text if '\u0900' <= c <= '\u097F')
    if devanagari_chars > 20:
        return True
        
    # Check for English electoral words if roll is English
    if any(k in text for k in ["Elector", "Voter", "Father", "Husband", "House", "Age", "Gender"]):
        return True
        
    return False

def extract_text_in_bbox(page: fitz.Page, bbox: Dict[str, float]) -> str:
    """
    Extracts text strictly inside the card bounding box.
    This guarantees NEIGHBOR DATA PROTECTION: no text outside the card
    is included in this card's extraction.
    """
    rect = fitz.Rect(bbox["x"], bbox["y"], bbox["x"] + bbox["width"], bbox["y"] + bbox["height"])
    # get_textbox extracts text strictly inside rect
    text = page.get_textbox(rect)
    return text.strip()

def extract_document_header_info(page: fitz.Page) -> Dict[str, Optional[str]]:
    """
    Extracts overall roll context (Assembly Constituency, Part Number, Section, etc.)
    typically found on page 1 or the top header of subsequent pages.
    """
    header_info = {
        "assembly_constituency": None,
        "part_number": None,
        "section": None,
        "polling_station": None
    }
    
    text = page.get_text()
    if not text:
        return header_info
        
    import re
    # Part number
    m_part = re.search(r"(?:भाग\s*संख्या|Part\s*No\.?)\s*[:\-\s]*([०-९0-9]+)", text)
    if m_part:
        from app.services.confidence import normalize_devanagari_numbers
        header_info["part_number"] = normalize_devanagari_numbers(m_part.group(1))
        
    # Assembly constituency
    m_ac = re.search(r"(?:विधानसभा\s*निर्वाचन\s*क्षेत्र|Assembly\s*Constituency)\s*[:\-\s]*([^\n\r]+)", text)
    if m_ac:
        header_info["assembly_constituency"] = m_ac.group(1).strip()
        
    # Section
    m_sec = re.search(r"(?:अनुभाग\s*संख्या|Section\s*No\.?)\s*[:\-\s]*([^\n\r]+)", text)
    if m_sec:
        header_info["section"] = m_sec.group(1).strip()
        
    return header_info
