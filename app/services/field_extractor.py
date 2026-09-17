import re
from typing import Dict, Any, Optional, Tuple
from app.services.confidence import normalize_devanagari_numbers, calculate_field_confidence

# Regex patterns for Hindi electoral labels
NAME_LABELS = [
    r"निर्वाचक\s*का\s*नाम",
    r"मतदाता\s*का\s*नाम",
    r"नाम\s*[:\-\s]",
    r"Elector['’]?s?\s*Name"
]

RELATION_FATHER_LABELS = [
    r"पिता\s*का\s*नाम",
    r"Father['’]?s?\s*Name"
]

RELATION_HUSBAND_LABELS = [
    r"पति\s*का\s*नाम",
    r"Husband['’]?s?\s*Name"
]

RELATION_MOTHER_LABELS = [
    r"माता\s*का\s*नाम",
    r"Mother['’]?s?\s*Name"
]

RELATION_OTHER_LABELS = [
    r"संरक्षक\s*का\s*नाम",
    r"अन्य\s*[:\-\s]",
    r"Guardian['’]?s?\s*Name"
]

HOUSE_LABELS = [
    r"गृह\s*संख्या",
    r"मकान\s*संख्या",
    r"मकान\s*नं",
    r"गृह\s*क्रमांक",
    r"House\s*No"
]

AGE_LABELS = [
    r"उम्र\s*[:\-\s]",
    r"आयु\s*[:\-\s]",
    r"Age\s*[:\-\s]"
]

GENDER_LABELS = [
    r"लिंग\s*[:\-\s]",
    r"Gender\s*[:\-\s]"
]

def clean_extracted_value(val: Optional[str]) -> Optional[str]:
    if val is None:
        return None
    # Remove leading colons, dashes, extra spaces
    cleaned = re.sub(r"^[\s:\-\.=]+", "", val).strip()
    cleaned = re.sub(r"[\s:\-\.=]+$", "", cleaned).strip()
    # Normalize multiple whitespace characters
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned if cleaned else None

def extract_voter_id(text: str) -> Optional[str]:
    """
    Extracts the Voter ID (EPIC number) from the top area of the card.
    Standard format: 3 letters + 7 digits (e.g. IQT3150893, TWB1234567, RJ/12/345/67890).
    Never invents missing characters. If questionable, returns what is present.
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return None
        
    # Search in all lines, giving priority to top lines
    for line in lines[:3]:
        # 3 letters + 7 digits
        m = re.search(r"\b([A-Z]{3}[0-9]{7})\b", line)
        if m:
            return m.group(1)
            
        # 3 letters + space + 7 digits (OCR split)
        m_space = re.search(r"\b([A-Z]{3})\s+([0-9]{7})\b", line)
        if m_space:
            return f"{m_space.group(1)}{m_space.group(2)}"
            
        # State slash pattern (e.g. RJ/01/023/123456 or similar)
        m_slash = re.search(r"\b([A-Z]{2,3}/[0-9]{1,3}/[0-9]{1,4}/[0-9]{3,7})\b", line)
        if m_slash:
            return m_slash.group(1)
            
        # Generic alphanumeric EPIC pattern: 3 uppercase letters + 6-8 digits
        m_gen = re.search(r"\b([A-Z]{2,4}[0-9]{6,8})\b", line)
        if m_gen:
            return m_gen.group(1)
            
    # If not found in top 3 lines, search whole card
    m = re.search(r"\b([A-Z]{3}[0-9]{7})\b", text)
    if m:
        return m.group(1)
        
    return None

def extract_serial_number(text: str) -> Optional[int]:
    """
    Extracts the record serial number. Usually appears in top-left or top-right
    as a standalone 1-4 digit number, or prefixed with '#' or 'क्रमांक'.
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return None
        
    # Check first 2 lines
    for line in lines[:2]:
        # Look for explicit label e.g. "क. सं. 125" or "क्रम संख्या : 125"
        m_lbl = re.search(r"(?:क[0-9]?\.\s*सं|क्रम\s*संख्या|क्रमांक|S\.?\s*No\.?)\s*[:\-\s]*([०-९0-9]+)", line)
        if m_lbl:
            val = normalize_devanagari_numbers(m_lbl.group(1))
            try:
                return int(val)
            except ValueError:
                pass
                
        # Look for isolated number at beginning of top line: e.g. "125  IQT3150893"
        m_iso = re.match(r"^([०-९0-9]{1,5})\b", line)
        if m_iso:
            val = normalize_devanagari_numbers(m_iso.group(1))
            try:
                return int(val)
            except ValueError:
                pass
                
    return None

