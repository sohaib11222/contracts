import { useState } from "react";
import type { Product } from "../commerce";
import { decimal, money } from "../commerce";
import type { Page } from "../customers";
import { useOps, useLoad, State, Pager, errorText } from "./shared";

const attributes = ["size", "material", "lens_width", "bridge_width", "temple_length", "base_curve", "diameter", "power"];

/** Variations remain regular sellable SKUs, so stock, orders and images use existing APIs. */
export default function ProductVariations({ product, imageBase = "/api/v1" }: { product: Product; imageBase?: string }) {
  const { ui: U, request, can, t } = useOps();
  const [page, setPage] = useState(1);
  const familyId = product.parent_product_id ?? product.id;
  const q = useLoad<Page<Product>>(`/products?family_id=${familyId}&page=${page}&per_page=20`);
  const base = useLoad<{ data: Product }>(product.parent_product_id ? `/products/${familyId}` : null);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(crypto.randomUUID());
  const parent = product.parent_product_id ? base.data?.data : product;
  const writable = can("products.write");

  function edit(p?: Product) {
    if (!parent) return;
    setValues({
      name: p?.name ?? parent.name, sku: p?.sku ?? "", color: p?.color ?? "",
      price: decimal((p ?? parent).price_minor, parent.price_decimals),
      initial_quantity: "0", low_stock_threshold: String((p ?? parent).low_stock_threshold),
      description: (p ?? parent).description ?? "", ...(p?.variation_attributes ?? {}),
    });
    setError("");
    setKey(crypto.randomUUID());
    setEditing(p ?? "new");
  }
  const field = (name: string, type = "text", required = false) => (
    <U.Field key={name} label={t("ops.variant." + name)} value={values[name] ?? ""} type={type}
      required={required} min={type === "number" ? 0 : undefined}
      onChange={v => setValues(old => ({ ...old, [name]: v }))} />
  );
  return <U.Panel title={t("ops.variant.title")} actions={
    writable && can("products.create") && parent?.status !== "archived"
      ? <U.Button disabled={!parent} onClick={() => edit()}>{t("ops.variant.add")}</U.Button> : undefined
  }>
    <U.Stack>
      <U.Alert>{t("ops.variant.help")}</U.Alert>
      <State {...q} />
      <State {...base} />
      <U.Table headers={[t("ops.variant.photo"), t("ops.variant.name"), t("ops.variant.attributes"), t("ops.variant.price"), t("ops.variant.stock"), t("ops.actions")]}
        rows={(q.data?.data ?? []).map(p => [
          p.primary_image_id ? <img src={`${imageBase}/catalog-images/${p.primary_image_id}`} alt={p.color} width={64} height={64} style={{ objectFit: "contain" }} /> : "—",
          <span>{p.name}<br />{p.sku} · {p.parent_product_id ? t("ops.variant.variation") : t("ops.variant.base")}</span>,
          [p.color, ...Object.entries(p.variation_attributes ?? {}).map(([k, v]) => `${t("ops.variant." + k)}: ${v}`)].join(" · "),
          money(p),
          `${p.balance.available} / ${p.balance.on_hand}`,
          <U.Stack inline>
            <U.Link to={`/products/${p.id}`}>{t("ops.variant.manage")}</U.Link>
            {p.parent_product_id && writable && can("products.edit") && p.status !== "archived" && <U.Button secondary disabled={!parent} onClick={() => edit(p)}>{t("ops.edit")}</U.Button>}
          </U.Stack>,
        ])} />
      <Pager page={page} last={q.data?.last_page} setPage={setPage} />
    </U.Stack>
    {editing && parent && <U.Dialog title={t(editing === "new" ? "ops.variant.add" : "ops.variant.edit")} onClose={() => !busy && setEditing(null)}>
      <form onSubmit={async e => {
        e.preventDefault(); setError(""); setBusy(true);
        try {
          const existing = editing === "new" ? null : editing;
          await request(`/products${existing ? "/" + existing.id : ""}`, {
            method: existing ? "PATCH" : "POST",
            body: JSON.stringify({
              name: values.name, sku: values.sku || null, color: values.color,
              brand: existing?.brand ?? parent.brand, model: existing?.model ?? parent.model, category_id: parent.category_id,
              description: values.description, price: values.price, low_stock_threshold: Number(values.low_stock_threshold),
              variation_attributes: Object.fromEntries(attributes.filter(k => values[k]?.trim()).map(k => [k, values[k].trim()])),
              ...(existing ? { version: existing.version } : { parent_product_id: parent.id, creation_key: key, initial_quantity: Number(values.initial_quantity) }),
            }),
          });
          setEditing(null); await q.reload();
        } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
      }}>
        <U.Stack>
          <U.Alert>{t("ops.variant.skuHelp")}</U.Alert>
          <U.Stack inline>{field("name", "text", true)}{field("sku")}{field("color", "text", true)}</U.Stack>
          <U.Stack inline>{field("price", "text", true)}{field("low_stock_threshold", "number", true)}
            {editing === "new" && can("stock.write") && can("stock.create") && field("initial_quantity", "number", true)}</U.Stack>
          <U.Stack inline>{attributes.map(a => field(a))}</U.Stack>
          {field("description", "textarea")}
          {error && <U.Alert error>{error}</U.Alert>}
          <U.Button type="submit" disabled={busy}>{t("ops.save")}</U.Button>
        </U.Stack>
      </form>
    </U.Dialog>}
  </U.Panel>;
}
