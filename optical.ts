export type OpticalKind =
  | "optometry"
  | "examination"
  | "prescription"
  | "contact_lens"
  | "glasses";
export interface OpticalField {
  label: string;
  type: "number" | "text" | "textarea" | "date" | "select";
  min?: number;
  max?: number;
  unit?: string;
  step?: string;
  maxLength?: number;
  options?: string[];
  required?: boolean;
}
export interface OpticalDefinition {
  kind: OpticalKind;
  label: string;
  fields: Record<string, OpticalField>;
}
export interface OpticalRecord {
  id: number;
  customer_id: number;
  kind: OpticalKind;
  status: "draft" | "finalized";
  recorded_on: string;
  practitioner: string;
  data: Record<string, string | number | null>;
  source_record_id: number | null;
  prescription_id: number | null;
  version: number;
  revision: number;
  amends_id: number | null;
  amendment_reason: string | null;
  finalized_at: string | null;
  finalized_by: number | null;
  amendment?: { id: number; revision: number; status: string } | null;
}
