/* eslint-disable react-refresh/only-export-components -- shared workflow context and hooks */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ComponentType,
  type ReactNode,
} from "react";
import { ApiError, type createApi } from "../session";
export type FieldSpec = {
  key?: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  disabled?: boolean;
  hint?: string;
};
export type Values = Record<string, string>;
export type UI = {
  Panel: ComponentType<{
    title?: string;
    children: ReactNode;
    actions?: ReactNode;
  }>;
  Stack: ComponentType<{ children: ReactNode; inline?: boolean }>;
  Button: ComponentType<{
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit";
    secondary?: boolean;
    "aria-expanded"?: boolean;
  }>;
  Field: ComponentType<
    FieldSpec & { value: string; onChange: (value: string) => void }
  >;
  Table: ComponentType<{ headers: string[]; rows: ReactNode[][] }>;
  Dialog: ComponentType<{
    title: string;
    children: ReactNode;
    onClose: () => void;
  }>;
  Alert: ComponentType<{ children: ReactNode; error?: boolean }>;
  Link: ComponentType<{ to: string; children: ReactNode }>;
};
export type Workspace = {
  ui: UI;
  request: ReturnType<typeof createApi>["request"];
  can: (p: string) => boolean;
  t: (key: string) => string;
  params: URLSearchParams;
  actorId: number;
  timezone: string;
  invitationUrl: (token: string) => string;
};
export const Context = createContext<Workspace | null>(null);
export function useOps() {
  const v = useContext(Context);
  if (!v) throw new Error("Operations workspace is missing");
  return v;
}
export function errorText(e: unknown): string {
  if (e instanceof ApiError)
    return [
      e.message,
      ...Object.entries(e.errors).flatMap(([k, values]) =>
        values.map((v) => `${k}: ${v}`),
      ),
    ].join(" ");
  return e instanceof Error ? e.message : "Request failed";
}
export function useLoad<T>(path: string | null, interval = 0) {
  const { request } = useOps();
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const serial = useRef(0);
  const pending = useRef(false);
  const reload = useCallback(async () => {
    if (!path) return;
    const n = ++serial.current;
    pending.current = true;
    setBusy(true);
    try {
      const result = await request<T>(path);
      if (n === serial.current) {
        setData(result);
        setError("");
      }
    } catch (e) {
      if (n === serial.current) setError(errorText(e));
    } finally {
      if (n === serial.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }, [path, request]);
  const invalidate = useCallback(() => {
    serial.current++;
    pending.current = false;
  }, []);
  useEffect(() => {
    pending.current = false;
    setData(undefined);
    void reload();
    const timer = interval
      ? setInterval(() => {
          if (!document.hidden && !pending.current) void reload();
        }, interval)
      : undefined;
    return () => {
      invalidate();
      clearInterval(timer);
    };
  }, [reload, interval, invalidate]);
  return { data, error, busy, reload };
}
export function State({ error, busy }: { error: string; busy: boolean }) {
  const { ui: U, t } = useOps();
  return (
    <>
      {error && <U.Alert error>{error}</U.Alert>}
      {busy && <p role="status">{t("ops.loading")}</p>}
    </>
  );
}
export function Pager({
  page,
  last = 1,
  setPage,
}: {
  page: number;
  last?: number;
  setPage: (n: number) => void;
}) {
  const { ui: U, t } = useOps();
  return (
    <U.Stack inline>
      <U.Button
        secondary
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        {t("ops.previous")}
      </U.Button>
      <span>
        {page} / {last}
      </span>
      <U.Button
        secondary
        disabled={page >= last}
        onClick={() => setPage(page + 1)}
      >
        {t("ops.next")}
      </U.Button>
    </U.Stack>
  );
}
export function options(values: string[], t: (k: string) => string) {
  return values.map((value) => ({ value, label: t("ops." + value) }));
}
export function initial(row: object = {}): Values {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      v === null || v === undefined
        ? ""
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v),
    ]),
  );
}
export function Edit({
  title,
  fields,
  values,
  submit,
  onClose,
  children,
  onValues,
}: {
  title: string;
  fields: FieldSpec[];
  values: Values;
  submit: (v: Values) => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
  onValues?: (v: Values) => void;
}) {
  const { ui: U, t } = useOps();
  const [draft, setDraft] = useState(values);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <U.Dialog
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          void submit(draft)
            .then(onClose)
            .catch((e) => setError(errorText(e)))
            .finally(() => setBusy(false));
        }}
      >
        <U.Stack>
          {fields.map((f) => (
            <U.Field
              key={f.key}
              {...f}
              value={draft[f.key ?? ""] ?? ""}
              onChange={(value) => {
                const next = { ...draft, [f.key ?? ""]: value };
                setDraft(next);
                onValues?.(next);
              }}
            />
          ))}
          {children}
          {error && <U.Alert error>{error}</U.Alert>}
          <U.Stack inline>
            <U.Button type="submit" disabled={busy}>
              {busy ? t("ops.saving") : t("ops.save")}
            </U.Button>
            <U.Button secondary disabled={busy} onClick={onClose}>
              {t("ops.cancel")}
            </U.Button>
          </U.Stack>
        </U.Stack>
      </form>
    </U.Dialog>
  );
}
export function Choice({
  label,
  value,
  onChange,
  choices,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  choices: { value: string; label: string }[];
}) {
  const { ui: U } = useOps();
  return (
    <U.Field
      key="choice"
      label={label}
      value={value}
      onChange={onChange}
      type="select"
      options={choices}
    />
  );
}
export function CustomerChoice({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { ui: U, t } = useOps();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useLoad<{
    data: { id: number; first_name: string; last_name: string }[];
    meta?: { last_page: number };
    last_page?: number;
  }>(
    "/customers?per_page=50&page=" +
      page +
      "&search=" +
      encodeURIComponent(search),
  );
  return (
    <U.Stack>
      <U.Field
        key="customer-search"
        label={t("ops.searchCustomer")}
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />
      <Choice
        label={t("ops.customer")}
        value={value}
        onChange={onChange}
        choices={[
          { value: "", label: t("ops.choose") },
          ...(value && !q.data?.data.some((c) => String(c.id) === value)
            ? [{ value, label: "#" + value }]
            : []),
          ...(q.data?.data ?? []).map((c) => ({
            value: String(c.id),
            label: `${c.first_name} ${c.last_name} #${c.id}`,
          })),
        ]}
      />
      <State {...q} />
      <Pager
        page={page}
        last={q.data?.meta?.last_page ?? q.data?.last_page}
        setPage={setPage}
      />
    </U.Stack>
  );
}
export function CustomerActions({
  id,
  phone,
  reminderId,
}: {
  id: number;
  phone?: string;
  reminderId?: number;
}) {
  const { ui: U, t, can } = useOps();
  return (
    <U.Stack inline>
      {can("customers.read") && (
        <U.Link to={"/customers/" + id}>{t("ops.customer")}</U.Link>
      )}
      {can("communications.send") &&
        ["whatsapp", "sms", "email"].map((channel) => (
          <U.Link
            key={channel}
            to={`/communications?customer=${id}&compose=${channel}${reminderId ? `&reminder=${reminderId}` : ""}`}
          >
            {t("ops." + channel)}
          </U.Link>
        ))}
      {phone && (
        <a href={"tel:" + phone.replace(/[^+0-9]/g, "")}>{t("ops.call")}</a>
      )}
    </U.Stack>
  );
}
export function today(zone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function json(method: string, body: object): RequestInit {
  return { method, body: JSON.stringify(body) };
}
