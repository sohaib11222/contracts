/* eslint-disable react-refresh/only-export-components -- shared publishing context */
import { createContext, useContext, useEffect, useState, useId, useRef, type ReactNode } from "react";
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
    ? { input: "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm", button: "rounded-xl border border-input px-4 py-2 text-sm hover:bg-muted", row: "flex flex-wrap items-center gap-3", section: "space-y-4 rounded-2xl border bg-card p-5 shadow-sm" }
    : { input: "form-control", button: "btn btn-outline-primary btn-sm", row: "d-flex flex-wrap align-items-center gap-3", section: "border rounded p-3 mb-3" };
}

/** Seller-style color summary cards with a focused sizes/images editor. */
export function VistaColorVariations({ field, value, onChange, render }: {
  field: VistaField; value: unknown; onChange: (rows: VistaValues[]) => void;
  render: (row: VistaValues, change: (row: VistaValues) => void) => ReactNode;
}) {
  const ctx = useEditor(); const c = classes(ctx.theme); const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const rows = (Array.isArray(value) ? value : []) as VistaValues[];
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<VistaValues>({});
  useEffect(() => { if (editing !== null) dialog.current?.showModal(); }, [editing]);
  function open(index: number) {
    setDraft(structuredClone(rows[index] ?? { option_key: crypto.randomUUID(), color_name: '', color_code: '#000000',
      stock_quantity: 0, stock_status: 'in_stock', is_default: rows.length === 0, image_ids: [], sizes: [] }));
    setEditing(index);
  }
  function close() { dialog.current?.close(); setEditing(null); }
  return <section className={c.section}>
    <div className={c.row} style={{paddingBottom:16, borderBottom:'1px solid var(--bs-border-color, #e2e8f0)', marginBottom:16}}><h2 className={ctx.theme === 'shop' ? 'text-xl font-semibold' : 'h4 mb-0'}>{field.label}</h2>
      <button className={c.button} type="button" disabled={rows.length >= (field.maxItems ?? 50)} onClick={() => open(rows.length)}>{ctx.t('ops.vista.addColor')}</button>
    </div>
    {rows.map((row, index) => <article key={String(row.option_key)} className={c.section}>
      <div className={c.row}>
        <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid currentColor', background: String(row.color_code || 'transparent') }} />
        <strong>{String(row.color_name || field.label)}</strong>
        {row.is_default === true && <small>{ctx.t('ops.vista.defaultColor')}</small>}
        <button className={c.button} type="button" onClick={() => open(index)}>{ctx.t('ops.vista.editColor')}</button>
        {!row.is_default && <button className={c.button} type="button" onClick={() => onChange(rows.map((item, i) => ({...item, is_default:i === index})))}>{ctx.t('ops.vista.setDefaultColor')}</button>}
      </div>
      <p style={{marginTop:8}}>{ctx.t('ops.vista.colorSummary')}: {String(row.stock_quantity ?? 0)} · {ctx.t('ops.vista.photos')}: {Array.isArray(row.image_ids) ? row.image_ids.length : 0} · {ctx.t('ops.vista.sizes')}: {Array.isArray(row.sizes) ? row.sizes.length : 0}</p>
    </article>)}
    <dialog ref={dialog} aria-labelledby={title} onCancel={close} onClose={() => setEditing(null)}
      onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault(); }}
      className={ctx.theme === 'shop' ? 'bg-background text-foreground border rounded-2xl shadow-xl p-6 backdrop:bg-black/50' : 'bg-body text-body border rounded-4 shadow p-4'}
      style={{ width: 'min(900px, 95vw)', maxHeight: '90vh', overflowY: 'auto', margin: 'auto' }}>
      {editing !== null && <>
        <h2 id={title}>{ctx.t('ops.vista.editColor')}: {String(draft.color_name || field.label)}</h2>
        {render(draft, next => {
          const sizes = Array.isArray(next.sizes) ? next.sizes as VistaValues[] : [];
          const stock = sizes.reduce((total, size) => total + Number(size.stock_quantity || 0), 0);
          // These quantities are additional allocations, not current Vista stock.
          // A zero-allocation edit must not mark stocked colors out of stock.
          setDraft(sizes.length ? {...next, stock_quantity: stock} : next);
        })}
        <div className={c.row} style={{ marginTop: 20 }}>
          <button type="button" className={c.button} onClick={() => {
            const controls = dialog.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
            if (controls && [...controls].some(control => !control.reportValidity())) return;
            const next = [...rows]; next[editing] = draft;
            onChange(next.map((row, i) => draft.is_default && i !== editing ? { ...row, is_default: false } : row)); close();
          }}>{ctx.t('ops.save')}</button>
          <button type="button" className={c.button} onClick={close}>{ctx.t('ops.cancel')}</button>
          {editing < rows.length && <button type="button" className={c.button} onClick={() => {
            const remaining = rows.filter((_, i) => i !== editing);
            if (remaining.length && !remaining.some(row => row.is_default)) remaining[0] = {...remaining[0], is_default: true};
            onChange(remaining); close();
          }}>{ctx.t('ops.vista.removeColor')}</button>}
        </div>
      </>}
    </dialog>
  </section>;
}

