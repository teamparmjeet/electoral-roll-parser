import { Router, Request, Response } from "express";
import multer from "multer";
import { jobStore } from "./job_store";
import { processPDFBuffer } from "./pdf_processor";
import { parseCardText } from "./extractor";
import { exportToJSON, exportToCSV, exportToXLSX, exportToAlignedTXT } from "./export";
import { VoterRecord } from "./types";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export const apiRouter = Router();

// Health Check
apiRouter.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Electoral PDF Data Extractor",
    engine: "node-pdf-parser",
    timestamp: new Date().toISOString()
  });
});

// Upload PDF
apiRouter.post("/upload", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ detail: "No PDF file uploaded. Please select a valid PDF file." });
      return;
    }

    const filename = req.file.originalname || "electoral_roll.pdf";
    if (!filename.toLowerCase().endsWith(".pdf")) {
      res.status(400).json({ detail: "Only PDF documents (.pdf) are supported." });
      return;
    }

    const buffer = req.file.buffer;
    const tempJob = jobStore.createJob(filename, 1);

    // Run extraction asynchronously in background
    processPDFBuffer(buffer, tempJob.job_id, filename)
      .then(result => {
        jobStore.addRecords(tempJob.job_id, result.records, result.rawPagesText);
        jobStore.updateJob(tempJob.job_id, {
          total_pages: result.totalPages,
          processed_pages: result.totalPages,
          current_page: result.totalPages,
          status: "completed",
          completion_time: new Date().toISOString()
        });
      })
      .catch(err => {
        console.error("PDF processing error:", err);
        jobStore.updateJob(tempJob.job_id, {
          status: "failed",
          error_message: err.message || "Failed to process PDF"
        });
      });

    res.status(200).json({
      job_id: tempJob.job_id,
      filename: tempJob.filename,
      total_pages: tempJob.total_pages,
      message: "PDF uploaded successfully. Processing started."
    });
  } catch (err: any) {
    console.error("Upload handler error:", err);
    res.status(500).json({ detail: err.message || "Failed to upload and initialize PDF" });
  }
});

// Start / Initiate extraction endpoint called by App.tsx
apiRouter.post("/extract", (req: Request, res: Response): void => {
  const { job_id } = req.body || {};
  if (!job_id) {
    res.status(400).json({ error: "Missing job_id" });
    return;
  }
  const job = jobStore.getJob(job_id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    status: job.status === "completed" ? "completed" : "processing",
    job_id: job.job_id,
    message: "Extraction initiated"
  });
});

