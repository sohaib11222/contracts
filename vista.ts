export interface VistaConnection {
  id: number;
  store_name: string;
  store_id: string;
  status: string;
  expires_at: string;
  synced_at: string | null;
  last_error: string | null;
}
export interface VistaStatus {
  data: {
    enabled: boolean;
    connection: VistaConnection | null;
    stock_policy: "allocated";
    source: "vista_express";
  };
}
export interface VistaRecord {
  id: number;
  kind: string;
  remote_id: string;
  observed_at: string;
  payload: Record<string, unknown>;
}
export interface VistaPublication {
  id: number;
  remote_id: string | null;
  external_key: string;
  remote_version: string | null;
  visible: boolean;
  mapping: Record<string, unknown> | null;
}
export interface VistaOperation {
  id: number;
  status: string;
  allocated_quantity: number;
  attempts: number;
  last_error: string | null;
  created_at: string;
}
export interface PublicationState {
  data: VistaPublication | null;
  operations: VistaOperation[];
}
export interface VistaMetadata {
  data: {
    currency: string;
    schema_version?: number;
    common_fields?: VistaField[];
    categories: {
      id: number;
      name: string;
      slug?: string;
      parent_id: number | null;
      product_type?: string;
      fields?: VistaField[];
    }[];
    product_types: string[];
    publication_policy: string;
  };
}
export const vistaFields = [
  ["frame_shape", "Frame shape"],
  ["frame_material", "Frame material"],
  ["gender", "Gender (men, women, unisex or kids)"],
  ["lens_type", "Lens type"],
  ["contact_lens_brand", "Contact lens brand"],
  ["contact_lens_material", "Contact lens material"],
  ["contact_lens_type", "Contact lens type"],
  ["replacement_frequency", "Replacement frequency"],
  ["powers_range", "Powers range"],
  ["base_curve_options", "Base curves (comma separated)"],
  ["diameter_options", "Diameters (comma separated)"],
  ["size_volume", "Size / volume"],
  ["pack_type", "Pack type"],
  ["expiry_date", "Expiry date (YYYY-MM-DD)"],
] as const;
export function mappedVistaFields(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v.trim() !== "")
      .map(([k, v]) => [
        k,
        ["base_curve_options", "diameter_options"].includes(k)
          ? v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : k === "category_id"
            ? Number(v)
            : v,
      ]),
  );
}
export function displayVistaValue(v: unknown): string {
  return v == null
    ? "—"
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);
}

export interface VistaField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: string;
  pattern?: string;
  options?: string[];
  fields?: VistaField[];
  hidden?: boolean;
  allowLegacy?: boolean;
  swatches?: Record<string, string>;
  maxItems?: number;
}
