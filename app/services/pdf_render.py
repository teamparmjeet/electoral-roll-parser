import os
import fitz  # PyMuPDF
from PIL import Image
import io
from pathlib import Path
from typing import Optional, Tuple
from app.config import TEMP_DIR, DEFAULT_DPI

def render_page_to_image(
    doc: fitz.Document, 
    page_number: int, 
    dpi: int = DEFAULT_DPI
) -> Image.Image:
    """
    Renders a specific page (1-indexed) to a high-resolution PIL Image.
    Uses PyMuPDF matrix scaling: scale = dpi / 72.0
    """
    page_idx = page_number - 1
    if page_idx < 0 or page_idx >= len(doc):
        raise ValueError(f"Page number {page_number} out of range (1..{len(doc)})")
        
    page = doc[page_idx]
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    return img

def save_page_image_temp(
    job_id: str, 
    page_number: int, 
    img: Image.Image
) -> Path:
    """
    Saves a page image to temp job directory.
    """
    job_pages_dir = TEMP_DIR / job_id / "pages"
    job_pages_dir.mkdir(parents=True, exist_ok=True)
    out_path = job_pages_dir / f"page_{page_number}.png"
    img.save(out_path, format="PNG", optimize=True)
    return out_path

def get_page_image_path(job_id: str, page_number: int) -> Optional[Path]:
    path = TEMP_DIR / job_id / "pages" / f"page_{page_number}.png"
    return path if path.exists() else None

def crop_card_image(
    page_img: Image.Image,
    bbox: dict,
    page_pdf_width: float,
    page_pdf_height: float
) -> Image.Image:
    """
    Given a bbox in PDF coordinates {x, y, width, height}, crops the card from
    the high-res rendered page image by mapping PDF points to pixel coordinates.
    """
    img_w, img_h = page_img.size
    scale_x = img_w / page_pdf_width
    scale_y = img_h / page_pdf_height
    
    x0 = int(bbox["x"] * scale_x)
    y0 = int(bbox["y"] * scale_y)
    x1 = int((bbox["x"] + bbox["width"]) * scale_x)
    y1 = int((bbox["y"] + bbox["height"]) * scale_y)
    
    # Bound within image dimensions
    x0 = max(0, min(x0, img_w - 1))
    y0 = max(0, min(y0, img_h - 1))
    x1 = max(x0 + 1, min(x1, img_w))
    y1 = max(y0 + 1, min(y1, img_h))
    
    return page_img.crop((x0, y0, x1, y1))
