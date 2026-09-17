import { ProcessingJob, VoterRecord } from "./types";
import { randomUUID } from "crypto";

class JobStore {
  private jobs: Map<string, ProcessingJob> = new Map();

  createJob(filename: string, totalPages: number = 1): ProcessingJob {
    const jobId = randomUUID();
    const job: ProcessingJob = {
      job_id: jobId,
      filename,
      status: "pending",
      total_pages: totalPages,
      processed_pages: 0,
      current_page: 0,
      total_records: 0,
      needs_review_count: 0,
      verified_count: 0,
      ocr_pages_count: 0,
      start_time: new Date().toISOString(),
      completion_time: null,
      error_message: null,
      raw_pages_text: {},
      records: []
    };
    this.jobs.set(jobId, job);
    return job;
  }

  getJob(jobId: string): ProcessingJob | undefined {
    return this.jobs.get(jobId);
  }

  updateJob(jobId: string, updates: Partial<ProcessingJob>): ProcessingJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    Object.assign(job, updates);
    return job;
  }

  addRecords(jobId: string, newRecords: VoterRecord[], rawPagesText?: Record<number, string>) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.records.push(...newRecords);
    if (rawPagesText) {
      Object.assign(job.raw_pages_text, rawPagesText);
    }

    // Update counts
    job.total_records = job.records.length;
    job.needs_review_count = job.records.filter(r => r.needs_review || r.verification_status === "needs_review").length;
    job.verified_count = job.records.filter(r => r.verification_status === "verified").length;
  }

  getRecords(
    jobId: string,
    options: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
    }
  ): { records: VoterRecord[]; total: number; page: number; pageSize: number; totalPages: number } {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { records: [], total: 0, page: 1, pageSize: 25, totalPages: 0 };
    }

    let list = [...job.records];

    // Filter by status
    if (options.status && options.status !== "all") {
      if (options.status === "needs_review") {
        list = list.filter(r => r.needs_review || r.verification_status === "needs_review");
      } else if (options.status === "verified") {
        list = list.filter(r => r.verification_status === "verified");
      } else if (options.status === "unverified") {
        list = list.filter(r => r.verification_status === "unverified" && !r.needs_review);
      }
    }

    // Filter by search
    if (options.search) {
      const q = options.search.toLowerCase().trim();
      list = list.filter(r =>
        (r.elector_name && r.elector_name.toLowerCase().includes(q)) ||
        (r.voter_id && r.voter_id.toLowerCase().includes(q)) ||
        (r.relation_name && r.relation_name.toLowerCase().includes(q)) ||
        (r.house_number && r.house_number.toLowerCase().includes(q)) ||
        (r.serial_number && String(r.serial_number).includes(q))
      );
    }

    const total = list.length;
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.max(1, options.pageSize || 25);
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pagedRecords = list.slice(start, start + pageSize);

    return {
      records: pagedRecords,
      total,
      page,
      pageSize,
      totalPages
    };
  }

  updateRecord(jobId: string, recordId: string, updates: Partial<VoterRecord>): VoterRecord | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const idx = job.records.findIndex(r => r.id === recordId);
    if (idx === -1) return null;

    const record = job.records[idx];
    const updated: VoterRecord = {
      ...record,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // If verified, clear needs_review
    if (updates.verification_status === "verified") {
      updated.needs_review = false;
      updated.review_reasons = [];
    }

    job.records[idx] = updated;

    // Recalculate job counts
    job.needs_review_count = job.records.filter(r => r.needs_review || r.verification_status === "needs_review").length;
    job.verified_count = job.records.filter(r => r.verification_status === "verified").length;

    return updated;
  }

  findRecord(recordId: string): { job: ProcessingJob; record: VoterRecord } | null {
    for (const job of this.jobs.values()) {
      const rec = job.records.find(r => r.id === recordId);
      if (rec) return { job, record: rec };
    }
    return null;
  }

  updateRecordById(recordId: string, updates: Partial<VoterRecord>): VoterRecord | null {
    const found = this.findRecord(recordId);
    if (!found) return null;
    return this.updateRecord(found.job.job_id, recordId, updates);
  }
}

export const jobStore = new JobStore();
