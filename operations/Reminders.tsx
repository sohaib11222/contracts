import { useState } from "react";
import {
  useOps,
  useLoad,
  State,
  Pager,
  Edit,
  Choice,
  CustomerChoice,
  CustomerActions,
  initial,
  options,
  json,
  today,
} from "./shared";
import type { Followup, Page, Reminder, Template } from "./types";

export default function Reminders({ customerId }: { customerId?: number }) {
  const { ui: U, request, can, t, params } = useOps();
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState(params.get("kind") ?? "");
  const [status, setStatus] = useState("open");
  const [bucket, setBucket] = useState(params.get("bucket") ?? "");
  const [edit, setEdit] = useState<Reminder | null | undefined>(() =>
    params.get("create") === "1" ? null : undefined,
  );
  const [closing, setClosing] = useState<{ row: Reminder; status: string }>();
  const cid = customerId ? String(customerId) : params.get("customer") ?? "";
  const query = new URLSearchParams({
    page: String(page),
    kind,
    status,
    bucket,
    customer_id: cid,
    id: params.get("id") ?? "",
  });
  const q = useLoad<Page<Reminder>>("/reminders?" + query, 30000);
  return (
    <U.Panel
      title={t("ops.reminders")}
      actions={
        can("reminders.write") && (
          <U.Button onClick={() => setEdit(null)}>
            {t("ops.addReminder")}
          </U.Button>
        )
      }
    >
      <U.Stack>
        <U.Alert>{t("ops.reminderHelp")}</U.Alert>
        <U.Stack inline>
          <Choice
            label={t("ops.type")}
            value={kind}
            onChange={(v) => {
              setKind(v);
              setPage(1);
            }}
            choices={[
              { value: "", label: t("ops.all") },
              ...options(
                ["checkup", "contact_lens", "custom", "order", "followup"],
                t,
              ),
            ]}
          />
          <Choice
            label={t("ops.status")}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            choices={options(["open", "completed", "cancelled", "all"], t)}
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
        <State {...q} />
        <U.Table
          headers={[
            t("ops.deadline"),
            t("ops.type"),
            t("ops.customer"),
            t("ops.details"),
            t("ops.actions"),
          ]}
          rows={(q.data?.data ?? []).map((row) => [
            row.due_on,
            t("ops." + row.kind),
            row.customer ? (
              <CustomerActions
                id={row.customer.id}
                phone={row.customer.phone}
                reminderId={row.status === "open" ? row.id : undefined}
              />
            ) : (
              "—"
            ),
            <>
              <strong>{row.title}</strong>
              <p>{row.notes}</p>
              {row.automation_error && (
                <U.Alert error>{t("ops.automationError")}</U.Alert>
              )}
              <p>
                {t("ops." + row.status)} {row.completion_note}
              </p>
              {row.order_id && (
                <U.Link to={"/orders/" + row.order_id}>
                  {t("ops.order")} #{row.order_id}
                </U.Link>
              )}
              {row.optical_record_id && row.customer_id && (
                <U.Link to={"/customers/" + row.customer_id}>
                  {t("ops.examination")} #{row.optical_record_id}
                </U.Link>
              )}
            </>,
            row.status === "open" && can("reminders.write") && (
              <U.Stack inline>
                {!row.rule_id && (
                  <U.Button secondary onClick={() => setEdit(row)}>
                    {t("ops.edit")}
                  </U.Button>
                )}
                <U.Button
                  onClick={() => setClosing({ row, status: "completed" })}
                >
                  {t("ops.complete")}
                </U.Button>
                <U.Button
                  secondary
                  onClick={() => setClosing({ row, status: "cancelled" })}
                >
                  {t("ops.cancel")}
                </U.Button>
              </U.Stack>
            ),
          ])}
        />
        <Pager page={page} last={q.data?.last_page} setPage={setPage} />
        {edit !== undefined && (
          <ReminderEditor
            row={edit}
            customer={cid}
            onClose={() => setEdit(undefined)}
            onSaved={q.reload}
          />
        )}
        {closing && (
          <Edit
            title={t("ops." + closing.status)}
            values={{}}
            fields={[
              {
                key: "reason",
                label: t("ops.reason"),
                type: "textarea",
                required: true,
              },
            ]}
            onClose={() => setClosing(undefined)}
            submit={async (v) => {
              await request(
                "/reminders/" + closing.row.id + "/status",
                json("PATCH", {
                  version: closing.row.version,
                  status: closing.status,
                  reason: v.reason,
                }),
              );
              await q.reload();
            }}
          />
        )}
      </U.Stack>
    </U.Panel>
  );
}

