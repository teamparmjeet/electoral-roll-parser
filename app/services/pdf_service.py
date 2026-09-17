import os
import gc
import sqlite3
import json
import threading
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import fitz  # PyMuPDF

from app.config import DATABASE_PATH, UPLOAD_DIR, TEMP_DIR, DEFAULT_DPI
from app.models.record import VoterRecord, BoundingBox
from app.models.extraction import ExtractionJobStatus, PageRawInfo
from app.services.pdf_text import extract_document_header_info
from app.services.record_parser import process_page_records

class DatabaseManager:
    """Manages SQLite tables for jobs, records, and raw pages."""
    def __init__(self, db_path: Path = DATABASE_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            # Jobs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS extraction_jobs (
                    job_id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    filepath TEXT NOT NULL,
                    status TEXT NOT NULL,
                    current_page INTEGER DEFAULT 0,
                    total_pages INTEGER DEFAULT 0,
                    cards_detected INTEGER DEFAULT 0,
                    records_extracted INTEGER DEFAULT 0,
                    records_processed INTEGER DEFAULT 0,
                    needs_review_count INTEGER DEFAULT 0,
                    verified_count INTEGER DEFAULT 0,
                    ocr_pages_count INTEGER DEFAULT 0,
                    errors_count INTEGER DEFAULT 0,
                    failed_pages TEXT DEFAULT '[]',
                    errors TEXT DEFAULT '[]',
                    created_at TEXT,
                    completed_at TEXT
                )
            """)
            # Records table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS voter_records (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    source_file TEXT NOT NULL,
                    source_page INTEGER NOT NULL,
                    card_index INTEGER NOT NULL,
                    serial_number INTEGER,
                    part_number INTEGER,
                    voter_id TEXT,
                    elector_name TEXT,
                    relation_type TEXT,
                    relation_name TEXT,
                    house_number TEXT,
                    age INTEGER,
                    gender TEXT,
                    gender_original TEXT,
                    photo_available INTEGER DEFAULT 0,
                    section TEXT,
                    assembly_constituency TEXT,
                    polling_station TEXT,
                    source_bbox TEXT,
                    raw_card_text TEXT,
                    confidence TEXT,
                    needs_review INTEGER DEFAULT 0,
                    review_reasons TEXT DEFAULT '[]',
                    verification_status TEXT DEFAULT 'unverified',
                    extraction_method TEXT DEFAULT 'native',
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            # Raw pages info
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS page_raw_info (
                    job_id TEXT,
                    page_number INTEGER,
                    is_ocr INTEGER,
                    cards_count INTEGER,
                    raw_text TEXT,
                    error_message TEXT,
                    PRIMARY KEY (job_id, page_number)
                )
            """)
            conn.commit()

    def save_job(self, job: ExtractionJobStatus, filepath: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO extraction_jobs (
                    job_id, filename, filepath, status, current_page, total_pages,
                    cards_detected, records_extracted, records_processed,
                    needs_review_count, verified_count, ocr_pages_count, errors_count,
                    failed_pages, errors, created_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                job.job_id, job.filename, filepath, job.status, job.current_page,
                job.total_pages, job.cards_detected, job.records_extracted,
                job.records_processed, job.needs_review_count, job.verified_count,
                job.ocr_pages_count, job.errors_count, json.dumps(job.failed_pages),
                json.dumps(job.errors), job.created_at, job.completed_at
            ))
            conn.commit()

    def update_job_progress(self, job: ExtractionJobStatus):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE extraction_jobs SET
                    status = ?, current_page = ?, cards_detected = ?,
                    records_extracted = ?, records_processed = ?,
                    needs_review_count = ?, verified_count = ?,
                    ocr_pages_count = ?, errors_count = ?,
                    failed_pages = ?, errors = ?, completed_at = ?
                WHERE job_id = ?
            """, (
                job.status, job.current_page, job.cards_detected,
                job.records_extracted, job.records_processed,
                job.needs_review_count, job.verified_count,
                job.ocr_pages_count, job.errors_count,
                json.dumps(job.failed_pages), json.dumps(job.errors),
                job.completed_at, job.job_id
            ))
            conn.commit()

    def get_job(self, job_id: str) -> Optional[ExtractionJobStatus]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM extraction_jobs WHERE job_id = ?", (job_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return ExtractionJobStatus(
                job_id=row["job_id"],
                filename=row["filename"],
                status=row["status"],
                current_page=row["current_page"],
                total_pages=row["total_pages"],
                cards_detected=row["cards_detected"],
                records_extracted=row["records_extracted"],
                records_processed=row["records_processed"],
                needs_review_count=row["needs_review_count"],
                verified_count=row["verified_count"],
                ocr_pages_count=row["ocr_pages_count"],
                errors_count=row["errors_count"],
                failed_pages=json.loads(row["failed_pages"] or "[]"),
                errors=json.loads(row["errors"] or "[]"),
                created_at=row["created_at"],
                completed_at=row["completed_at"]
            )

    def save_records(self, records: List[VoterRecord]):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for r in records:
                cursor.execute("""
                    INSERT OR REPLACE INTO voter_records (
                        id, document_id, source_file, source_page, card_index,
                        serial_number, part_number, voter_id, elector_name,
                        relation_type, relation_name, house_number, age,
                        gender, gender_original, photo_available, section,
                        assembly_constituency, polling_station, source_bbox,
                        raw_card_text, confidence, needs_review, review_reasons,
                        verification_status, extraction_method, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    r.id, r.document_id, r.source_file, r.source_page, r.card_index,
                    r.serial_number, r.part_number, r.voter_id, r.elector_name,
                    r.relation_type, r.relation_name, r.house_number, r.age,
                    r.gender, r.gender_original, 1 if r.photo_available else 0,
                    r.section, r.assembly_constituency, r.polling_station,
                    json.dumps(r.source_bbox.model_dump()) if r.source_bbox else None,
                    r.raw_card_text, json.dumps(r.confidence),
                    1 if r.needs_review else 0, json.dumps(r.review_reasons),
                    r.verification_status, r.extraction_method, r.created_at, r.updated_at
                ))
            conn.commit()

    def get_records(self, job_id: str) -> List[VoterRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM voter_records WHERE document_id = ? ORDER BY source_page, card_index", (job_id,))
            rows = cursor.fetchall()
            records = []
            for row in rows:
                bbox = None
                if row["source_bbox"]:
                    b_dict = json.loads(row["source_bbox"])
                    bbox = BoundingBox(**b_dict)
                records.append(VoterRecord(
                    id=row["id"],
                    document_id=row["document_id"],
                    source_file=row["source_file"],
                    source_page=row["source_page"],
                    card_index=row["card_index"],
                    serial_number=row["serial_number"],
                    part_number=row["part_number"],
                    voter_id=row["voter_id"],
                    elector_name=row["elector_name"],
                    relation_type=row["relation_type"],
                    relation_name=row["relation_name"],
                    house_number=row["house_number"],
                    age=row["age"],
                    gender=row["gender"],
                    gender_original=row["gender_original"],
                    photo_available=bool(row["photo_available"]),
                    section=row["section"],
                    assembly_constituency=row["assembly_constituency"],
                    polling_station=row["polling_station"],
                    source_bbox=bbox,
                    raw_card_text=row["raw_card_text"],
                    confidence=json.loads(row["confidence"] or "{}"),
                    needs_review=bool(row["needs_review"]),
                    review_reasons=json.loads(row["review_reasons"] or "[]"),
                    verification_status=row["verification_status"],
                    extraction_method=row["extraction_method"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"]
                ))
            return records

    def get_record_by_id(self, record_id: str) -> Optional[VoterRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM voter_records WHERE id = ?", (record_id,))
            row = cursor.fetchone()
            if not row:
                return None
            bbox = None
            if row["source_bbox"]:
                b_dict = json.loads(row["source_bbox"])
                bbox = BoundingBox(**b_dict)
            return VoterRecord(
                id=row["id"],
                document_id=row["document_id"],
                source_file=row["source_file"],
                source_page=row["source_page"],
                card_index=row["card_index"],
                serial_number=row["serial_number"],
                part_number=row["part_number"],
                voter_id=row["voter_id"],
                elector_name=row["elector_name"],
                relation_type=row["relation_type"],
                relation_name=row["relation_name"],
                house_number=row["house_number"],
                age=row["age"],
                gender=row["gender"],
                gender_original=row["gender_original"],
                photo_available=bool(row["photo_available"]),
                section=row["section"],
                assembly_constituency=row["assembly_constituency"],
                polling_station=row["polling_station"],
                source_bbox=bbox,
                raw_card_text=row["raw_card_text"],
                confidence=json.loads(row["confidence"] or "{}"),
                needs_review=bool(row["needs_review"]),
                review_reasons=json.loads(row["review_reasons"] or "[]"),
                verification_status=row["verification_status"],
                extraction_method=row["extraction_method"],
                created_at=row["created_at"],
                updated_at=row["updated_at"]
            )

    def update_record(self, record_id: str, updates: Dict[str, Any]) -> Optional[VoterRecord]:
        now_str = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            fields = []
            vals = []
            for k, v in updates.items():
                if k in ["serial_number", "part_number", "voter_id", "elector_name", "relation_type", "relation_name", "house_number", "age", "gender", "gender_original", "verification_status"]:
                    fields.append(f"{k} = ?")
                    vals.append(v)
                elif k == "photo_available":
                    fields.append("photo_available = ?")
                    vals.append(1 if v else 0)
                elif k == "needs_review":
                    fields.append("needs_review = ?")
                    vals.append(1 if v else 0)
            if not fields:
                return self.get_record_by_id(record_id)
            fields.append("updated_at = ?")
            vals.append(now_str)
            vals.append(record_id)
            cursor.execute(f"UPDATE voter_records SET {', '.join(fields)} WHERE id = ?", tuple(vals))
            conn.commit()
        return self.get_record_by_id(record_id)

    def save_page_raw_info(self, job_id: str, page_num: int, is_ocr: bool, cards_count: int, raw_text: str, err: Optional[str] = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO page_raw_info (job_id, page_number, is_ocr, cards_count, raw_text, error_message)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (job_id, page_num, 1 if is_ocr else 0, cards_count, raw_text, err))
            conn.commit()

    def get_raw_pages(self, job_id: str) -> List[PageRawInfo]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM page_raw_info WHERE job_id = ? ORDER BY page_number", (job_id,))
            rows = cursor.fetchall()
            return [
                PageRawInfo(
                    page_number=r["page_number"],
                    text_length=len(r["raw_text"] or ""),
                    is_ocr=bool(r["is_ocr"]),
                    cards_count=r["cards_count"],
                    raw_text_snippet=(r["raw_text"] or "")[:400],
                    has_error=bool(r["error_message"]),
                    error_message=r["error_message"]
                ) for r in rows
            ]

db = DatabaseManager()

class PDFProcessingService:
    def __init__(self):
        self.active_jobs: Dict[str, ExtractionJobStatus] = {}
        self.job_threads: Dict[str, threading.Thread] = {}

    def start_extraction_job(self, job_id: str, filepath: str, filename: str, dpi: int = DEFAULT_DPI):
        doc = fitz.open(filepath)
        total_pages = len(doc)
        doc.close()

        now_str = datetime.utcnow().isoformat()
        status = ExtractionJobStatus(
            job_id=job_id,
            filename=filename,
            status="processing",
            current_page=0,
            total_pages=total_pages,
            created_at=now_str
        )
        self.active_jobs[job_id] = status
        db.save_job(status, filepath)

        thread = threading.Thread(
            target=self._run_extraction_worker,
            args=(job_id, filepath, filename, total_pages, dpi),
            daemon=True
        )
        self.job_threads[job_id] = thread
        thread.start()

    def _run_extraction_worker(self, job_id: str, filepath: str, filename: str, total_pages: int, dpi: int):
        job = self.active_jobs[job_id]
        doc = fitz.open(filepath)
        
        # Read document header from page 1
        doc_header = {}
        if total_pages > 0:
            try:
                doc_header = extract_document_header_info(doc[0])
            except Exception:
                pass

        for page_num in range(1, total_pages + 1):
            try:
                # Process single page
                result = process_page_records(
                    doc=doc,
                    page_number=page_num,
                    job_id=job_id,
                    filename=filename,
                    doc_header=doc_header,
                    dpi=dpi
                )
                
                # Save records to DB
                if result.records:
                    db.save_records(result.records)
                    job.records_extracted += len(result.records)
                    for r in result.records:
                        if r.needs_review:
                            job.needs_review_count += 1
                        if r.verification_status == "verified":
                            job.verified_count += 1
                            
                job.cards_detected += result.cards_detected_count
                if result.is_ocr:
                    job.ocr_pages_count += 1
                    
                db.save_page_raw_info(
                    job_id=job_id,
                    page_num=page_num,
                    is_ocr=result.is_ocr,
                    cards_count=result.cards_detected_count,
                    raw_text=result.raw_text,
                    err=result.error
                )

            except Exception as e:
                # Isolation rule: page failure does NOT crash entire job
                job.failed_pages.append(page_num)
                job.errors_count += 1
                job.errors.append({
                    "page": page_num,
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                })
                db.save_page_raw_info(
                    job_id=job_id,
                    page_num=page_num,
                    is_ocr=False,
                    cards_count=0,
                    raw_text="",
                    err=str(e)
                )

            finally:
                job.current_page = page_num
                job.records_processed = job.records_extracted
                db.update_job_progress(job)
                # Free memory after each page
                gc.collect()

        doc.close()
        job.status = "completed"
        job.completed_at = datetime.utcnow().isoformat()
        db.update_job_progress(job)

    def retry_page(self, job_id: str, page_number: int, dpi: int = DEFAULT_DPI) -> bool:
        """Retries extraction for a specific failed page."""
        job = db.get_job(job_id)
        if not job:
            return False
            
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT filepath FROM extraction_jobs WHERE job_id = ?", (job_id,))
            row = cursor.fetchone()
            if not row or not os.path.exists(row["filepath"]):
                return False
            filepath = row["filepath"]
            
        doc = fitz.open(filepath)
        doc_header = {}
        try:
            doc_header = extract_document_header_info(doc[0])
        except Exception:
            pass
            
        try:
            result = process_page_records(doc, page_number, job_id, job.filename, doc_header, dpi=dpi)
            if result.records:
                db.save_records(result.records)
                job.records_extracted += len(result.records)
                job.cards_detected += result.cards_detected_count
                
            db.save_page_raw_info(
                job_id=job_id,
                page_num=page_number,
                is_ocr=result.is_ocr,
                cards_count=result.cards_detected_count,
                raw_text=result.raw_text,
                err=None
            )
            
            if page_number in job.failed_pages:
                job.failed_pages.remove(page_number)
            db.update_job_progress(job)
            return True
        except Exception as e:
            return False
        finally:
            doc.close()
            gc.collect()

pdf_service = PDFProcessingService()