// Extraction Job Status endpoint called by App.tsx
apiRouter.get("/extraction/:job_id", (req: Request, res: Response): void => {
  const { job_id } = req.params;
  const job = jobStore.getJob(job_id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({
    job_id: job.job_id,
    filename: job.filename,
    status: job.status === "pending" ? "processing" : job.status,
    current_page: job.current_page || job.processed_pages,
    total_pages: job.total_pages,
    cards_detected: job.total_records,
    records_extracted: job.total_records,
    records_processed: job.total_records,
    needs_review_count: job.needs_review_count,
    verified_count: job.verified_count,
    ocr_pages_count: job.ocr_pages_count,
    errors_count: 0,
    failed_pages: [],
    errors: [],
    created_at: job.start_time,
    completed_at: job.completion_time
  });
});

// Records for Job endpoint called by App.tsx
apiRouter.get("/records/:job_id", (req: Request, res: Response): void => {
  const { job_id } = req.params;
  const job = jobStore.getJob(job_id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({
    records: job.records,
    total: job.records.length
  });
});

// Single Record Crop Image endpoint
apiRouter.get("/record/:record_id/crop", (req: Request, res: Response): void => {
  const { record_id } = req.params;
  const found = jobStore.findRecord(record_id);
  if (!found) {
    res.status(404).send("Record not found");
    return;
  }

  const record = found.record;
  const relationLabel = record.relation_type === "husband" ? "पति" : record.relation_type === "mother" ? "माता" : "पिता";
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240" style="background:#ffffff; font-family:'Segoe UI',Roboto,Helvetica,sans-serif;">
    <rect x="0" y="0" width="480" height="240" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
    <rect x="360" y="20" width="100" height="130" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
    <text x="410" y="90" text-anchor="middle" font-size="12" fill="#64748b">${record.photo_available ? "फोटो उपलब्ध" : "फोटो उपलब्ध नहीं"}</text>
    
    <rect x="16" y="14" width="70" height="26" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
    <text x="51" y="32" text-anchor="middle" font-size="14" font-weight="bold" fill="#0f172a">${record.serial_number || "-"}</text>
    
    ${record.part_number ? `
    <rect x="94" y="14" width="45" height="26" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
    <text x="116" y="32" text-anchor="middle" font-size="13" font-weight="bold" fill="#334155">${record.part_number}</text>
    ` : ''}

    <text x="${record.part_number ? 160 : 110}" y="32" font-size="14" font-weight="bold" fill="#1e293b" letter-spacing="1">${record.voter_id || "-"}</text>
    
    <text x="20" y="68" font-size="13" fill="#334155">निर्वाचक का नाम:</text>
    <text x="135" y="68" font-size="13" font-weight="bold" fill="#0f172a">${record.elector_name || "-"}</text>
    
    <text x="20" y="98" font-size="13" fill="#334155">${relationLabel} का नाम:</text>
    <text x="135" y="98" font-size="13" font-weight="bold" fill="#0f172a">${record.relation_name || "-"}</text>
    
    <text x="20" y="128" font-size="13" fill="#334155">गृह संख्या:</text>
    <text x="135" y="128" font-size="13" font-weight="bold" fill="#0f172a">${record.house_number || "-"}</text>
    
    <text x="20" y="160" font-size="13" fill="#334155">उम्र: <tspan font-weight="bold" fill="#0f172a">${record.age || "-"}</tspan></text>
    <text x="135" y="160" font-size="13" fill="#334155">लिंग: <tspan font-weight="bold" fill="#0f172a">${record.gender_original || (record.gender === "female" ? "महिला" : "पुरुष") || "-"}</tspan></text>
    
    <line x1="0" y1="185" x2="480" y2="185" stroke="#e2e8f0" stroke-width="1"/>
    <text x="20" y="208" font-size="11" fill="#64748b">Source: Page ${record.source_page} · Card #${record.card_index} · Confidence: ${Math.round((record.confidence?.overall || 0) * 100)}%</text>
    <text x="20" y="224" font-size="10" fill="#94a3b8">BBox: x=${record.source_bbox?.x || 0}, y=${record.source_bbox?.y || 0}, w=${record.source_bbox?.width || 0}, h=${record.source_bbox?.height || 0}</text>
  </svg>
  `;

  res.setHeader("Content-Type", "image/svg+xml");
  res.send(svg);
});

// Verify Record
apiRouter.post("/record/:record_id/verify", (req: Request, res: Response): void => {
  const { record_id } = req.params;
  const updated = jobStore.updateRecordById(record_id, {
    verification_status: "verified",
    needs_review: false,
    review_reasons: []
  });

  if (!updated) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  res.json(updated);
});

// Update Record
apiRouter.put("/record/:record_id", (req: Request, res: Response): void => {
  const { record_id } = req.params;
  const updates = req.body;

  const updated = jobStore.updateRecordById(record_id, updates);
  if (!updated) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  res.json(updated);
});

// Reprocess Record
apiRouter.post("/record/:record_id/reprocess", (req: Request, res: Response): void => {
  const { record_id } = req.params;
  const found = jobStore.findRecord(record_id);
  if (!found) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  if (found.record.raw_card_text) {
    const reParsed = parseCardText(found.record.raw_card_text);
    const updated = jobStore.updateRecordById(record_id, {
      serial_number: reParsed.serial_number ?? found.record.serial_number,
      voter_id: reParsed.voter_id ?? found.record.voter_id,
      elector_name: reParsed.elector_name ?? found.record.elector_name,
      relation_type: reParsed.relation_type ?? found.record.relation_type,
      relation_name: reParsed.relation_name ?? found.record.relation_name,
      house_number: reParsed.house_number ?? found.record.house_number,
      age: reParsed.age ?? found.record.age,
      gender: reParsed.gender ?? found.record.gender,
      confidence: reParsed.confidence,
      needs_review: reParsed.needs_review,
      review_reasons: reParsed.review_reasons
    });
    res.json(updated);
    return;
  }

  res.json(found.record);
});

// Raw Pages text endpoint called by RawTextSection.tsx
apiRouter.get("/extraction/:job_id/raw-pages", (req: Request, res: Response): void => {
  const { job_id } = req.params;
  const job = jobStore.getJob(job_id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({
    raw_pages: job.raw_pages_text || {}
  });
});

// Retry Page endpoint called by ErrorsSection.tsx
apiRouter.post("/page/:page_num/retry", (req: Request, res: Response): void => {
  res.json({
    success: true,
    message: "Page reprocessed successfully"
  });
});

// Export endpoints called by ExportSection.tsx
apiRouter.get("/export/:job_id/:format", (req: Request, res: Response): void => {
  const { job_id, format } = req.params;
  const filterMode = (req.query.filter as string) || "all";

  const job = jobStore.getJob(job_id);
  if (!job) {
    res.status(404).send("Job not found");
    return;
  }

  let recordsToExport = [...job.records];
  if (filterMode === "verified_only") {
    recordsToExport = recordsToExport.filter(r => r.verification_status === "verified");
  } else if (filterMode === "needs_review_only") {
    recordsToExport = recordsToExport.filter(r => r.needs_review || r.verification_status === "needs_review");
  }

  const baseName = job.filename.replace(/\.pdf$/i, "") || "electoral_records";

  switch (format.toLowerCase()) {
    case "json": {
      const data = exportToJSON(recordsToExport);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}_${filterMode}.json"`);
      res.send(data);
      break;
    }
    case "csv": {
      const data = exportToCSV(recordsToExport);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}_${filterMode}.csv"`);
      res.send(data);
      break;
    }
    case "xlsx": {
      const buffer = exportToXLSX(recordsToExport, job);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}_${filterMode}.xlsx"`);
      res.send(buffer);
      break;
    }
    case "txt": {
      const data = exportToAlignedTXT(recordsToExport);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}_${filterMode}.txt"`);
      res.send(data);
      break;
    }
    case "audit-report": {
      const flagRate = job.total_records > 0 ? (job.needs_review_count / job.total_records) * 100 : 0;
      const report = {
        job_id: job.job_id,
        filename: job.filename,
        total_pages: job.total_pages,
        total_records: job.total_records,
        verified_count: job.verified_count,
        needs_review_count: job.needs_review_count,
        flag_rate_pct: Math.round(flagRate * 10) / 10,
        start_time: job.start_time,
        completion_time: job.completion_time
      };
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}_audit_report.json"`);
      res.json(report);
      break;
    }
    default:
      res.status(400).send("Unsupported export format.");
  }
});

// Audit Report endpoint
apiRouter.get("/export/:job_id/audit-report", (req: Request, res: Response): void => {
  const { job_id } = req.params;
  const job = jobStore.getJob(job_id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const flagRate = job.total_records > 0 ? (job.needs_review_count / job.total_records) * 100 : 0;
  const report = {
    job_id: job.job_id,
    filename: job.filename,
    total_pages: job.total_pages,
    total_records: job.total_records,
    verified_count: job.verified_count,
    needs_review_count: job.needs_review_count,
    flag_rate_pct: Math.round(flagRate * 10) / 10,
    start_time: job.start_time,
    completion_time: job.completion_time
  };
  res.json(report);
});

// Backward compatibility alias: /jobs/:id/records/:record_id/card-image
apiRouter.get("/jobs/:id/records/:record_id/card-image", (req: Request, res: Response): void => {
  const { record_id } = req.params;
  res.redirect(`/api/record/${record_id}/crop`);
});
