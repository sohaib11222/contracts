/* eslint-disable react-refresh/only-export-components -- shared publishing context */
import { createContext, useContext, useEffect, useState, useId, type ReactNode } from "react";
import type { Product } from "./commerce";
import type { VistaField, VistaMetadata } from "./vista";
import type { VistaValues } from "./vista-form";
import type { createApi } from "./session";

type Editor = {
  product: Product; values: VistaValues; meta: VistaMetadata; theme: "shop" | "admin";
  request: ReturnType<typeof createApi>["request"]; imageBase: string;
  refresh: () => void; t: (key: string) => string;
};
const Context = createContext<Editor | null>(null);
export function VistaEditorProvider({ children, ...value }: Editor & { children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function useEditor() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Vista publication editor is unavailable");
  return ctx;
}
function classes(theme: Editor["theme"]) {
  return theme === "shop"
    ? { input: "w-full rounded-md border border-input bg-background p-2 text-sm", button: "rounded-md border border-input px-3 py-2 text-sm hover:bg-muted", row: "flex flex-wrap items-center gap-3", section: "space-y-3 rounded-md border p-3" }
    : { input: "form-control", button: "btn btn-outline-primary btn-sm", row: "d-flex flex-wrap align-items-center gap-3", section: "border rounded p-3 mb-3" };
}

export function VistaImagePicker({ value = [], onChange, label, library = false }: { value?: unknown; onChange?: (v: string[]) => void; label: string; library?: boolean }) {
  const ctx = useEditor();
  const c = classes(ctx.theme);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [product, setProduct] = useState(ctx.product);
  useEffect(() => { setProduct(ctx.product); }, [ctx.product]);
  const pending = product.images?.some(i => i.scan_status === "pending" && !i.archived_at);
  useEffect(() => {
    if (!pending) return;
    let active = true;
    const timer = setTimeout(() => {
      void ctx.request<{ data: Product }>(`/products/${ctx.product.id}`).then(r => {
        if (active) { setProduct(r.data); ctx.refresh(); }
      }).catch(e => active && setError(e.message));
    }, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [pending, product, ctx]);
  const selected = Array.isArray(value) ? value.map(String) : [];
  return <fieldset className={c.section}>
    <legend>{label}</legend>
    <div className={c.row}>
      {(product.images ?? []).filter(i => !i.archived_at).sort((a, b) => a.id - b.id).map(image => (
        <label key={image.id} style={{ width: 126, border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }}>
          {image.scan_status === "clean"
            ? <img src={`${ctx.imageBase}/catalog-images/${image.id}`} alt={image.filename} width={106} height={76} style={{ objectFit: "contain" }} />
            : <span role="status">{image.filename}: {image.scan_status}</span>}
          {!library && <input type="checkbox" aria-label={`${label}: ${image.filename}`} disabled={image.scan_status !== "clean" || (!selected.includes(String(image.id)) && selected.length >= 10)}
            checked={selected.includes(String(image.id))} onChange={e => onChange?.(e.target.checked ? [...selected, String(image.id)] : selected.filter(v => v !== String(image.id)))} />}
          <small style={{ display: "block", overflowWrap: "anywhere" }}>{image.filename}</small>
        </label>
      ))}
    </div>
    <label htmlFor={id}>{ctx.t("ops.vista.uploadImages")}</label>
    <input id={id} className={c.input} type="file" accept="image/png,image/jpeg" multiple disabled={busy}
      onChange={async e => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (!files.length) return;
        setError(""); setBusy(true);
        const added: string[] = [];
        try {
          if (!library && files.length + selected.length > 10) throw new Error(ctx.t("ops.vista.tenPhotos"));
          for (const file of files) {
            if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) throw new Error(ctx.t("ops.vista.imageLimits"));
            const body = new FormData(); body.append("file", file); body.append("upload_key", crypto.randomUUID());
            const r = await ctx.request<{ data: { id: number } }>(`/products/${ctx.product.id}/images`, { method: "POST", body });
            added.push(String(r.data.id));
          }
        } catch (e) { setError(e instanceof Error ? e.message : ctx.t("ops.vista.uploadFailed")); }
        finally {
          if (!library && added.length) onChange?.([...selected, ...added]);
          try { setProduct((await ctx.request<{ data: Product }>(`/products/${ctx.product.id}`)).data); } catch (e) { setError(e instanceof Error ? e.message : ""); }
          ctx.refresh(); setBusy(false);
        }
      }} />
    <small>{ctx.t("ops.vista.photoHelp")}</small>
    {busy && <p role="status">{ctx.t("ops.vista.uploading")}</p>}
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}

export function VistaSpecialField({ field, value, onChange }: { field: VistaField; value: unknown; onChange: (value: unknown) => void }) {
  const ctx = useEditor();
  const c = classes(ctx.theme);
  const id = useId();
  const variants = (ctx.values.variants ?? []) as VistaValues[];
  const packs = (ctx.values.contact_lens_packs ?? []) as VistaValues[];
  if (field.type === "images") return <VistaImagePicker label={field.label} value={value} onChange={onChange} />;
  if (field.type === "prescription") return <PrescriptionEditor value={value} onChange={onChange} />;
  if (field.type === "integer-list") return <div>
    <label htmlFor={id}>{field.label}</label>
    <input id={id} className={c.input} value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} onChange={e => onChange(e.target.value)} placeholder="1, 2, 3, 6" />
  </div>;
  if (field.type === "variant-multiple") return <fieldset className={c.section}>
    <legend>{field.label}</legend>
    <div className={c.row}>{variants.map(row => <label key={String(row.option_key)}>
      <input type="checkbox" checked={Array.isArray(value) && value.includes(row.option_key)}
        onChange={e => onChange(e.target.checked ? [...(Array.isArray(value) ? value : []), row.option_key] : (Array.isArray(value) ? value : []).filter(v => v !== row.option_key))} />
      {String(row.color_name || ctx.t("ops.vista.unnamedColor"))}
    </label>)}</div>
  </fieldset>;
  if (field.type === "variant-select" || field.type === "pack-select") {
    const options = field.type === "variant-select"
      ? variants.map(row => [String(row.option_key), String(row.color_name || ctx.t("ops.vista.unnamedColor"))])
      : packs.map(row => [String(row.quantity ?? ""), String(row.quantity ?? "")]);
    return <div><label htmlFor={id}>{field.label}</label><select id={id} className={c.input} required={field.required} value={String(value ?? "")} onChange={e => onChange(e.target.value)}>
      <option value="">{ctx.t("ops.choose")}</option>{options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select></div>;
  }
  const color = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : field.swatches?.[String(value)] ?? "#000000";
  return <div>
    <label htmlFor={id}>{field.label}</label>
    <div className={c.row}>
      {field.type === "palette" && <select id={id} className={c.input} style={{ flex: 1 }} value={String(value ?? "")} onChange={e => onChange(e.target.value)}>
        <option value="">{ctx.t("ops.choose")}</option>
        {Boolean(value) && !field.options?.includes(String(value)) && <option value={String(value)}>{String(value)}</option>}
        {field.options?.map(v => <option key={v} value={v}>{v}</option>)}
      </select>}
      <input id={field.type === "color" ? id : undefined} aria-label={field.type === "palette" ? ctx.t("ops.vista.customColor") : field.label}
        type="color" value={color} onChange={e => onChange(e.target.value.toUpperCase())} style={{ width: 48, height: 38 }} />
      <span>{String(value ?? "")}</span>
      <button type="button" className={c.button} onClick={() => onChange("")}>{ctx.t("ops.vista.clear")}</button>
    </div>
  </div>;
}

function PrescriptionEditor({ value, onChange }: { value: unknown; onChange: (v: VistaValues[]) => void }) {
  const ctx = useEditor(); const c = classes(ctx.theme);
  const [tab, setTab] = useState("pwr");
  const [eye, setEye] = useState("all");
  const [bulk, setBulk] = useState("");
  const rows = (Array.isArray(value) ? value : []) as VistaValues[];
  let category = ctx.meta.data.categories.find(c => c.id === Number(ctx.values.sub_category_id));
  let astigmatism = false;
  const seen = new Set<number>();
  while (category && !seen.has(category.id)) {
    seen.add(category.id);
    astigmatism ||= /astigmat|toric/i.test(category.slug + " " + category.name);
    category = ctx.meta.data.categories.find(c => c.id === category?.parent_id);
  }
  const active = tab === "sph" && !astigmatism ? "pwr" : tab;
  const stored = active === "sph" ? "pwr" : active;
  const eyeSpecific = ["pwr", "sph", "cyl", "axis"].includes(active);
  const labels: Record<string, string> = { pwr: "PWR (D)", sph: "SPH (D)", cyl: "CYL (D)", axis: "AXIS (°)", base_curve: "B.C. (mm)", diameter: "DIA (mm)" };
  const add = (values: string[]) => {
    const added = values.flatMap(v => (eyeSpecific ? eye === "all" ? ["right", "left"] : [eye] : ["both"]).map(e => ({
      option_key: crypto.randomUUID(), field_type: stored, value: v, label: v, eye_type: e, sort_order: rows.length, is_active: true,
    })));
    onChange([...rows, ...added].slice(0, 1000)); setBulk("");
  };
  return <fieldset className={c.section}><legend>{ctx.t("ops.vista.prescription")}</legend>
    <div className={c.row}>{Object.entries(labels).filter(([k]) => k !== "sph" || astigmatism).map(([k, label]) =>
      <button type="button" className={c.button} key={k} aria-pressed={active === k} onClick={() => setTab(k)}>{label}</button>)}</div>
    {eyeSpecific && <div className={c.row}>{["all", "right", "left"].map(e =>
      <button type="button" key={e} className={c.button} aria-pressed={eye === e} onClick={() => setEye(e)}>{ctx.t("ops.vista.eye." + e)}</button>)}</div>}
    {rows.map((row, index) => {
      const type = row.field_type === "sph" ? "pwr" : row.field_type;
      if (type !== stored || (eyeSpecific && eye !== "all" && row.eye_type !== eye && row.eye_type !== "both")) return null;
      const patch = (v: VistaValues) => onChange(rows.map((r, i) => i === index ? { ...r, ...v } : r));
      return <div className={c.row} key={String(row.option_key)}>
        <label>{labels[active]}<input className={c.input} aria-label={`${labels[active]} value ${index + 1}`} required maxLength={50}
          value={String(row.value ?? "")} onChange={e => patch({ value: e.target.value })} /></label>
        <label>{ctx.t("ops.vista.displayLabel")}<input className={c.input} maxLength={100} value={String(row.label ?? "")} onChange={e => patch({ label: e.target.value })} /></label>
        {eyeSpecific && <label>{ctx.t("ops.vista.eyeLabel")}<select className={c.input} value={String(row.eye_type ?? "right")} onChange={e => patch({ eye_type: e.target.value })}>
          {["right", "left", "both"].map(e => <option key={e} value={e}>{ctx.t("ops.vista.eye." + e)}</option>)}</select></label>}
        <label>{ctx.t("ops.vista.sort")}<input className={c.input} type="number" value={Number(row.sort_order ?? 0)} onChange={e => patch({ sort_order: Number(e.target.value) })} /></label>
        <label><input type="checkbox" checked={row.is_active !== false} onChange={e => patch({ is_active: e.target.checked })} />{ctx.t("ops.vista.active")}</label>
        <button type="button" className={c.button} onClick={() => onChange(rows.filter((_, i) => i !== index))}>{ctx.t("ops.vista.remove")}</button>
      </div>;
    })}
    <button type="button" className={c.button} onClick={() => add([""])} disabled={rows.length >= 999}>{ctx.t("ops.vista.addValue")}</button>
    <label>{ctx.t("ops.vista.bulk")}<textarea className={c.input} value={bulk} onChange={e => setBulk(e.target.value)} /></label>
    <button type="button" className={c.button} disabled={!bulk.trim()} onClick={() => add(bulk.split(/[,\n]/).map(v => v.trim()).filter(Boolean))}>{ctx.t("ops.vista.addValues")}</button>
  </fieldset>;
}

export function VistaContactCategory({ values, onChange }: { values: VistaValues; onChange: (v: VistaValues) => void }) {
  const ctx = useEditor(); const c = classes(ctx.theme);
  const id = useId();
  const selected = ctx.meta.data.categories.find(c => c.id === Number(values.sub_category_id));
  const parent = selected?.parent_id === Number(values.category_id) ? selected : ctx.meta.data.categories.find(c => c.id === selected?.parent_id);
  const children = ctx.meta.data.categories.filter(c => c.parent_id === parent?.id);
  return <div className={c.section}>
    <label htmlFor={`${id}-category`}>{ctx.t("ops.vista.subcategory")}</label><select id={`${id}-category`} className={c.input} value={parent?.id ?? ""} onChange={e => onChange({ ...values, sub_category_id: e.target.value ? Number(e.target.value) : undefined })}>
      <option value="">{ctx.t("ops.choose")}</option>
      {ctx.meta.data.categories.filter(c => c.parent_id === Number(values.category_id)).map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
    </select>
    {children.length > 0 && <div><label htmlFor={`${id}-type`}>{ctx.t("ops.vista.lensType")}</label><select id={`${id}-type`} className={c.input} required value={selected?.id !== parent?.id ? selected?.id ?? "" : ""}
      onChange={e => onChange({ ...values, sub_category_id: e.target.value ? Number(e.target.value) : parent?.id })}>
      <option value="">{ctx.t("ops.choose")}</option>{children.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
    </select></div>}
  </div>;
}

export const vistaSpecialTypes = ["palette", "color", "images", "prescription", "integer-list", "variant-select", "variant-multiple", "pack-select"];

export function VistaStepNavigation({ step, onChange }: { step: number; onChange: (step: number) => void }) {
  const ctx = useEditor(); const c = classes(ctx.theme);
  return <div className={c.section}>
    <nav className={c.row} aria-label={ctx.t("ops.vista.prescription")}>
      {[0, 1, 2].map(n => <button key={n} className={c.button} type="button" aria-current={n === step ? "step" : undefined}
        onClick={e => { if (n < step || e.currentTarget.closest("form")?.reportValidity()) onChange(n); }}>{n + 1}. {ctx.t("ops.vista.step" + n)}</button>)}
    </nav>
    <p>{ctx.t("ops.vista.atomic")}</p>
    <div className={c.row}>
      {step > 0 && <button type="button" className={c.button} onClick={() => onChange(step - 1)}>{ctx.t("ops.vista.back")}</button>}
      {step < 2 && <button type="button" className={c.button} onClick={e => { if (e.currentTarget.closest("form")?.reportValidity()) onChange(step + 1); }}>{ctx.t("ops.vista.next")}</button>}
    </div>
  </div>;
}
