export interface Appointment {
  id: number;
  title: string;
  notes: string | null;
  optical_record_id: number | null;
  order_id: number | null;
  customer_id: number | null;
  customer: { id: number; first_name: string; last_name: string } | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  version: number;
}
export interface AppointmentEvent {
  id: number;
  action: string;
  previous: { starts_at: string; ends_at: string; status: string } | null;
  current: { starts_at: string; ends_at: string; status: string };
  reason: string | null;
  overlap_confirmed: boolean;
  created_at: string;
  actor: { name: string };
}
