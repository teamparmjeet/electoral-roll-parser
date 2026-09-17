import cv2
import numpy as np
import fitz
from typing import List, Dict, Tuple, Any
from PIL import Image

def detect_cards_from_vector_lines(page: fitz.Page) -> List[Dict[str, float]]:
    """
    Detects card boundary rectangles from PDF vector drawings / rects.
    Returns list of dicts: [{'x': x, 'y': y, 'width': w, 'height': h}]
    """
    rects = []
    page_w = page.rect.width
    page_h = page.rect.height
    
    # 1. Check page.get_drawings()
    drawings = page.get_drawings()
    for d in drawings:
        r = d.get("rect")
        if r:
            w = r.width
            h = r.height
            # An electoral card is typically ~25% to ~35% of page width (in 3 columns)
            # and ~8% to ~15% of page height (8 to 10 rows)
            if (0.15 * page_w <= w <= 0.45 * page_w) and (0.05 * page_h <= h <= 0.25 * page_h):
                rects.append({
                    "x": float(r.x0),
                    "y": float(r.y0),
                    "width": float(w),
                    "height": float(h)
                })
                
    # Remove overlapping duplicate rects
    filtered_rects = deduplicate_rectangles(rects)
    return filtered_rects

def detect_cards_from_image_cv(page_img: Image.Image, page_pdf_w: float, page_pdf_h: float) -> List[Dict[str, float]]:
    """
    Uses OpenCV morphological operations to detect table grid and rectangular card contours
    from a rendered page image, then translates coordinates back into PDF points.
    """
    # Convert PIL Image to OpenCV BGR then grayscale
    open_cv_image = np.array(page_img.convert('RGB'))
    open_cv_image = open_cv_image[:, :, ::-1].copy()
    gray = cv2.cvtColor(open_cv_image, cv2.COLOR_BGR2GRAY)
    
    img_h, img_w = gray.shape
    scale_x = page_pdf_w / img_w
    scale_y = page_pdf_h / img_h
    
    # Binary thresholding
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    
    # Define morphological kernels for horizontal and vertical lines
    horiz_kernel_len = max(20, img_w // 40)
    vert_kernel_len = max(20, img_h // 50)
    
    horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (horiz_kernel_len, 1))
    vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, vert_kernel_len))
    
    # Extract horizontal lines
    horiz_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horiz_kernel)
    
    # Extract vertical lines
    vert_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vert_kernel)
    
    # Combine horizontal and vertical lines to form the table grid
    grid = cv2.addWeighted(horiz_lines, 0.5, vert_lines, 0.5, 0.0)
    _, grid = cv2.threshold(grid, 40, 255, cv2.THRESH_BINARY)
    
    # Find external or tree contours
    contours, _ = cv2.findContours(grid, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    rects = []
    min_w = int(img_w * 0.15)
    max_w = int(img_w * 0.45)
    min_h = int(img_h * 0.05)
    max_h = int(img_h * 0.25)
    
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if min_w <= w <= max_w and min_h <= h <= max_h:
            # Map back to PDF point dimensions
            rects.append({
                "x": float(x * scale_x),
                "y": float(y * scale_y),
                "width": float(w * scale_x),
                "height": float(h * scale_y)
            })
            
    return deduplicate_rectangles(rects)

def detect_cards_from_text_clusters(
    text_blocks: List[Dict[str, Any]], 
    page_w: float, 
    page_h: float
) -> List[Dict[str, float]]:
    """
    Fallback when borders are not visible:
    Finds anchor text blocks (e.g. voter labels like 'निर्वाचक का नाम' or EPIC numbers)
    and estimates card boundary boxes based on 3-column or 2-column layout.
    """
    anchors = []
    for b in text_blocks:
        text = b.get("text", "")
        if "निर्वाचक का नाम" in text or "मतदाता का नाम" in text or "Name:" in text:
            anchors.append(b)
            
    if not anchors:
        return []
        
    # Typical voter card dimensions in standard Indian electoral roll (A4: 595 x 842 pt)
    # 3 columns: width approx 180-195 pt, height approx 75-85 pt
    col_width = (page_w - 40) / 3.0
    card_h = 82.0
    
    rects = []
    for a in anchors:
        # Bounding box around anchor
        ax = a["bbox"][0]
        ay = a["bbox"][1]
        
        # Determine which column (0, 1, or 2)
        col_idx = 0
        if ax > page_w * 0.60:
            col_idx = 2
        elif ax > page_w * 0.30:
            col_idx = 1
            
        cx = 20.0 + col_idx * col_width
        cy = max(0.0, ay - 15.0)  # Account for top voter ID line
        rects.append({
            "x": float(cx),
            "y": float(cy),
            "width": float(col_width - 4.0),
            "height": float(card_h)
        })
        
    return deduplicate_rectangles(rects)

def deduplicate_rectangles(rects: List[Dict[str, float]], threshold_px: float = 12.0) -> List[Dict[str, float]]:
    """
    Removes nearly identical overlapping bounding boxes.
    """
    unique = []
    for r in rects:
        is_dup = False
        for u in unique:
            if (abs(r["x"] - u["x"]) < threshold_px and 
                abs(r["y"] - u["y"]) < threshold_px and
                abs(r["width"] - u["width"]) < threshold_px and
                abs(r["height"] - u["height"]) < threshold_px):
                is_dup = True
                break
        if not is_dup:
            unique.append(r)
            
    return unique

def sort_cards_reading_order(rects: List[Dict[str, float]], page_w: float) -> List[Dict[str, float]]:
    """
    Sorts detected cards into true document reading order.
    In standard Indian electoral rolls, cards are ordered:
    Row by row: Card 1 (Col 1), Card 2 (Col 2), Card 3 (Col 3), Card 4 (Row 2 Col 1)...
    OR column by column.
    We identify rows by grouping y within ~15pt tolerance, and sort by x within each row.
    """
    if not rects:
        return []
        
    # Group into rows
    sorted_by_y = sorted(rects, key=lambda r: r["y"])
    rows = []
    current_row = [sorted_by_y[0]]
    current_y = sorted_by_y[0]["y"]
    
    for r in sorted_by_y[1:]:
        if abs(r["y"] - current_y) < 18.0:
            current_row.append(r)
        else:
            rows.append(current_row)
            current_row = [r]
            current_y = r["y"]
    if current_row:
        rows.append(current_row)
        
    # Sort each row from left to right (by x)
    final_sorted = []
    for row in rows:
        sorted_row = sorted(row, key=lambda r: r["x"])
        final_sorted.extend(sorted_row)
        
    return final_sorted
