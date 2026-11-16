import { useState } from "react";
import MessageWizard from "./MessageWizard";
import { useOps, useLoad, State, Pager, Edit, Choice, CustomerChoice, options, initial, json } from "./shared";
import type { Message, Page, Template } from "./types";

/** Email history, reusable email templates, and the guided email composer. */
export default function Communications({ customerId }: { customerId?: number }) {
  const { ui: U, t, can, params, request, initialRecipientIds, initialRecipientCount } = useOps();
  const [customer, setCustomer] = useState(customerId ? String(customerId) : params.get("customer") ?? "");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [composing, setComposing] = useState(!!params.get("compose"));
  const [template, setTemplate] = useState<Template | null | undefined>();
  const [detail, setDetail] = useState<Message>();
  const [action, setAction] = useState<{ row: Message; action: "cancel" | "retry" | "resolve" }>();
  const bulkIds = [...new Set((params.get("customers") ?? "").split(",").filter((value) => /^\d+$/.test(value)).map(Number))];
  const q = useLoad<Page<Message>>(
    "/communications/messages?" + new URLSearchParams({ customer_id: customer, channel: "email", purpose, status, date_from: dateFrom, date_to: dateTo, page: String(page) }),
    15000,
  );
  const templates = useLoad<{ data: Template[] }>("/communications/templates");
  const [tab, setTab] = useState<"history" | "templates">("history");

  return (
    <U.Panel title={t("ops.communications")} actions={can("communications.send") && <U.Button onClick={() => setComposing(true)}>{t("ops.compose")}</U.Button>}>
      <U.Stack>
        <U.Stack inline>
          <U.Button secondary={tab !== "history"} onClick={() => setTab("history")}>{t("ops.history")}</U.Button>
          <U.Button secondary={tab !== "templates"} onClick={() => setTab("templates")}>{t("ops.templates")}</U.Button>
        </U.Stack>
        {tab === "history" ? (
          <>
            <U.Stack inline>
              {!customerId && <CustomerChoice value={customer} onChange={(value) => { setCustomer(value); setPage(1); }} />}
              <Choice label={t("ops.status")} value={status} onChange={(value) => { setStatus(value); setPage(1); }} choices={[{ value: "", label: t("ops.all") }, ...options(["scheduled", "accepted", "sending", "sent", "delivered", "failed", "retry_wait", "uncertain", "reviewed", "cancelled"], t)]} />
              <Choice label={t("ops.type")} value={purpose} onChange={(value) => { setPurpose(value); setPage(1); }} choices={[{ value: "", label: t("ops.all") }, ...options(["service", "marketing"], t)]} />
              <U.Field label={t("ops.from")} type="date" value={dateFrom} onChange={(value) => { setDateFrom(value); setPage(1); }} />
              <U.Field label={t("ops.to")} type="date" value={dateTo} onChange={(value) => { setDateTo(value); setPage(1); }} />
            </U.Stack>
            <State {...q} />
            <U.Table
              headers={[t("ops.customer"), t("ops.subject"), t("ops.date"), t("ops.type"), t("ops.status"), t("ops.actions")]}
              rows={(q.data?.data ?? []).map((message) => [
                [message.customer?.first_name, message.customer?.last_name].filter(Boolean).join(" "),
                message.subject || "—",
                new Date(message.scheduled_at).toLocaleString(),
                t("ops." + message.purpose),
                <>{t("ops." + (message.status === "scheduled" && new Date(message.scheduled_at).getTime() <= Date.now() ? "queued" : message.status))}{message.error_message && <p>{message.error_message}</p>}</>,
                <U.Stack inline>
                  <U.Button secondary onClick={() => setDetail(message)}>{t("ops.details")}</U.Button>
                  {can("communications.send") && ["scheduled", "blocked", "retry_wait"].includes(message.status) && <U.Button secondary onClick={() => setAction({ row: message, action: "cancel" })}>{t("ops.cancel")}</U.Button>}
                  {can("communications.send") && (["blocked", "retry_wait"].includes(message.status) || (message.status === "failed" && !message.provider_id)) && <U.Button secondary onClick={() => setAction({ row: message, action: "retry" })}>{t("ops.retry")}</U.Button>}
                  {can("communications.manage") && message.status === "uncertain" && <U.Button secondary onClick={() => setAction({ row: message, action: "resolve" })}>{t("ops.resolve")}</U.Button>}
                </U.Stack>,
              ])}
            />
            <Pager page={page} last={q.data?.last_page} setPage={setPage} />
          </>
        ) : (
          <>
            <State {...templates} />
            {can("communications.manage") && <U.Button onClick={() => setTemplate(null)}>{t("ops.addTemplate")}</U.Button>}
            <U.Table
              headers={[t("ops.name"), t("ops.channel"), t("ops.purpose"), t("ops.status"), t("ops.actions")]}
              rows={(templates.data?.data ?? []).filter((row) => row.channel === "email").map((row) => [
                row.name,
                t("ops.email"),
                t("ops." + row.purpose),
                t(row.active ? "ops.active" : "ops.disabled"),
                can("communications.manage") && <U.Button secondary onClick={() => setTemplate(row)}>{t("ops.edit")}</U.Button>,
              ])}
            />
          </>
        )}
        {composing && can("communications.send") && <MessageWizard ids={bulkIds.length ? bulkIds : initialRecipientIds.length ? initialRecipientIds : customer ? [Number(customer)] : []} recipientCount={bulkIds.length ? bulkIds.length : initialRecipientIds.length ? initialRecipientCount || initialRecipientIds.length : customer ? 1 : 0} templates={(templates.data?.data ?? []).filter((row) => row.channel === "email")} onClose={() => setComposing(false)} onSaved={q.reload} />}
        {template !== undefined && <TemplateEditor row={template} onClose={() => setTemplate(undefined)} onSaved={templates.reload} />}
        {detail && <MessageDetails id={detail.id} onClose={() => setDetail(undefined)} />}
        {action && <Edit title={t("ops." + action.action)} values={{}} fields={[{ key: "reason", label: t("ops.reason"), type: "textarea", required: true }]} onClose={() => setAction(undefined)} submit={async (values) => {
          await request("/communications/messages/" + action.row.id + "/" + action.action, json("POST", { reason: values.reason, version: action.row.version }));
          await q.reload();
        }}>{action.action === "resolve" && <p>{t("ops.resolveHelp")}</p>}</Edit>}
      </U.Stack>
    </U.Panel>
  );
}

