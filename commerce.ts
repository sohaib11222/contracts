import type { SessionUser } from "./session";
export interface Category {
  id: number;
  name: string;
  description: string | null;
  status: "active" | "archived";
  version: number;
}
export interface ProductImage {
  id: number;
  filename: string;
  scan_status: "pending" | "clean" | "rejected" | "failed";
  scan_error: string | null;
  archived_at: string | null;
}
export interface StockBalance {
  id: number;
  product_id: number;
  on_hand: number;
  reserved: number;
  available: number;
  version: number;
  product?: Product;
}
export interface Product {
  parent_product_id?: number | null;
  parent_product?: { id: number; name: string; sku: string } | null;
  variation_attributes?: Record<string, string> | null;
  id: number;
  name: string;
  sku: string;
  brand: string;
  model: string;
  color: string;
  description: string | null;
  category_id: number;
  category: Category;
  price_minor: number;
  currency: string;
  price_decimals: number;
  status: "draft" | "active" | "archived";
  low_stock_threshold: number;
  version: number;
  balance: StockBalance;
  primary_image_id: number | null;
  images?: ProductImage[];
}
export interface StockMovement {
  id: number;
  kind: string;
  quantity_delta: number;
  reserved_delta: number;
  on_hand_after: number;
  reserved_after: number;
  reason: string;
  created_at: string;
  actor: { name: string } | null;
  reversal: { id: number } | null;
  subject_type: string | null;
  subject_id: number | null;
}
export interface ShopSettings {
  data: {
    shop: NonNullable<SessionUser["shop"]> & {
      settings_version: number;
      notification_preferences: Record<string, boolean> | null;
    };
    stock_location: string;
    currency_locked: boolean;
  };
  currencies: { code: string; name: string; decimals: number }[];
}
export function decimal(minor: number, digits: number) {
  const s = Math.abs(minor)
    .toString()
    .padStart(digits + 1, "0");
  return (
    (minor < 0 ? "-" : "") +
    (digits ? s.slice(0, -digits) + "." + s.slice(-digits) : s)
  );
}
export function money(p: {
  price_minor: number;
  currency: string;
  price_decimals: number;
}) {
  return p.currency + " " + decimal(p.price_minor, p.price_decimals);
}

export interface OrderItem {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  brand: string;
  model: string;
  color: string;
  quantity: number;
  unit_price_minor: number;
  total_minor: number;
}
export interface SaleEntry {
  id: number;
  order_id: number;
  kind: "sale" | "reversal";
  currency: string;
  price_decimals: number;
  amount_minor: number;
  stock_returned: boolean;
  reason: string | null;
  created_at: string;
  actor: { name: string } | null;
  order?: { id: number; number: string; status: string };
}
export interface Order {
  id: number;
  customer_id: number;
  prescription_id: number | null;
  number: string;
  status: "draft" | "confirmed" | "fulfilled" | "cancelled" | "reversed";
  channel: "in_store";
  currency: string;
  price_decimals: number;
  total_minor: number;
  notes: string | null;
  version: number;
  created_at: string;
  confirmed_at: string | null;
  fulfilled_at: string | null;
  customer_snapshot: Record<string, string | null>;
  customer: {
    id: number;
    first_name: string;
    last_name: string;
    status?: string;
  };
  items: OrderItem[];
  sales: SaleEntry[];
}
export interface OrderEvent {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string;
  version: number;
  reason: string | null;
  stock_returned: boolean | null;
  created_at: string;
  actor: { name: string } | null;
}
export interface SalesSummary {
  currency: string;
  price_decimals: number;
  sales_minor: number;
  reversals_minor: number;
  net_minor: number;
}
export function amount(minor: number, currency: string, digits: number) {
  return currency + " " + decimal(minor, digits);
}
