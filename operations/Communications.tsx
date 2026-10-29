import { useState } from "react";
import MessageWizard from "./MessageWizard";
import {
  useOps,
  useLoad,
  State,
  Pager,
  Edit,
  Choice,
  CustomerChoice,
  options,
  initial,
  json,
} from "./shared";
import type { Message, Page, Template } from "./types";

export default function Communications({
  customerId,
}: {
  customerId?: number;
}) {
  const { ui: U, t, can, params, request } = useOps();
  const [customer, setCustomer] = useState(
    customerId ? String(customerId) : params.get("customer") ?? "",
  );
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [composing, setComposing] = useState(!!params.get("compose"));
  const bulkIds = [
    ...new Set(
      (params.get("customers") ?? "")
        .split(",")
        .filter((v) => /^\d+$/.test(v))
        .map(Number),
    ),
  ];
  const [template, setTemplate] = useState<Template | null | undefined>();
  const [detail, setDetail] = useState<Message>();
  const [action, setAction] = useState<{ row: Message; action: string }>();
  const q = useLoad<Page<Message>>(
    "/communications/messages?" +
      new URLSearchParams({
        customer_id: customer,
        page: String(page),
        channel,
        status,
      }),
    15000,
  );
  const templates = useLoad<{ data: Template[] }>("/communications/templates");
  const ready = useLoad<{
    data: {
      sms: boolean;
      whatsapp: boolean;
      email: boolean;
      email_issues?: string[];
      processing: { worker_active: boolean; scheduler_active: boolean };
    };
  }>("/communications/readiness", 15000);
  const [tab, setTab] = useState("history");
  return (
    <U.Panel
      title={t("ops.communications")}
      actions={
        can("communications.send") && (
          <U.Button onClick={() => setComposing(true)}>
            {t("ops.compose")}
          </U.Button>
        )
      }
    >
      <U.Stack>
        <U.Alert>{t("ops.providerHelp")}</U.Alert>
        <State {...ready} />
        <U.Stack inline>
          {["sms", "whatsapp", "email"].map((c) => (
            <span key={c}>
              {t("ops." + c)}:{" "}
              {t(
                ready.data?.data[c as "sms" | "whatsapp" | "email"]
                  ? "ops.ready"
                  : "ops.notConfigured",
              )}
            </span>
          ))}
        </U.Stack>
        {ready.data && !ready.data.data.processing.worker_active && (
          <U.Alert error>{t("ops.workerStopped")}</U.Alert>
        )}
        {ready.data && !ready.data.data.processing.scheduler_active && (
          <U.Alert error>{t("ops.schedulerStopped")}</U.Alert>
        )}
        {ready.data?.data.email_issues?.map((issue) => (
          <U.Alert key={issue} error>
            {issue}
          </U.Alert>
        ))}
        {!customerId && (
          <CustomerChoice
            value={customer}
            onChange={(v) => {
              setCustomer(v);
              setPage(1);
            }}
          />
        )}
        <U.Stack inline>
          {["history", "templates"].map((name) => (
            <U.Button
              key={name}
              secondary={name !== tab}
              onClick={() => setTab(name)}
            >
              {t("ops." + name)}
            </U.Button>
          ))}
        </U.Stack>
        {tab === "history" ? (
          <>
            <U.Stack inline>
              <Choice
                label={t("ops.channel")}
                value={channel}
                onChange={(v) => {
                  setChannel(v);
                  setPage(1);
                }}
                choices={[
                  { value: "", label: t("ops.all") },
                  ...options(["sms", "whatsapp", "email"], t),
                ]}
              />
              <Choice
                label={t("ops.status")}
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
                choices={[
                  { value: "", label: t("ops.all") },
                  ...options(
                    [
                      "scheduled",
                      "blocked",
                      "sending",
                      "accepted",
                      "sent",
                      "delivered",
                      "read",
                      "failed",
                      "undelivered",
                      "retry_wait",
                      "uncertain",
                      "reviewed",
                      "cancelled",
                    ],
                    t,
                  ),
                ]}
              />
            </U.Stack>
            <State {...q} />
            <U.Table
              headers={[
                t("ops.date"),
                t("ops.customer"),
                t("ops.channel"),
                t("ops.status"),
                t("ops.actions"),
              ]}
              rows={(q.data?.data ?? []).map((m) => [
                new Date(m.scheduled_at).toLocaleString(),
                [m.customer?.first_name, m.customer?.last_name].join(" "),
                t("ops." + m.channel),
                <>
                  {t(
                    "ops." +
                      (m.status === "scheduled" &&
                      new Date(m.scheduled_at).getTime() <= Date.now()
                        ? "queued"
                        : m.status),
                  )}
                  {m.error_message && <p>{m.error_message}</p>}
                </>,
                <U.Stack inline>
                  <U.Button secondary onClick={() => setDetail(m)}>
                    {t("ops.details")}
                  </U.Button>
                  {can("communications.send") &&
                    ["scheduled", "blocked", "retry_wait"].includes(
                      m.status,
                    ) && (
                      <U.Button
                        secondary
                        onClick={() => setAction({ row: m, action: "cancel" })}
                      >
                        {t("ops.cancel")}
                      </U.Button>
                    )}
                  {can("communications.send") &&
                    (["blocked", "retry_wait"].includes(m.status) ||
                      (m.status === "failed" && !m.provider_id)) && (
                      <U.Button
                        secondary
                        onClick={() => setAction({ row: m, action: "retry" })}
                      >
                        {t("ops.retry")}
                      </U.Button>
                    )}
                  {can("communications.manage") && m.status === "uncertain" && (
                    <U.Button
                      secondary
                      onClick={() => setAction({ row: m, action: "resolve" })}
                    >
                      {t("ops.resolve")}
                    </U.Button>
                  )}
                </U.Stack>,
              ])}
            />
            <Pager page={page} last={q.data?.last_page} setPage={setPage} />
          </>
        ) : (
          <>
            <State {...templates} />
            {can("communications.manage") && (
              <U.Button onClick={() => setTemplate(null)}>
                {t("ops.addTemplate")}
              </U.Button>
            )}
            <U.Table
              headers={[
                t("ops.name"),
                t("ops.channel"),
                t("ops.purpose"),
                t("ops.status"),
                t("ops.actions"),
              ]}
              rows={(templates.data?.data ?? []).map((m) => [
                m.name,
                t("ops." + m.channel),
                t("ops." + m.purpose),
                t(m.active ? "ops.active" : "ops.disabled"),
                can("communications.manage") && (
                  <U.Button secondary onClick={() => setTemplate(m)}>
                    {t("ops.edit")}
                  </U.Button>
                ),
              ])}
            />
          </>
        )}
        {composing &&
          can("communications.send") &&
          (params.get("compose") === "whatsapp" ? (
            <Compose
              customer={customer}
              channel="whatsapp"
              templates={templates.data?.data ?? []}
              onClose={() => setComposing(false)}
              onSaved={q.reload}
            />
          ) : (
            <MessageWizard
              ids={
                bulkIds.length ? bulkIds : customer ? [Number(customer)] : []
              }
              channel={params.get("compose") ?? "email"}
              templates={templates.data?.data ?? []}
              onClose={() => setComposing(false)}
              onSaved={q.reload}
            />
          ))}
        {template !== undefined && (
          <TemplateEditor
            row={template}
            onClose={() => setTemplate(undefined)}
            onSaved={templates.reload}
          />
        )}
        {detail && (
          <MessageDetails id={detail.id} onClose={() => setDetail(undefined)} />
        )}
        {action && (
          <Edit
            title={t("ops." + action.action)}
            values={{}}
            fields={[
              {
                key: "reason",
                label: t("ops.reason"),
                type: "textarea",
                required: true,
              },
            ]}
            onClose={() => setAction(undefined)}
            submit={async (v) => {
              await request(
                "/communications/messages/" +
                  action.row.id +
                  "/" +
                  action.action,
                json("POST", { reason: v.reason, version: action.row.version }),
              );
              await q.reload();
            }}
          >
            {action.action === "resolve" && <p>{t("ops.resolveHelp")}</p>}
          </Edit>
        )}
      </U.Stack>
    </U.Panel>
  );
}

