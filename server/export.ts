import * as XLSX from "xlsx";
import { VoterRecord, ProcessingJob } from "./types";

export function exportToJSON(records: VoterRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function exportToCSV(records: VoterRecord[]): string {
  const headers = [
    "Serial Number",
    "Part Number",
    "Voter ID (EPIC)",
    "Elector Name",
    "Relation Type",
    "Relation Name",
    "House Number",
    "Age",
    "Gender",
    "Photo Available",
    "Confidence Overall",
    "Needs Review",
    "Review Reasons",
    "Verification Status",
    "Source Page",
    "Card Index"
  ];

  const escapeCSV = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map(r => [
    escapeCSV(r.serial_number),
    escapeCSV(r.part_number),
    escapeCSV(r.voter_id),
    escapeCSV(r.elector_name),
    escapeCSV(r.relation_type),
    escapeCSV(r.relation_name),
    escapeCSV(r.house_number),
    escapeCSV(r.age),
    escapeCSV(r.gender),
    escapeCSV(r.photo_available ? "Yes" : "No"),
    escapeCSV(r.confidence?.overall ?? ""),
    escapeCSV(r.needs_review ? "Yes" : "No"),
    escapeCSV(r.review_reasons?.join("; ") ?? ""),
    escapeCSV(r.verification_status),
    escapeCSV(r.source_page),
    escapeCSV(r.card_index)
  ].join(","));

  // Include UTF-8 Byte Order Mark (BOM) for correct Hindi text rendering in Excel
  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}

export function exportToXLSX(records: VoterRecord[], job?: ProcessingJob): Buffer {
  const wb = XLSX.utils.book_new();

  // 1. Records Sheet
  const recordRows = records.map(r => ({
    "Serial No.": r.serial_number ?? "",
    "Part No.": r.part_number ?? "",
    "Voter ID / EPIC": r.voter_id ?? "",
    "Elector Name": r.elector_name ?? "",
    "Relation Type": r.relation_type ?? "",
    "Relation Name": r.relation_name ?? "",
    "House No.": r.house_number ?? "",
    "Age": r.age ?? "",
    "Gender": r.gender ?? "",
    "Photo Available": r.photo_available ? "Yes" : "No",
    "Confidence": r.confidence?.overall ?? 0,
    "Status": r.verification_status,
    "Needs Review": r.needs_review ? "Yes" : "No",
    "Review Reasons": r.review_reasons?.join("; ") ?? "",
    "Page": r.source_page,
    "Card #": r.card_index
  }));

  const wsRecords = XLSX.utils.json_to_sheet(recordRows);
  XLSX.utils.book_append_sheet(wb, wsRecords, "Voter Records");

  // 2. Summary Sheet
  if (job) {
    const summaryData = [
      { "Metric": "Source File", "Value": job.filename },
      { "Metric": "Total Pages", "Value": job.total_pages },
      { "Metric": "Total Records Extracted", "Value": job.total_records },
      { "Metric": "Verified Records", "Value": job.verified_count },
      { "Metric": "Records Needing Review", "Value": job.needs_review_count },
      { "Metric": "Flag Rate", "Value": `${job.total_records ? ((job.needs_review_count / job.total_records) * 100).toFixed(1) : 0}%` },
      { "Metric": "Extraction Completed At", "Value": job.completion_time || "In Progress" }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Extraction Audit");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function exportToAlignedTXT(records: VoterRecord[]): string {
  const colWidths = {
    sn: 6,
    epic: 18,
    name: 24,
    relation: 10,
    relName: 24,
    house: 10,
    age: 5,
    gender: 8,
    status: 14
  };

  const pad = (str: any, width: number): string => {
    const s = String(str ?? "").slice(0, width);
    return s + " ".repeat(Math.max(0, width - s.length));
  };

  const header = [
    pad("S.No", colWidths.sn),
    pad("Voter ID", colWidths.epic),
    pad("Elector Name", colWidths.name),
    pad("Relation", colWidths.relation),
    pad("Relative Name", colWidths.relName),
    pad("House", colWidths.house),
    pad("Age", colWidths.age),
    pad("Gender", colWidths.gender),
    pad("Status", colWidths.status)
  ].join(" | ");

  const separator = "-".repeat(header.length);

  const lines = records.map(r => [
    pad(r.serial_number, colWidths.sn),
    pad(r.voter_id, colWidths.epic),
    pad(r.elector_name, colWidths.name),
    pad(r.relation_type, colWidths.relation),
    pad(r.relation_name, colWidths.relName),
    pad(r.house_number, colWidths.house),
    pad(r.age, colWidths.age),
    pad(r.gender, colWidths.gender),
    pad(r.verification_status, colWidths.status)
  ].join(" | "));

  return [
    `ELECTORAL ROLL EXTRACTED RECORDS (${records.length} Records)`,
    `Generated on: ${new Date().toISOString()}`,
    separator,
    header,
    separator,
    ...lines,
    separator
  ].join("\n");
}
