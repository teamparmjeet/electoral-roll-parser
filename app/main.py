from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api import upload, extraction, records, export
from app.config import TEMP_DIR, EXPORT_DIR, UPLOAD_DIR

app = FastAPI(
    title="Electoral PDF Data Extractor API",
    description="Real electoral roll PDF data extraction engine with card detection and Hindi OCR.",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(extraction.router, prefix="/api", tags=["Extraction"])
app.include_router(records.router, prefix="/api", tags=["Records"])
app.include_router(export.router, prefix="/api", tags=["Export"])

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "engine": "Electoral PDF Roll Extractor",
        "tesseract_hindi": True,
        "mode": "real_extraction_only"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