function Compose({
  customer,
  channel: initialChannel,
  templates,
  onClose,
  onSaved,
}: {
  customer: string;
  channel: string;
  templates: Template[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t, request, params } = useOps();
  const [cid, setCid] = useState(customer);
  const [channel, setChannel] = useState(initialChannel);
  const [template, setTemplate] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const [timing, setTiming] = useState("now");
  return (
    <Edit
      title={t("ops.compose")}
      values={{ purpose: "service", delay_minutes: "0" }}
      fields={[
        ...(!template
          ? [
              {
                key: "purpose",
                label: t("ops.purpose"),
                type: "select",
                options: options(["service", "marketing"], t),
              },
              ...(channel === "email"
                ? [{ key: "subject", label: t("ops.subject"), required: true }]
                : []),
              {
                key: "body",
                label: t("ops.message"),
                type: "textarea",
                required: true,
              },
            ]
          : []),
        ...(timing === "date"
          ? [
              {
                key: "scheduled_at",
                label: t("ops.sendAt"),
                type: "datetime-local",
                required: true,
              },
            ]
          : []),
        ...(timing === "delay"
          ? [
              {
                key: "delay_minutes",
                label: t("ops.delayMinutes"),
                type: "number",
                min: 0,
                max: 525600,
                required: true,
              },
            ]
          : []),
      ]}
      onClose={onClose}
      submit={async (v) => {
        await request(
          "/communications/messages",
          json("POST", {
            customer_id: Number(cid),
            reminder_id:
              cid === customer && params.get("reminder")
                ? Number(params.get("reminder"))
                : null,
            channel,
            purpose: v.purpose,
            body: v.body,
            subject: v.subject,
            template_id: template ? Number(template) : null,
            creation_key: key,
            scheduled_at:
              timing === "date" ? new Date(v.scheduled_at).toISOString() : null,
            delay_minutes: timing === "delay" ? Number(v.delay_minutes) : 0,
          }),
        );
        await onSaved();
      }}
    >
      <CustomerChoice value={cid} onChange={setCid} />
      <Choice
        label={t("ops.channel")}
        value={channel}
        onChange={(v) => {
          setChannel(v);
          setTemplate("");
        }}
        choices={options(["sms", "whatsapp", "email"], t)}
      />
      <Choice
        label={t("ops.template")}
        value={template}
        onChange={setTemplate}
        choices={[
          {
            value: "",
            label: t(
              channel === "whatsapp"
                ? "ops.chooseApproved"
                : "ops.manualMessage",
            ),
          },
          ...templates
            .filter((x) => x.active && x.channel === channel)
            .map((x) => ({
              value: String(x.id),
              label: x.name + " · " + t("ops." + x.purpose),
            })),
        ]}
      />
      {template && (
        <p style={{ whiteSpace: "pre-wrap" }}>
          {templates.find((x) => String(x.id) === template)?.body}
        </p>
      )}
      <Choice
        label={t("ops.schedule")}
        value={timing}
        onChange={setTiming}
        choices={options(["now", "delay", "date"], t)}
      />
      <p>{t("ops.messageHelp")}</p>
    </Edit>
  );
}

function TemplateEditor({
  row,
  onClose,
  onSaved,
}: {
  row: Template | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { ui: U, t, request } = useOps();
  const [channel, setChannel] = useState(row?.channel ?? "sms");
  const [mapping, setMapping] = useState(
    Object.entries(row?.content_variables ?? {}).map(
      ([position, variable]) => ({ position, variable }),
    ),
  );
  return (
    <Edit
      title={t("ops.template")}
      values={initial(row ?? { purpose: "service", active: true })}
      fields={[
        { key: "name", label: t("ops.name"), required: true },
        {
          key: "purpose",
          label: t("ops.purpose"),
          type: "select",
          disabled: !!row,
          options: options(["service", "marketing"], t),
        },
        ...(channel === "email"
          ? [{ key: "subject", label: t("ops.subject"), required: true }]
          : []),
        {
          key: "body",
          label: t("ops.message"),
          type: "textarea",
          required: true,
        },
        ...(channel === "whatsapp"
          ? [
              {
                key: "content_sid",
                label: t("ops.approvedTemplateSid"),
                required: true,
              },
            ]
          : []),
        {
          key: "active",
          label: t("ops.status"),
          type: "select",
          options: [
            { value: "true", label: t("ops.active") },
            { value: "false", label: t("ops.disabled") },
          ],
        },
      ]}
      onClose={onClose}
      submit={async (v) => {
        if (new Set(mapping.map((x) => x.position)).size !== mapping.length)
          throw new Error(t("ops.duplicateVariables"));
        await request(
          "/communications/templates" + (row ? "/" + row.id : ""),
          json(row ? "PATCH" : "POST", {
            name: v.name,
            channel,
            purpose: row?.purpose ?? v.purpose,
            subject: v.subject || null,
            body: v.body,
            active: v.active === "true",
            content_sid: channel === "whatsapp" ? v.content_sid : null,
            content_variables:
              channel === "whatsapp"
                ? Object.fromEntries(
                    mapping.map((x) => [x.position, x.variable]),
                  )
                : {},
            ...(row ? { version: row.version } : {}),
          }),
        );
        await onSaved();
      }}
    >
      {!row && (
        <Choice
          label={t("ops.channel")}
          value={channel}
          onChange={setChannel}
          choices={options(["sms", "whatsapp", "email"], t)}
        />
      )}
      <p>{t("ops.templateHelp")}</p>
      {channel === "whatsapp" && (
        <U.Stack>
          {mapping.map((pair, i) => (
            <U.Stack key={i} inline>
              <U.Field
                key={"position-" + i}
                label={t("ops.variableNumber")}
                type="number"
                min={1}
                max={99}
                value={pair.position}
                onChange={(v) =>
                  setMapping((old) =>
                    old.map((x, n) => (n === i ? { ...x, position: v } : x)),
                  )
                }
              />
              <Choice
                label={t("ops.variable")}
                value={pair.variable}
                onChange={(v) =>
                  setMapping((old) =>
                    old.map((x, n) => (n === i ? { ...x, variable: v } : x)),
                  )
                }
                choices={[
                  "first_name",
                  "last_name",
                  "shop_name",
                  "due_date",
                  "reference",
                ].map((x) => ({ value: x, label: x }))}
              />
              <U.Button
                secondary
                onClick={() =>
                  setMapping((old) => old.filter((_, n) => n !== i))
                }
              >
                {t("ops.remove")}
              </U.Button>
            </U.Stack>
          ))}
          <U.Button
            secondary
            onClick={() =>
              setMapping((old) => [
                ...old,
                { position: String(old.length + 1), variable: "first_name" },
              ])
            }
          >
            {t("ops.addVariable")}
          </U.Button>
        </U.Stack>
      )}
    </Edit>
  );
}

function MessageDetails({ id, onClose }: { id: number; onClose: () => void }) {
  const { ui: U, t } = useOps();
  const q = useLoad<{ data: Message }>("/communications/messages/" + id, 15000);
  const m = q.data?.data;
  return (
    <U.Dialog title={t("ops.message")} onClose={onClose}>
      <State {...q} />
      {m && (
        <U.Stack>
          <p>
            {m.recipient} · {t("ops." + m.channel)} ·{" "}
            {t(
              "ops." +
                (m.status === "scheduled" &&
                new Date(m.scheduled_at).getTime() <= Date.now()
                  ? "queued"
                  : m.status),
            )}
          </p>
          <strong>{m.subject}</strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
          {m.error_message && (
            <U.Alert error>
              {m.error_message} ({m.error_code})
            </U.Alert>
          )}
          <U.Alert>{t("ops.deliveryHelp")}</U.Alert>
          <U.Table
            headers={[t("ops.date"), t("ops.status"), t("ops.details")]}
            rows={(m.events ?? []).map((e) => [
              new Date(e.created_at).toLocaleString(),
              t("ops." + e.status),
              [e.code, e.reason, e.actor_id ? "#" + e.actor_id : ""]
                .filter(Boolean)
                .join(" · "),
            ])}
          />
        </U.Stack>
      )}
    </U.Dialog>
  );
}
