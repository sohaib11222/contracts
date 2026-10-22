import type { Customer } from "./customers";
export type CustomerField =
  | "first_name"
  | "last_name"
  | "date_of_birth"
  | "phone"
  | "email"
  | "street_address"
  | "city"
  | "postal_code"
  | "sex";
export interface CustomerImport {
  id: number;
  status: string;
  stage: string;
  version: number;
  source_kind: "file" | "vista_express";
  file_id: number | null;
  file?: { title: string; filename: string };
  sheet_name: string | null;
  sheets: string[] | null;
  headers: string[] | null;
  mapping: Partial<Record<CustomerField, number>> | null;
  delimiter: string;
  date_format: string;
  total_rows: number;
  processed_rows: number;
  last_error: string | null;
  created_at: string;
}
export interface ImportRow {
  id: number;
  row_number: number;
  raw_values: string[];
  payload: Record<CustomerField, string | null> | null;
  errors: string[] | null;
  matches:
    | Pick<
        Customer,
        | "id"
        | "first_name"
        | "last_name"
        | "email"
        | "phone"
        | "status"
        | "version"
      >[]
    | null;
  file_duplicate: boolean;
  decision: string;
  target_customer_id: number | null;
  target_version: number | null;
  reason: string | null;
  overwrite_blanks: boolean;
  status: string;
  result_customer_id: number | null;
  result_error: string | null;
}