def extract_elector_name(text: str) -> Optional[str]:
    """
    Extracts elector's name following labels like 'निर्वाचक का नाम' or 'Name:'.
    Stops before next label (e.g. पिता का नाम, पति का नाम).
    """
    for pattern in NAME_LABELS:
        # Match from label to end of line or next known label
        regex = pattern + r"\s*[:\-\s]\s*([^\n\r]+)"
        match = re.search(regex, text, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            # Stop if the line leaked into next label
            for stop_word in ["पिता", "पति", "माता", "गृह", "मकान", "उम्र", "लिंग", "Father", "Husband", "House", "Age"]:
                if stop_word in candidate:
                    candidate = candidate.split(stop_word)[0].strip()
            return clean_extracted_value(candidate)
            
    return None

def extract_relation(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Detects relation_type ('father', 'husband', 'mother', 'other') and relation_name.
    """
    relation_type = None
    relation_name = None
    
    # Check Father
    for pattern in RELATION_FATHER_LABELS:
        regex = pattern + r"\s*[:\-\s]\s*([^\n\r]+)"
        match = re.search(regex, text, re.IGNORECASE)
        if match:
            relation_type = "father"
            relation_name = match.group(1)
            break
            
    # Check Husband
    if not relation_type:
        for pattern in RELATION_HUSBAND_LABELS:
            regex = pattern + r"\s*[:\-\s]\s*([^\n\r]+)"
            match = re.search(regex, text, re.IGNORECASE)
            if match:
                relation_type = "husband"
                relation_name = match.group(1)
                break
                
    # Check Mother
    if not relation_type:
        for pattern in RELATION_MOTHER_LABELS:
            regex = pattern + r"\s*[:\-\s]\s*([^\n\r]+)"
            match = re.search(regex, text, re.IGNORECASE)
            if match:
                relation_type = "mother"
                relation_name = match.group(1)
                break

    # Check Other / Guardian
    if not relation_type:
        for pattern in RELATION_OTHER_LABELS:
            regex = pattern + r"\s*[:\-\s]\s*([^\n\r]+)"
            match = re.search(regex, text, re.IGNORECASE)
            if match:
                relation_type = "other"
                relation_name = match.group(1)
                break

    if relation_name:
        for stop_word in ["गृह", "मकान", "उम्र", "लिंग", "House", "Age", "Gender"]:
            if stop_word in relation_name:
                relation_name = relation_name.split(stop_word)[0].strip()
        relation_name = clean_extracted_value(relation_name)
        
    return relation_type, relation_name

def extract_house_number(text: str) -> Optional[str]:
    """
    Extracts house number from labels like 'गृह संख्या:' or 'मकान संख्या:'.
    Converts Devanagari numerals to standard digits.
    """
    for pattern in HOUSE_LABELS:
        regex = pattern + r"\s*[:\-\s]\s*([^\n\r]+)"
        match = re.search(regex, text, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            # Stop if leaks into Age or Gender
            for stop_word in ["उम्र", "आयु", "लिंग", "Age", "Gender"]:
                if stop_word in candidate:
                    candidate = candidate.split(stop_word)[0].strip()
            val = normalize_devanagari_numbers(candidate)
            return clean_extracted_value(val)
            
    return None

def extract_age(text: str) -> Optional[int]:
    """
    Extracts age. Must be a valid integer between 1 and 120.
    Converts Devanagari numerals.
    If uncertain, returns None.
    """
    for pattern in AGE_LABELS:
        regex = pattern + r"\s*[:\-\s]*([०-९0-9\?]+)"
        match = re.search(regex, text, re.IGNORECASE)
        if match:
            raw_age_str = match.group(1).strip()
            # If contains '?' or OCR error, return None
            if "?" in raw_age_str or not raw_age_str:
                return None
            norm = normalize_devanagari_numbers(raw_age_str)
            try:
                age_int = int(norm)
                return age_int if 0 < age_int <= 120 else None
            except ValueError:
                return None
                
    # Search standalone age pattern like 'उम्र 30'
    m_stand = re.search(r"(?:उम्र|आयु)\s*([०-९0-9]{2})\b", text)
    if m_stand:
        norm = normalize_devanagari_numbers(m_stand.group(1))
        try:
            return int(norm)
        except ValueError:
            return None
            
    return None

def extract_gender(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts gender. Returns (normalized_gender, original_gender).
    Normalized values: 'male', 'female', 'third_gender'
    Original values: 'पुरुष', 'महिला', 'तृतीय लिंग'
    """
    # Check for direct gender mentions
    if re.search(r"\b(?:तृतीय\s*लिंग|अन्य\s*लिंग|Transgender)\b", text):
        return "third_gender", "तृतीय लिंग"
        
    if re.search(r"\b(?:महिला|स्त्री|Female|F)\b", text):
        return "female", "महिला"
        
    if re.search(r"\b(?:पुरुष|Male|M)\b", text):
        return "male", "पुरुष"
        
    # Check with label 'लिंग :'
    for pattern in GENDER_LABELS:
        regex = pattern + r"\s*[:\-\s]*([^\s\n\r]+)"
        match = re.search(regex, text, re.IGNORECASE)
        if match:
            val = match.group(1).strip()
            if "महि" in val or "स्त्री" in val or val == "F":
                return "female", "महिला"
            if "पुरु" in val or val == "M":
                return "male", "पुरुष"
            if "तृतीय" in val:
                return "third_gender", "तृतीय लिंग"
                
    return None, None

def extract_photo_available(text: str) -> bool:
    """
    Detects if the card indicates 'फोटो उपलब्ध' (Photo Available).
    """
    if "फोटो उपलब्ध" in text or "Photo Available" in text:
        return True
    return False

def parse_card_fields(raw_text: str) -> Dict[str, Any]:
    """
    Parses all structured fields from a single card's text.
    Computes confidence scores and review flags.
    """
    norm_text = normalize_devanagari_numbers(raw_text)
    
    serial_no = extract_serial_number(raw_text)
    voter_id = extract_voter_id(raw_text)
    name = extract_elector_name(raw_text)
    relation_type, relation_name = extract_relation(raw_text)
    house_no = extract_house_number(raw_text)
    age = extract_age(raw_text)
    gender, gender_orig = extract_gender(raw_text)
    photo_avail = extract_photo_available(raw_text)
    
    # Calculate field confidence and review reasons
    confidences = {}
    review_reasons = []
    
    fields_to_check = [
        ("serial_number", serial_no),
        ("voter_id", voter_id),
        ("elector_name", name),
        ("relation_name", relation_name),
        ("house_number", house_no),
        ("age", age),
        ("gender", gender)
    ]
    
    needs_review = False
    for f_name, f_val in fields_to_check:
        score, f_review, reason = calculate_field_confidence(f_name, f_val, raw_text)
        confidences[f_name] = score
        if f_review:
            needs_review = True
            if reason:
                review_reasons.append(reason)
                
    # If key fields are missing or low confidence, mark needs_review
    verification_status = "needs_review" if needs_review else "unverified"
    
    return {
        "serial_number": serial_no,
        "part_number": None,
        "voter_id": voter_id,
        "elector_name": name,
        "relation_type": relation_type,
        "relation_name": relation_name,
        "house_number": house_no,
        "age": age,
        "gender": gender,
        "gender_original": gender_orig,
        "photo_available": photo_avail,
        "confidence": confidences,
        "needs_review": needs_review,
        "review_reasons": review_reasons,
        "verification_status": verification_status,
        "raw_card_text": raw_text
    }