/** Same compact per-color size table used in the Seller creation dialog. */
export function VistaSizeRows({field, value, onChange}: {field:VistaField; value:unknown; onChange:(value:VistaValues[])=>void}) {
  const ctx = useEditor(); const c = classes(ctx.theme);
  const rows = (Array.isArray(value) ? value : []) as VistaValues[];
  const shown = (field.fields ?? []).filter(f => ['size_label','stock_quantity','stock_status'].includes(f.key));
  const update = (index:number, key:string, value:unknown) => {
    const next = {...rows[index], [key]:value};
    if (key === 'size_label') {
      const match = String(value).replace(/\s+/g, '').match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
      ['lens_width','bridge_width','temple_length'].forEach((key,i) => { next[key] = Number(match?.[i+1] ?? 0); });
    }
    onChange(rows.map((row, i) => i === index ? next : row));
  };
  return <fieldset className={c.section}><legend>{field.label}</legend>
    <button className={c.button} type="button" disabled={rows.length >= (field.maxItems ?? 50)} onClick={() => onChange([...rows, {option_key:crypto.randomUUID(), size_label:'', stock_quantity:0, stock_status:'in_stock'}])}>{ctx.t('ops.vista.addSize')}</button>
    <div style={{overflowX:'auto'}}><table style={{width:'100%', marginTop:12}}><thead><tr>{shown.map(f => <th key={f.key} style={{textAlign:'left',padding:8}}>{f.label}</th>)}<th /></tr></thead><tbody>
      {rows.map((row,index) => <tr key={String(row.option_key)}>{shown.map(f => <td key={f.key} style={{padding:8, minWidth:f.type==='text'?190:120}}>
        {f.type === 'select' ? <select className={c.input} aria-label={f.label} value={String(row[f.key] ?? 'in_stock')} onChange={e=>update(index,f.key,e.target.value)}>{f.options?.map(option => <option key={option} value={option}>{option.replaceAll('_',' ')}</option>)}</select>
          : <input className={c.input} aria-label={f.label + (f.required ? ' *' : '')} required={f.required} type={f.type==='number'?'number':'text'} min={f.min} step={f.step} maxLength={f.maxLength} value={String(row[f.key] ?? '')} onChange={e=>update(index,f.key,f.type==='number'?Number(e.target.value):e.target.value)} />}
      </td>)}<td><button className={c.button} type="button" onClick={()=>onChange(rows.filter((_,i)=>i!==index))}>{ctx.t('ops.vista.remove')}</button></td></tr>)}
    </tbody></table></div>
    <p>{ctx.t('ops.vista.colorSummary')}: {rows.reduce((sum,row)=>sum+Number(row.stock_quantity||0),0)}</p>
  </fieldset>;
}

