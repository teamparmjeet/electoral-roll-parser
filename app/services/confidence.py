from typing import Dict, Any, Tuple
import re

# Devanagari numerals to standard numerals map
DEVANAGARI_DIGITS = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
}

def normalize_devanagari_numbers(text: str) -> str:
    """Converts any Devanagari numerals to standard ASCII digits."""
    if not text:
        return text
    res = []
    for ch in text:
        res.append(DEVANAGARI_DIGITS.get(ch, ch))
    return "".join(res)

def calculate_field_confidence(field_name: str, value: Any, raw_context: str = "") -> Tuple[float, bool, str]:
    """
    Returns (confidence_score, needs_review, reason)
    Confidence tiers:
    >= 0.95: High confidence
    0.85 - 0.94: Medium confidence
    < 0.85: Needs review
    """
    if value is None:
        return 0.0, True, f"{field_name} could not be extracted"
        
    s_val = str(value).strip()
    if not s_val:
        return 0.0, True, f"{field_name} is empty"

    if field_name == "age":
        try:
            val_int = int(s_val)
            if 18 <= val_int <= 120:
                return 0.99, False, ""
            elif 0 < val_int < 18:
                return 0.70, True, "Age is unusually low (< 18)"
            else:
                return 0.40, True, "Age is out of realistic human range"
        except ValueError:
            return 0.0, True, "Age is non-numeric"

    elif field_name == "serial_number":
        try:
            val_int = int(s_val)
            if val_int > 0:
                return 0.98, False, ""
            return 0.60, True, "Serial number is zero or negative"
        except ValueError:
            return 0.0, True, "Serial number is non-numeric"

    elif field_name == "voter_id":
        # Check standard EPIC pattern: 3 uppercase letters followed by 7 digits
        # Also allow known variants like State/District/Part codes
        epic_match = re.match(r"^[A-Z]{3}[0-9]{7}$", s_val)
        if epic_match:
            return 0.98, False, ""
            
        # Check if contains OCR uncertainty characters like ? or weird symbols
        if "?" in s_val or "!" in s_val or "_" in s_val:
            return 0.65, True, "Voter ID contains uncertain or corrupt characters"
            
        # Check if generic alphanumeric 8-16 chars
        if re.match(r"^[A-Z0-9/\-]{8,16}$", s_val):
            return 0.88, False, ""
            
        return 0.70, True, "Voter ID does not match expected format"

    elif field_name == "elector_name":
        # Must have at least 2 characters and no obvious garbage
        if len(s_val) < 2:
            return 0.50, True, "Name is too short"
        if "?" in s_val or "\ufffd" in s_val:
            return 0.65, True, "Name contains OCR artifact characters"
        # Check if predominantly letters (Devanagari or Latin)
        has_letters = bool(re.search(r"[\u0900-\u097F\w]", s_val))
        if not has_letters:
            return 0.30, True, "Name has no valid characters"
        return 0.96, False, ""

    elif field_name == "relation_name":
        if len(s_val) < 2:
            return 0.50, True, "Relation name is too short"
        if "?" in s_val or "\ufffd" in s_val:
            return 0.65, True, "Relation name contains OCR artifact characters"
        return 0.95, False, ""

    elif field_name == "gender":
        if s_val in ["male", "female", "third_gender"]:
            return 0.98, False, ""
        return 0.60, True, "Unknown gender value"

    elif field_name == "house_number":
        if "?" in s_val:
            return 0.75, True, "House number contains uncertain character"
        return 0.95, False, ""

    return 0.90, False, ""

def compute_record_confidence(parsed_record: Dict[str, Any]) -> Dict[str, float]:
    """Computes field-level and overall confidence scores for a parsed record."""
    fields = ["serial_number", "voter_id", "elector_name", "relation_name", "house_number", "age", "gender"]
    scores = {}
    total = 0.0
    count = 0
    for f in fields:
        val = parsed_record.get(f)
        score, _, _ = calculate_field_confidence(f, val)
        scores[f] = round(score, 2)
        total += score
        count += 1
    scores["overall"] = round(total / count if count > 0 else 0.0, 2)
    return scores