function ReminderEditor({
  row,
  customer,
  onClose,
  onSaved,
}: {
  row: Reminder | null;
  customer: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { request, t, can, params, timezone } = useOps();
  const [cid, setCid] = useState(
    row?.customer_id ? String(row.customer_id) : customer,
  );
  const [kind, setKind] = useState(row?.kind ?? params.get("kind") ?? "custom");
  const [interval, setInterval] = useState("custom");
  const [careId, setCareId] = useState(params.get("care") ?? "");
  const [orderId, setOrderId] = useState("");
  const [template, setTemplate] = useState(String(row?.template_id ?? ""));
  const [key] = useState(() => crypto.randomUUID());
  const [carePage, setCarePage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const care = useLoad<
    Page<{
      id: number;
      kind: string;
      recorded_on: string;
      practitioner: string;
    }>
  >(
    cid && ["checkup", "contact_lens"].includes(kind) && can("optical.read")
      ? `/customers/${cid}/optical?status=finalized&page=${carePage}&kind=${kind === "contact_lens" ? "contact_lens" : ""}`
      : null,
  );
  const orders = useLoad<Page<{ id: number; number: string; status: string }>>(
    cid && kind === "order" && can("orders.read")
      ? "/orders?customer_id=" + cid + "&page=" + orderPage
      : null,
  );
  const templates = useLoad<{ data: Template[] }>(
    can("communications.read") ? "/communications/templates" : null,
  );
  return (
    <Edit
      title={t(row ? "ops.editReminder" : "ops.addReminder")}
      values={initial(
        row ?? { title: "", due_on: today(timezone), lead_days: 7 },
      )}
      fields={[
        { key: "title", label: t("ops.title"), required: true },
        ...(interval === "custom"
          ? [
              {
                key: "due_on",
                label: t("ops.deadline"),
                type: "date",
                required: true,
              },
            ]
          : []),
        { key: "notes", label: t("ops.notes"), type: "textarea" },
        {
          key: "lead_days",
          label: t("ops.leadDays"),
          type: "number",
          required: true,
          min: 0,
          max: 365,
        },
      ]}
      onClose={onClose}
      submit={async (v) => {
        await request(
          "/reminders" + (row ? "/" + row.id : ""),
          json(row ? "PATCH" : "POST", {
            title: v.title,
            due_on: interval === "custom" ? v.due_on : null,
            months: interval === "custom" ? null : Number(interval),
            notes: v.notes,
            lead_days: Number(v.lead_days),
            template_id: template ? Number(template) : null,
            ...(row
              ? { version: row.version }
              : {
                  customer_id: cid ? Number(cid) : null,
                  kind,
                  optical_record_id: careId ? Number(careId) : null,
                  order_id: orderId ? Number(orderId) : null,
                  creation_key: key,
                }),
          }),
        );
        await onSaved();
      }}
    >
      {!row && (
        <>
          <CustomerChoice
            value={cid}
            onChange={(v) => {
              setCid(v);
              setCareId("");
              setOrderId("");
            }}
          />
          <Choice
            label={t("ops.type")}
            value={kind}
            onChange={(v) => {
              setKind(v);
              setInterval("custom");
              setCareId("");
              setOrderId("");
            }}
            choices={options(
              [
                "custom",
                ...(can("optical.write") ? ["checkup", "contact_lens"] : []),
                ...(can("orders.read") ? ["order"] : []),
              ],
              t,
            )}
          />
        </>
      )}
      {kind === "checkup" && (
        <Choice
          label={t("ops.nextCheckup")}
          value={interval}
          onChange={setInterval}
          choices={[
            { value: "custom", label: t("ops.customDate") },
            ...[3, 6, 12].map((n) => ({
              value: String(n),
              label: n + " " + t("ops.months"),
            })),
          ]}
        />
      )}
      {!row && ["checkup", "contact_lens"].includes(kind) && (
        <>
          <Choice
            label={t("ops.examination")}
            value={careId}
            onChange={setCareId}
            choices={[
              { value: "", label: t("ops.choose") },
              ...(care.data?.data ?? [])
                .filter((c) =>
                  kind === "checkup"
                    ? ["optometry", "examination"].includes(c.kind)
                    : c.kind === "contact_lens",
                )
                .map((c) => ({
                  value: String(c.id),
                  label: `#${c.id} · ${c.recorded_on} · ${c.practitioner}`,
                })),
            ]}
          />
          <State {...care} />
          <Pager
            page={carePage}
            last={care.data?.last_page}
            setPage={setCarePage}
          />
        </>
      )}
      {!row && kind === "order" && (
        <>
          <Choice
            label={t("ops.order")}
            value={orderId}
            onChange={setOrderId}
            choices={[
              { value: "", label: t("ops.choose") },
              ...(orders.data?.data ?? []).map((o) => ({
                value: String(o.id),
                label: o.number + " · " + o.status,
              })),
            ]}
          />
          <State {...orders} />
          <Pager
            page={orderPage}
            last={orders.data?.last_page}
            setPage={setOrderPage}
          />
        </>
      )}
      {can("communications.manage") && (
        <Choice
          label={t("ops.automaticTemplate")}
          value={template}
          onChange={setTemplate}
          choices={[
            { value: "", label: t("ops.noAutomaticMessage") },
            ...(templates.data?.data ?? [])
              .filter((x) => x.active)
              .map((x) => ({
                value: String(x.id),
                label: `${x.name} · ${x.channel}`,
              })),
          ]}
        />
      )}
    </Edit>
  );
}

export function Followups() {
  const { ui: U, t, request, can, timezone } = useOps();
  const [edit, setEdit] = useState<Followup | null | undefined>();
  const [trigger, setTrigger] = useState("delivery");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const q = useLoad<{ data: Followup[] }>("/followup-rules");
  const templates = useLoad<{ data: Template[] }>(
    can("communications.read") ? "/communications/templates" : null,
  );
  const categories = useLoad<{ data: { id: number; name: string }[] }>(
    can("products.read") ? "/product-categories" : null,
  );
  const open = (row: Followup | null) => {
    setKey(crypto.randomUUID());
    setEdit(row);
    setTrigger(row?.trigger ?? "delivery");
  };
  return (
    <U.Panel
      title={t("ops.followups")}
      actions={
        can("followups.write") && (
          <U.Button onClick={() => open(null)}>{t("ops.addRule")}</U.Button>
        )
      }
    >
      <U.Stack>
        <U.Alert>{t("ops.followupHelp")}</U.Alert>
        <State {...q} />
        <U.Table
          headers={[
            t("ops.name"),
            t("ops.trigger"),
            t("ops.delay"),
            t("ops.status"),
            t("ops.actions"),
          ]}
          rows={(q.data?.data ?? []).map((r) => [
            r.name,
            t("ops." + r.trigger),
            `${r.offset} ${t("ops." + r.unit)}`,
            t(r.active ? "ops.active" : "ops.disabled"),
            can("followups.write") && (
              <U.Button secondary onClick={() => open(r)}>
                {t("ops.edit")}
              </U.Button>
            ),
          ])}
        />
        {edit !== undefined && (
          <Edit
            title={t("ops.followups")}
            values={initial(
              edit ?? {
                offset: 7,
                unit: "days",
                starts_on: today(timezone),
                active: true,
                lead_days: 0,
              },
            )}
            fields={[
              { key: "name", label: t("ops.name"), required: true },
              {
                key: "offset",
                label: t("ops.delay"),
                type: "number",
                min: 0,
                max: 3650,
                required: true,
              },
              {
                key: "unit",
                label: t("ops.unit"),
                type: "select",
                options: options(["days", "months"], t),
              },
              ...(["delivery", "purchase"].includes(trigger)
                ? [
                    {
                      key: "category_id",
                      label: t("ops.categoryFilter"),
                      type: "select",
                      options: [
                        { value: "", label: t("ops.all") },
                        ...(categories.data?.data ?? []).map((c) => ({
                          value: String(c.id),
                          label: c.name,
                        })),
                      ],
                    },
                  ]
                : []),
              {
                key: "starts_on",
                label: t("ops.startsOn"),
                type: "date",
                required: true,
              },
              {
                key: "active",
                label: t("ops.status"),
                type: "select",
                options: [
                  { value: "true", label: t("ops.active") },
                  { value: "false", label: t("ops.disabled") },
                ],
              },
              {
                key: "lead_days",
                label: t("ops.leadDays"),
                type: "number",
                min: 0,
                max: 365,
              },
              ...(can("communications.manage")
                ? [
                    {
                      key: "template_id",
                      label: t("ops.automaticTemplate"),
                      type: "select",
                      options: [
                        { value: "", label: t("ops.noAutomaticMessage") },
                        ...(templates.data?.data ?? [])
                          .filter(
                            (x) =>
                              x.active &&
                              (trigger !== "inactive" ||
                                x.purpose === "marketing"),
                          )
                          .map((x) => ({
                            value: String(x.id),
                            label: `${x.name} · ${x.channel}`,
                          })),
                      ],
                    },
                  ]
                : []),
            ]}
            onClose={() => setEdit(undefined)}
            submit={async (v) => {
              await request(
                "/followup-rules" + (edit ? "/" + edit.id : ""),
                json(edit ? "PATCH" : "POST", {
                  name: v.name,
                  offset: Number(v.offset),
                  unit: v.unit,
                  starts_on: v.starts_on,
                  active: v.active === "true",
                  template_id: v.template_id ? Number(v.template_id) : null,
                  lead_days: Number(v.lead_days),
                  category_id: v.category_id ? Number(v.category_id) : null,
                  ...(edit
                    ? { version: edit.version }
                    : { trigger, creation_key: key }),
                }),
              );
              await q.reload();
            }}
          >
            {!edit && (
              <Choice
                label={t("ops.trigger")}
                value={trigger}
                onChange={setTrigger}
                choices={options(
                  ["delivery", "purchase", "visit", "examination", "inactive"],
                  t,
                )}
              />
            )}
            <p>{t("ops.followupExamples")}</p>
          </Edit>
        )}
      </U.Stack>
    </U.Panel>
  );
}
