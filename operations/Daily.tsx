import { useState } from "react";
import {
  useOps,
  useLoad,
  State,
  Pager,
  Choice,
  options,
  CustomerActions,
} from "./shared";
import type { Overview } from "./types";
export default function Daily({ compact = false }: { compact?: boolean }) {
  const [expanded, setExpanded] = useState(!compact);
  const { ui: U, t, params } = useOps();
  const [filter, setFilter] = useState(params.get("filter") ?? "");
  const [bucket, setBucket] = useState(params.get("bucket") ?? "");
  const [page, setPage] = useState(1);
  const q = useLoad<Overview>(
    "/operations?" +
      new URLSearchParams({ filter, bucket, page: String(page) }),
    30000,
  );
  const types = [
    "appointment",
    "followup",
    "contact_lens",
    "checkup",
    "payment",
    "refund_due",
    "incomplete_order",
    "low_stock",
    "custom",
    "order",
  ];
  return (
    <U.Panel title={t("ops.daily")}>
      <U.Stack>
        <U.Alert>
          {t("ops.overviewHelp")} {q.data?.date} — {q.data?.horizon} (
          {q.data?.timezone})
        </U.Alert>
        <State {...q} />
        <U.Stack inline>
          {Object.entries(q.data?.counts ?? {}).map(([type, count]) => (
            <U.Button
              key={type}
              secondary={type !== filter}
              onClick={() => {
                setExpanded(true);
                setFilter(type);
                setBucket("");
                setPage(1);
              }}
            >
              <strong>{count}</strong> {t("ops." + type)}
            </U.Button>
          ))}
        </U.Stack>
        {compact && <U.Button secondary onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{t("ops.deadlines")} {expanded ? "−" : "+"}</U.Button>}
        {expanded && <div style={compact ? { maxHeight: "22rem", overflow: "auto" } : undefined}>
        <h3>{t("ops.deadlines")}</h3>
        <U.Stack inline>
          <Choice
            label={t("ops.type")}
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
            choices={[{ value: "", label: t("ops.all") }, ...options(types, t)]}
          />
          <Choice
            label={t("ops.deadline")}
            value={bucket}
            onChange={(v) => {
              setBucket(v);
              setPage(1);
            }}
            choices={[
              { value: "", label: t("ops.all") },
              ...options(["overdue", "today", "next7", "next30"], t),
            ]}
          />
        </U.Stack>
        <U.Table
          headers={[
            t("ops.deadline"),
            t("ops.type"),
            t("ops.details"),
            t("ops.customer"),
            t("ops.actions"),
          ]}
          rows={(q.data?.activities.data ?? []).map((r) => [
            r.due_on,
            t("ops." + r.type),
            r.title,
            r.customer
              ? `${r.customer.first_name} ${r.customer.last_name}`
              : "—",
            <U.Stack>
              <U.Link to={r.url}>{t("ops.openRecord")}</U.Link>
              {r.customer && (
                <CustomerActions
                  id={r.customer.id}
                  phone={r.customer.phone}
                  reminderId={
                    r.source === "reminder" ? r.reference_id : undefined
                  }
                />
              )}
            </U.Stack>,
          ])}
        />
        <Pager
          page={page}
          last={q.data?.activities.last_page}
          setPage={setPage}
        />
        </div>}
      </U.Stack>
    </U.Panel>
  );
}