export function VistaPackRows({field, value, onChange, render}: {field:VistaField; value:unknown; onChange:(rows:VistaValues[])=>void; render:(row:VistaValues, change:(row:VistaValues)=>void)=>ReactNode}) {
  const ctx = useEditor(); const c = classes(ctx.theme);
  const rows = (Array.isArray(value) ? value : []) as VistaValues[];
  const quantities = rows.map(row=>row.quantity).filter(Boolean).join(', ');
  const [unitsDraft,setUnitsDraft] = useState<string | null>(null);
  const units = unitsDraft ?? quantities;
  const [error,setError] = useState('');
  function applyUnits() {
    if (unitsDraft === null) return;
    const parts = units.split(/[,\s]+/).filter(Boolean);
    if(parts.some(part=>!/^\d+$/.test(part) || Number(part)<1 || Number(part)>1000000) || parts.length>(field.maxItems ?? 50)) {setError(ctx.t('ops.vista.invalidUnits')); return;}
    setError('');
    const next = [...new Set(parts.map(Number))].map(quantity=>rows.find(row=>Number(row.quantity)===quantity) ?? {option_key:crypto.randomUUID(),quantity,image_ids:[],variant_keys:[]});
    onChange(next);
    setUnitsDraft(null);
  }
  return <fieldset className={c.section}><legend>{field.label}</legend>
    <label>{ctx.t('ops.vista.packUnits')}<input className={c.input} value={units} onChange={e=>setUnitsDraft(e.target.value)} onBlur={applyUnits} placeholder="10, 20, 30"/></label>
    <p>{ctx.t('ops.vista.packHelp')}</p>
    {error && <p role="alert">{error}</p>}
    {rows.map((row,index)=><section className={c.section} key={String(row.option_key)}>
      <h3>{ctx.t('ops.vista.pack')} × {String(row.quantity ?? '')}</h3>
      {render(row,next=>onChange(rows.map((item,i)=>i===index?next:item)))}
      <button type="button" className={c.button} onClick={()=>onChange(rows.filter((_,i)=>i!==index))}>{ctx.t('ops.vista.remove')}</button>
    </section>)}
    <button type="button" className={c.button} disabled={rows.length >= (field.maxItems ?? 50)} onClick={()=>onChange([...rows,{option_key:crypto.randomUUID(),image_ids:[],variant_keys:[]}])}>{ctx.t('ops.vista.addPack')}</button>
  </fieldset>;
}

export function VistaCommonSections({ fields, render, section = 'all', children }: {fields: VistaField[]; render: (fields: VistaField[]) => ReactNode; section?: 'all' | 'basic' | 'pricing' | 'listing'; children?: ReactNode}) {
  const ctx = useEditor();
  const groups = [
    { title: 'ops.vista.basic', keys: ['name', 'sku', 'description', 'short_description'] },
    { title: 'ops.vista.pricing', keys: ['price', 'compare_at_price', 'cost_price', 'stock_status'] },
    { title: 'ops.vista.listing', keys: ['is_active', 'is_featured'] },
  ];
  const known = groups.flatMap(g => g.keys);
  return <>{groups.filter(g => section === 'all' || g.title === 'ops.vista.' + section).map(g => <section className={classes(ctx.theme).section} style={{borderRadius:16, padding:24, marginBottom:24}} key={g.title}>
    <h2 className={ctx.theme === 'shop' ? 'text-xl font-semibold border-b pb-4 mb-5' : 'h4 border-bottom pb-3 mb-4'}>{ctx.t(g.title)}</h2>
    {render(fields.filter(f => g.keys.includes(f.key)))}
    {children}
  </section>)}{section === 'all' && render(fields.filter(f => !known.includes(f.key)))}</>;
}

