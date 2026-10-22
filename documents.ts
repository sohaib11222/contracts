export interface PrivateDocument {
  id: number;
  filename: string;
  mime: string;
  size: number;
  title: string | null;
  description: string | null;
  category: "document" | "customer_image" | "glasses_image";
  customer_id: number | null;
  optical_record_id: number | null;
  scan_status: "pending" | "clean" | "failed" | "rejected";
  scan_error: string | null;
  scanned_at: string | null;
  version: number;
  archived_at: string | null;
  archive_reason: string | null;
  created_at: string;
}
