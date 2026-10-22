import type { Product } from "./commerce";

import { decimal } from "./commerce";

import type { VistaMetadata } from "./vista";

export type VistaValues = Record<string, unknown>;

export function initialVistaValues(
  product: Product,
  mapping?: VistaValues | null,
): VistaValues {
  const reset = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(reset)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([k, v]) => [
              k,
              k === "stock_quantity" ? 0 : reset(v),
            ]),
          )
        : value;

  const saved = reset(mapping ?? {}) as VistaValues;
  const photos = (product.images ?? []).filter(i => i.scan_status === "clean" && !i.archived_at).sort((a,b) => a.id-b.id);
  for (const row of (saved.variants ?? []) as VistaValues[]) {
    if (!row.image_ids && Array.isArray(row.image_indices)) row.image_ids = row.image_indices.map(index => photos[Number(index)-1]?.id).filter(Boolean).map(String);
    delete row.image_indices;
  }
  return {
    name: product.name,
    sku: product.sku,
    description: product.description ?? "",
    short_description: [product.brand, product.model, product.color]
      .filter(Boolean)
      .join(" · "),
    price: decimal(product.price_minor, product.price_decimals),
    gallery_image_ids: photos.slice(0, 10).map(i => String(i.id)),
    is_active: true,
    is_featured: false,
    ...saved,
  };
}

export function selectVistaCategory(
  values: VistaValues,
  id: string,
  meta: VistaMetadata,
): VistaValues {
  const category = meta.data.categories.find((c) => String(c.id) === id);

  const common = Object.fromEntries(
    (meta.data.common_fields ?? [])
      .filter((f) => f.key in values)
      .map((f) => [f.key, values[f.key]]),
  );

  return {
    ...common,
    category_id: Number(id),
    product_type: category?.product_type,
    ...(category?.product_type === "contact_lens" ? { prescription_values: [], contact_lens_packs: [], contact_lens_qty_options: [], contact_lens_colour_stock: [], is_medical_device: true } : {}),
  };
}

export function vistaSubcategories(
  meta: VistaMetadata,
  id: unknown,
): [string, string][] {
  const result: [string, string][] = [];

  const visit = (parent: unknown, prefix: string, seen: Set<number>) => {
    for (const c of meta.data.categories.filter(
      (c) => String(c.parent_id) === String(parent),
    )) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      result.push([String(c.id), prefix + c.name]);
      visit(c.id, prefix + c.name + " / ", seen);
    }
  };
  visit(id, "", new Set());
  return result;
}

export function cleanVistaValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanVistaValues);

  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, cleanVistaValues(v)]),
    );

  return value === "" ? null : value;
}

export function vistaAllocatedTotal(values: VistaValues): number | null {
  const rows = values.variants as VistaValues[] | undefined;

  if (rows?.length)
    return rows.reduce(
      (sum, r) =>
        sum +
        ((r.sizes as VistaValues[] | undefined)?.length
          ? (r.sizes as VistaValues[]).reduce(
              (s, x) => s + Number(x.stock_quantity || 0),
              0,
            )
          : Number(r.stock_quantity || 0)),
      0,
    );

  const sizes = values.size_volume_variants as VistaValues[] | undefined;

  return sizes?.length
    ? sizes.reduce((s, x) => s + Number(x.stock_quantity || 0), 0)
    : null;
}

export function publicationValues(
  meta: VistaMetadata,
  values: VistaValues,
): VistaValues {
  const category = meta.data.categories.find(
    (c) => c.id === Number(values.category_id),
  );

  const walk = (
    fields: import("./vista").VistaField[],
    v: VistaValues,
  ): VistaValues =>
    Object.fromEntries(
      fields
        .filter((f) => f.key in v)
        .map((f) => [
          f.key,
          ["rows", "prescription"].includes(f.type)
            ? (v[f.key] as VistaValues[]).map((row) => ({
                option_key: row.option_key,
                ...walk(f.fields ?? [], row),
              }))
            : f.type === "integer-list" && typeof v[f.key] === "string"
              ? (v[f.key] as string).split(/[,\s]+/).filter(Boolean).map(Number)
            : f.type === "list" && typeof v[f.key] === "string"
              ? (v[f.key] as string)
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : v[f.key],
        ]),
    );

  return cleanVistaValues({
    category_id: values.category_id,
    product_type: category?.product_type,
    sub_category_id: values.sub_category_id,
    ...walk(
      [...(meta.data.common_fields ?? []), ...(category?.fields ?? [])],
      values,
    ),
  }) as VistaValues;
}

export function vistaStepForField(key: string): number {
  if (key === "prescription_values") return 1;
  return ["variants", "contact_lens_packs", "contact_lens_qty_options", "contact_lens_colour_stock"].includes(key) ? 2 : 0;
}
