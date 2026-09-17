import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import cv2
import numpy as np
from typing import Optional, Dict, Any
from app.config import TESSERACT_CMD, TESSERACT_LANGS

pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

def preprocess_image_for_ocr(img: Image.Image) -> Image.Image:
    """
    Enhances contrast and sharpens card image for accurate Hindi character recognition.
    """
    # Convert to grayscale
    gray = img.convert('L')
    
    # Increase contrast
    enhancer = ImageEnhance.Contrast(gray)
    contrast_img = enhancer.enhance(1.8)
    
    # Slight sharpening for crisp Devanagari matras (vowel signs)
    sharp_img = contrast_img.filter(ImageFilter.SHARPEN)
    return sharp_img

def extract_text_with_ocr(card_img: Image.Image, lang: str = TESSERACT_LANGS) -> str:
    """
    Runs Tesseract OCR on a cropped card image.
    Uses PSM 6 (single uniform block of text) with Hindi + English.
    """
    processed = preprocess_image_for_ocr(card_img)
    
    # Configure tesseract for uniform text block
    custom_config = r'--oem 3 --psm 6'
    try:
        text = pytesseract.image_to_string(processed, lang=lang, config=custom_config)
        return text.strip()
    except Exception as e:
        # Fallback to English only if Hindi model had transient issue
        try:
            return pytesseract.image_to_string(processed, lang='eng', config=custom_config).strip()
        except Exception:
            return ""

def ocr_page_to_data(page_img: Image.Image, lang: str = TESSERACT_LANGS) -> Dict[str, Any]:
    """
    Runs pytesseract.image_to_data to get word-level bounding boxes and confidence.
    """
    processed = preprocess_image_for_ocr(page_img)
    custom_config = r'--oem 3 --psm 4'
    try:
        data = pytesseract.image_to_data(processed, lang=lang, config=custom_config, output_type=pytesseract.Output.DICT)
        return data
    except Exception:
        return {}
