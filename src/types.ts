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
  source_bbox?: BoundingBox;
  
  serial_number: number | null;
  part_number: number | null;
  voter_id: string | null;
  elector_name: string | null;
  relation_type: string | null;
  relation_name: string | null;
  house_number: string | null;
  age: number | null;
  gender: string | null;
  gender_original: string | null;
  photo_available: boolean;
  
  section?: string | null;
  assembly_constituency?: string | null;
  polling_station?: string | null;
  
  raw_card_text?: string | null;
  confidence: Record<string, number>;
  needs_review: boolean;
  review_reasons: string[];
  verification_status: 'unverified' | 'verified' | 'needs_review';
  extraction_method: 'native' | 'ocr';
  
  created_at?: string;
  updated_at?: string;
}

export interface ExtractionJob {
  job_id: string;
  filename: string;
  status: 'uploaded' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  current_page: number;
  total_pages: number;
  cards_detected: number;
  records_extracted: number;
  records_processed: number;
  needs_review_count: number;
  verified_count: number;
  ocr_pages_count: number;
  errors_count: number;
  failed_pages: number[];
  errors: Array<{ page: number; error: string; timestamp: string }>;
  created_at?: string;
  completed_at?: string;
}

export interface RawPageInfo {
  page_number: number;
  text_length: number;
  is_ocr: boolean;
  cards_count: number;
  raw_text_snippet: string;
  has_error: boolean;
  error_message?: string | null;
}
