export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VoterRecord {
  id: string;
  document_id: string;
  source_file: string;
  source_page: number;
  card_index: number;
  source_bbox: BoundingBox;
  serial_number: number | null;
  part_number: number | null;
  voter_id: string | null;
  elector_name: string | null;
  relation_type: "father" | "husband" | "mother" | "other" | null;
  relation_name: string | null;
  house_number: string | null;
  age: number | null;
  gender: "male" | "female" | "third_gender" | null;
  gender_original: string | null;
  photo_available: boolean;
  confidence: {
    serial_number: number;
    voter_id: number;
    elector_name: number;
    relation_name: number;
    house_number: number;
    age: number;
    gender: number;
    overall: number;
  };
  needs_review: boolean;
  review_reasons: string[];
  verification_status: "unverified" | "verified" | "needs_review";
  extraction_method: "native" | "ocr";
  raw_card_text: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessingJob {
  job_id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_pages: number;
  processed_pages: number;
  current_page: number;
  total_records: number;
  needs_review_count: number;
  verified_count: number;
  ocr_pages_count: number;
  start_time: string;
  completion_time: string | null;
  error_message: string | null;
  raw_pages_text: Record<number, string>;
  records: VoterRecord[];
}

export interface ParsedCard {
  serial_number: number | null;
  part_number: number | null;
  voter_id: string | null;
  elector_name: string | null;
  relation_type: "father" | "husband" | "mother" | "other" | null;
  relation_name: string | null;
  house_number: string | null;
  age: number | null;
  gender: "male" | "female" | "third_gender" | null;
  gender_original: string | null;
  photo_available: boolean;
  confidence: {
    serial_number: number;
    voter_id: number;
    elector_name: number;
    relation_name: number;
    house_number: number;
    age: number;
    gender: number;
    overall: number;
  };
  needs_review: boolean;
  review_reasons: string[];
  raw_card_text: string;
}
