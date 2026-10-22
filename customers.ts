export interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  postal_code: string | null;
  sex: string | null;
  status: "active" | "archived";
  version: number;
  source: string;
  created_at: string;
  updated_at: string;
}
export interface CustomerEvent {
  id: number;
  action: string;
  changed_fields: string[];
  reason: string | null;
  subject_type: string | null;
  subject_id: number | null;
  created_at: string;
  actor: { name: string } | null;
}
export interface ResourcePage<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
}
export interface Page<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}
