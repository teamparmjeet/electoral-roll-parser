from typing import Dict, Any, List, Tuple
import re

# Words and phrases that indicate a summary table or non-voter section
SUMMARY_TABLE_KEYWORDS = [
    "कुल निर्वाचक",
    "संशोधनों की संख्या",
    "घटक - परिवर्तन सूची",
    "घटक II - विलोपन सूची",
    "घटक III - संशोधन सूची",
    "मतदान केंद्र का नाम",
    "अनुभाग संख्या",
    "आरंभिक क्रम संख्या",
    "अंतिम क्रम संख्या",
    "विस्तार सारांश",
    "लिंगवार सारांश",
    "पुरुषों की संख्या",
    "महिलाओं की संख्या",
    "कुल मतदाताओं की संख्या"
]

def is_summary_or_header_block(text: str) -> bool:
    """
    Check if a text block belongs to a summary table, statistics section,
    or section header rather than an individual voter card.
    """
    if not text:
        return True
    
    clean_text = text.strip()
    
    # Check if contains pure summary keywords
    for kw in SUMMARY_TABLE_KEYWORDS:
        if kw in clean_text:
            return True
            
    # Check if text is just "पुरुष महिला तृतीय लिंग कुल" without any name or relation
    has_name_label = any(k in clean_text for k in ["निर्वाचक का नाम", "मतदाता का नाम", "Name:"])
    has_relation_label = any(k in clean_text for k in ["पिता का नाम", "पति का नाम", "माता का नाम", "Father's Name"])
    
    # If it contains summary words and lacks voter name/relation, it's definitely summary
    if ("कुल" in clean_text or "योग" in clean_text) and not (has_name_label or has_relation_label):
        return True
        
    return False

def validate_record(record_dict: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validates a candidate voter record.
    Returns (is_valid_record, list_of_review_reasons).
    A card is a valid record only if sufficient evidence exists (e.g. at least name or voter ID).
    """
    reasons = []
    
    name = record_dict.get("elector_name")
    voter_id = record_dict.get("voter_id")
    serial_no = record_dict.get("serial_number")
    relation_name = record_dict.get("relation_name")
    age = record_dict.get("age")
    gender = record_dict.get("gender")
    
    # Check if this has enough voter evidence
    has_voter_evidence = bool(name or voter_id or (relation_name and age))
    if not has_voter_evidence:
        return False, ["Insufficient evidence to qualify as voter card"]
        
    # Validation checks for individual fields
    if not name:
        reasons.append("Missing elector name")
        
    if not voter_id:
        reasons.append("Missing or unreadable voter ID")
        
    if age is None:
        reasons.append("Missing or unreadable age")
    elif not (18 <= age <= 120):
        reasons.append(f"Age {age} is outside expected range (18-120)")
        
    if not gender:
        reasons.append("Missing or unreadable gender")
        
    if serial_no is None:
        reasons.append("Missing serial number")
        
    return True, reasons
