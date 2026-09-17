import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
TEMP_DIR = BASE_DIR / "temp"
EXPORT_DIR = BASE_DIR / "exports"

# Ensure directories exist
for directory in [UPLOAD_DIR, TEMP_DIR, EXPORT_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Processing Configuration
DEFAULT_DPI = int(os.environ.get("PDF_DEFAULT_DPI", 300))
ALLOWED_DPIS = [200, 300, 400, 600]

# Confidence Thresholds
CONFIDENCE_HIGH = 0.95
CONFIDENCE_MEDIUM = 0.85

# OCR Settings
TESSERACT_CMD = os.environ.get("TESSERACT_CMD", "tesseract")
TESSERACT_LANGS = "hin+eng"

# SQLite DB Path
DATABASE_PATH = BASE_DIR / "electoral_extractor.db"

# Max Upload Size (500MB)
MAX_UPLOAD_SIZE = 500 * 1024 * 1024