function TemplateEditor({ row, onClose, onSaved }: { row: Template | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t, request } = useOps();
  return (
    <Edit
      title={t("ops.template")}
      values={initial(row ?? { purpose: "service", active: true })}
      fields={[
        { key: "name", label: t("ops.name"), required: true },
        { key: "purpose", label: t("ops.purpose"), type: "select", disabled: !!row, options: options(["service", "marketing"], t) },
        { key: "subject", label: t("ops.subject"), required: true },
        { key: "body", label: t("ops.message"), type: "textarea", required: true },
        { key: "active", label: t("ops.status"), type: "select", options: [{ value: "true", label: t("ops.active") }, { value: "false", label: t("ops.disabled") }] },
      ]}
      onClose={onClose}
      submit={async (values) => {
        await request("/communications/templates" + (row ? "/" + row.id : ""), json(row ? "PATCH" : "POST", {
          name: values.name,
          channel: "email",
          purpose: row?.purpose ?? values.purpose,
          subject: values.subject,
          body: values.body,
          active: values.active === "true",
          ...(row ? { version: row.version } : {}),
        }));
        await onSaved();
      }}
    >
      <p>{"Use {{first_name}}, {{last_name}}, {{shop_name}}, {{due_date}}, or {{reference}} to personalize email templates."}</p>
    </Edit>
  );
}

function MessageDetails({ id, onClose }: { id: number; onClose: () => void }) {
  const { ui: U, t } = useOps();
  const q = useLoad<{ data: Message }>("/communications/messages/" + id, 15000);
  const message = q.data?.data;
  return (
    <U.Dialog title={t("ops.message")} onClose={onClose}>
      <State {...q} />
      {message && <U.Stack>
        <p>{message.recipient} · {t("ops.email")} · {t("ops." + (message.status === "scheduled" && new Date(message.scheduled_at).getTime() <= Date.now() ? "queued" : message.status))}</p>
        <strong>{message.subject}</strong>
        <p style={{ whiteSpace: "pre-wrap" }}>{message.body}</p>
        {message.error_message && <U.Alert error>{message.error_message} ({message.error_code})</U.Alert>}
        <U.Table headers={[t("ops.date"), t("ops.status"), t("ops.details")]} rows={(message.events ?? []).map((event) => [new Date(event.created_at).toLocaleString(), t("ops." + event.status), [event.code, event.reason, event.actor_id ? "#" + event.actor_id : ""].filter(Boolean).join(" · ")])} />
      </U.Stack>}
    </U.Dialog>
  );
}