export function VistaImagePicker({ value = [], onChange, label, library = false, max = 10 }: { value?: unknown; onChange?: (v: string[]) => void; label: string; library?: boolean; max?: number }) {
  const ctx = useEditor();
  const c = classes(ctx.theme);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const draggedPhoto = useRef<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
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
    {!library && selected.length > 0 && <ol className={c.row} aria-label={ctx.t('ops.vista.photoOrder')}>
      {selected.map((key, index) => <li key={key} draggable
        onDragStart={() => { draggedPhoto.current = key; }}
        onDragEnd={() => { draggedPhoto.current = null; }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const from = draggedPhoto.current; if (!from || from === key || !selected.includes(from)) return;
          const next = selected.filter(id => id !== from); next.splice(next.indexOf(key), 0, from); onChange?.(next); draggedPhoto.current = null;
        }}>
        {product.images?.some(image => String(image.id) === key && image.scan_status === 'clean' && !image.archived_at)
          ? <img src={`${ctx.imageBase}/catalog-images/${key}`} alt={`${label} ${index + 1}`} width={80} height={60} style={{ objectFit: 'contain' }} />
          : <span role="status">{ctx.t('ops.vista.uploading')}</span>}
        <span>{index === 0 ? ctx.t('ops.vista.featuredPhoto') : index + 1}</span>
        {index > 0 && <button type="button" className={c.button} onClick={() => onChange?.([key, ...selected.filter(id => id !== key)])}>{ctx.t('ops.vista.setFeatured')}</button>}
        {index > 0 && <button type="button" className={c.button} aria-label={`${ctx.t('ops.vista.moveEarlier')} ${index + 1}`} onClick={() => {
          const next = [...selected]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange?.(next);
        }}>{ctx.t('ops.vista.moveEarlier')}</button>}
      </li>)}
    </ol>}
    <div className={c.row}>
      {(product.images ?? []).filter(i => !i.archived_at).sort((a, b) => a.id - b.id).map(image => (
        <label key={image.id} style={{ width: 126, border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }}>
          {image.scan_status === "clean"
            ? <img src={`${ctx.imageBase}/catalog-images/${image.id}`} alt={image.filename} width={106} height={76} style={{ objectFit: "contain" }} />
            : <span role="status">{image.filename}: {image.scan_status}</span>}
          {!library && <input type="checkbox" aria-label={`${label}: ${image.filename}`} disabled={image.scan_status !== "clean" || (!selected.includes(String(image.id)) && selected.length >= max)}
            checked={selected.includes(String(image.id))} onChange={e => onChange?.(e.target.checked ? [...selected, String(image.id)] : selected.filter(v => v !== String(image.id)))} />}
          <small style={{ display: "block", overflowWrap: "anywhere" }}>{image.filename}</small>
        </label>
      ))}
    </div>
    <label htmlFor={id}>{ctx.t("ops.vista.uploadImages")}</label>
    <input id={id} className={c.input} type="file" accept="image/png,image/jpeg,image/webp" multiple={max > 1} disabled={busy}
      onChange={async e => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (!files.length) return;
        setError(""); setBusy(true);
        const added: string[] = [];
        try {
          if (!library && files.length + selected.length > max) throw new Error(ctx.t("ops.vista.photoLimit") + " " + max);
          for (const file of files) {
            if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error(ctx.t("ops.vista.imageLimits"));
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
    <div className={c.row}>
      <label htmlFor={id + '-url'}>{ctx.t('ops.vista.imageUrl')}</label>
      <input id={id + '-url'} type="url" className={c.input} placeholder="https://…" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} />
      <button type="button" className={c.button} disabled={busy || !photoUrl.trim() || (!library && selected.length >= max)} onClick={async () => {
        setBusy(true); setError('');
        try {
          const response = await ctx.request<{data:{id:number}}>(`/products/${ctx.product.id}/images/from-url`, {
            method:'POST', body:JSON.stringify({url:photoUrl.trim(), upload_key:crypto.randomUUID()}),
          });
          if (!library) onChange?.([...selected, String(response.data.id)]);
          setPhotoUrl('');
          setProduct((await ctx.request<{data:Product}>(`/products/${ctx.product.id}`)).data);
          ctx.refresh();
        } catch (e) { setError(e instanceof Error ? e.message : ctx.t('ops.vista.uploadFailed')); }
        finally { setBusy(false); }
      }}>{ctx.t('ops.vista.addImageUrl')}</button>
    </div>
    <small>{ctx.t('ops.vista.imageUrlHelp')}</small>
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
  if (field.type === "images") return <VistaImagePicker label={field.label} value={value} onChange={onChange} max={field.maxItems ?? 10} />;
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
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<VistaValues>({});
  useEffect(() => { if (editing !== null) dialog.current?.showModal(); }, [editing]);
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
    const seen = new Set(rows.map(row => `${row.field_type}|${row.eye_type}|${String(row.value).trim()}`));
    onChange([...rows, ...added.filter(row => {
      const key = `${row.field_type}|${row.eye_type}|${row.value}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    })].slice(0, 1000)); setBulk("");
  };
  function open(index: number) {
    setDraft(structuredClone(rows[index] ?? { option_key: crypto.randomUUID(), field_type: stored, value: '', label: '',
      eye_type: eyeSpecific ? eye === 'left' ? 'left' : 'right' : 'both', sort_order: rows.length, is_active: true }));
    setEditing(index);
  }
  function close() { dialog.current?.close(); setEditing(null); }
  return <fieldset className={c.section}><legend>{ctx.t("ops.vista.prescription")}</legend>
    <div className={c.row}>{Object.entries(labels).filter(([k]) => k !== "sph" || astigmatism).map(([k, label]) =>
      <button type="button" className={c.button} key={k} aria-pressed={active === k} onClick={() => setTab(k)}>{label}</button>)}</div>
    {eyeSpecific && <div className={c.row}>{["all", "right", "left"].map(e =>
      <button type="button" key={e} className={c.button} aria-pressed={eye === e} onClick={() => setEye(e)}>{ctx.t("ops.vista.eye." + e)}</button>)}
      <button type="button" className={c.button} onClick={() => {
        const existing = new Set(rows.filter(row => row.field_type === stored && row.eye_type === 'left').map(row => String(row.value).trim()));
        const copies = rows.filter(row => row.field_type === stored && row.eye_type === 'right' && !existing.has(String(row.value).trim()));
        onChange([...rows, ...copies.map((row, i) => ({...row, option_key: crypto.randomUUID(), eye_type: 'left', sort_order: rows.length + i}))].slice(0, 1000));
      }}>{ctx.t('ops.vista.copyRightLeft')}</button></div>}
    <button type="button" className={c.button} onClick={() => open(rows.length)} disabled={rows.length >= 1000}>{ctx.t("ops.vista.addValue")}</button>
    <details className={c.section}><summary>{ctx.t('ops.vista.bulk')}</summary>
      <label>{ctx.t("ops.vista.bulk")}<textarea className={c.input} value={bulk} onChange={e => setBulk(e.target.value)} /></label>
      <button type="button" className={c.button} disabled={!bulk.trim()} onClick={() => add(bulk.split(/[,\n]/).map(v => v.trim()).filter(Boolean))}>{ctx.t("ops.vista.addValues")}</button>
    </details>
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12}}>
    {rows.map((row, index) => {
      const type = row.field_type === "sph" ? "pwr" : row.field_type;
      if (type !== stored || (eyeSpecific && eye !== "all" && row.eye_type !== eye && row.eye_type !== "both")) return null;
      return <article className={c.section} key={String(row.option_key)} aria-label={`${labels[active]} value ${index + 1}`}>
        <strong>{String(row.value)} {['pwr','sph','cyl'].includes(active) ? 'D' : active === 'axis' ? '°' : 'mm'}</strong>
        {row.label && row.label !== row.value ? <p>{String(row.label)}</p> : null}
        {eyeSpecific && <p>{ctx.t('ops.vista.eye.' + String(row.eye_type))}</p>}
        <p>{ctx.t('ops.vista.sort')}: {String(row.sort_order ?? 0)}</p>
        <div className={c.row}><button type="button" className={c.button} onClick={() => open(index)}>{ctx.t('ops.edit')}</button>
        <button type="button" className={c.button} onClick={() => onChange(rows.filter((_, i) => i !== index))}>{ctx.t("ops.vista.remove")}</button></div>
      </article>;
    })}
    </div>
    <dialog ref={dialog} aria-labelledby={title} onCancel={close} onClose={() => setEditing(null)}
      onKeyDown={e => { if(e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault(); }}
      className={ctx.theme === 'shop' ? 'bg-background text-foreground border rounded-2xl p-6 shadow-xl backdrop:bg-black/50' : 'bg-body text-body border rounded-4 p-4 shadow'}
      style={{width:'min(560px, 95vw)', maxHeight:'90vh', overflowY:'auto', margin:'auto'}}>
      {editing !== null && <div className={c.section}>
        <h2 id={title}>{ctx.t(editing < rows.length ? 'ops.edit' : 'ops.vista.addValue')} · {labels[active]}</h2>
        <p>{ctx.product.name}</p>
        <label>{labels[active]}<input className={c.input} required maxLength={50} value={String(draft.value ?? '')} onChange={e => setDraft({...draft, value:e.target.value})}/></label>
        <label>{ctx.t('ops.vista.displayLabel')}<input className={c.input} maxLength={100} value={String(draft.label ?? '')} onChange={e => setDraft({...draft, label:e.target.value})}/></label>
        {eyeSpecific && <label>{ctx.t('ops.vista.eyeLabel')}<select className={c.input} value={String(draft.eye_type)} onChange={e => setDraft({...draft, eye_type:e.target.value})}>
          {['right','left','both'].map(e => <option key={e} value={e}>{ctx.t('ops.vista.eye.'+e)}</option>)}</select></label>}
        <label>{ctx.t('ops.vista.sort')}<input type="number" min={0} className={c.input} value={Number(draft.sort_order ?? 0)} onChange={e => setDraft({...draft, sort_order:Number(e.target.value)})}/></label>
        <label><input type="checkbox" checked={draft.is_active !== false} onChange={e => setDraft({...draft, is_active:e.target.checked})}/>{ctx.t('ops.vista.active')}</label>
        <div className={c.row}><button type="button" className={c.button} disabled={!String(draft.value ?? '').trim()} onClick={() => {
          if ([...(dialog.current?.querySelectorAll<HTMLInputElement>('input') ?? [])].some(input => !input.reportValidity())) return;
          const next = [...rows]; next[editing] = {...draft, value:String(draft.value).trim()}; onChange(next); close();
        }}>{ctx.t('ops.save')}</button><button type="button" className={c.button} onClick={close}>{ctx.t('ops.cancel')}</button></div>
      </div>}
    </dialog>
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
