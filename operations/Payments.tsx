import Output from "./Output";
import { useState } from "react";
import {
  useOps,
  useLoad,
  State,
  Pager,
  Edit,
  CustomerChoice,
  Choice,
  options,
  initial,
  json,
  today,
} from "./shared";
import type { Balance, Page, Payment } from "./types";
function money(row: Balance, amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: row.currency,
  }).format(amount / 10 ** row.price_decimals);
}

export default function Payments({ customerId }: { customerId?: number }) {
  const { ui: U, t, can, params } = useOps();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<number | undefined>(() =>
    params.get("id") ? Number(params.get("id")) : undefined,
  );
  const [create, setCreate] = useState(false);
  const cid = customerId ? String(customerId) : params.get("customer") ?? "";
  const q = useLoad<Page<Balance>>(
    "/receivables?" +
      new URLSearchParams({
        page: String(page),
        search,
        customer_id: cid,
        order_id: params.get("order") ?? "",
      }),
  );
  return (
    <U.Panel
      title={t("ops.payments")}
      actions={
        can("payments.write") && (
          <U.Button onClick={() => setCreate(true)}>
            {t("ops.addBalance")}
          </U.Button>
        )
      }
    >
      <U.Stack>
        <Output module="payments" customerId={customerId} />
        <U.Alert>{t("ops.paymentHelp")}</U.Alert>
        <U.Field
          key="search"
          label={t("ops.search")}
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
        <State {...q} />
        <U.Table
          headers={[
            t("ops.reference"),
            t("ops.customer"),
            t("ops.deadline"),
            t("ops.total"),
            t("ops.paid"),
            t("ops.balance"),
            t("ops.status"),
            t("ops.actions"),
          ]}
          rows={(q.data?.data ?? []).map((r) => [
            r.reference,
            [r.customer?.first_name, r.customer?.last_name].join(" "),
            r.due_on,
            money(r, r.amount_minor),
            money(r, r.paid_minor),
            money(r, r.balance_minor),
            <>
              {t("ops." + r.effective_status)}
              {r.refund_due_minor > 0 && (
                <p>
                  {t("ops.refund_due")}: {money(r, r.refund_due_minor)}
                </p>
              )}
            </>,
            <U.Button secondary onClick={() => setDetail(r.id)}>
              {t("ops.details")}
            </U.Button>,
          ])}
        />
        <Pager page={page} last={q.data?.last_page} setPage={setPage} />
        {create && (
          <BalanceEditor
            customer={cid}
            order={params.get("order") ?? ""}
            onClose={() => setCreate(false)}
            onSaved={q.reload}
          />
        )}
        {detail && (
          <BalanceDetails
            id={detail}
            onClose={() => setDetail(undefined)}
            onSaved={q.reload}
          />
        )}
      </U.Stack>
    </U.Panel>
  );
}

function BalanceEditor({
  row,
  customer,
  order = "",
  onClose,
  onSaved,
}: {
  row?: Balance;
  customer: string;
  order?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t, request, timezone, can } = useOps();
  const [cid, setCid] = useState(customer);
  const [orderId, setOrderId] = useState(order);
  const [key] = useState(() => crypto.randomUUID());
  const [orderPage, setOrderPage] = useState(1);
  const orders = useLoad<Page<{ id: number; number: string; status: string }>>(
    cid && !row && can("orders.read")
      ? "/orders?customer_id=" + cid + "&page=" + orderPage
      : null,
  );
  return (
    <Edit
      title={t(row ? "ops.editBalance" : "ops.addBalance")}
      values={initial(row ?? { due_on: today(timezone) })}
      fields={[
        { key: "reference", label: t("ops.invoiceReference"), required: true },
        ...(!row && !orderId
          ? [
              {
                key: "amount",
                label: t("ops.amount"),
                required: true,
                type: "text",
              },
            ]
          : []),
        {
          key: "due_on",
          label: t("ops.deadline"),
          type: "date",
          required: true,
        },
        { key: "notes", label: t("ops.notes"), type: "textarea" },
      ]}
      onClose={onClose}
      submit={async (v) => {
        await request(
          "/receivables" + (row ? "/" + row.id : ""),
          json(row ? "PATCH" : "POST", {
            reference: v.reference,
            due_on: v.due_on,
            notes: v.notes,
            ...(row
              ? { version: row.version }
              : {
                  customer_id: Number(cid),
                  order_id: orderId ? Number(orderId) : null,
                  amount: orderId ? undefined : v.amount,
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
              setOrderId("");
            }}
          />
          <Choice
            label={t("ops.order")}
            value={orderId}
            onChange={setOrderId}
            choices={[
              { value: "", label: t("ops.manualInvoice") },
              ...(orders.data?.data ?? [])
                .filter((x) => ["confirmed", "fulfilled"].includes(x.status))
                .map((x) => ({ value: String(x.id), label: x.number })),
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
      <p>{t("ops.balanceHelp")}</p>
    </Edit>
  );
}

function BalanceDetails({
  id,
  onClose,
  onSaved,
}: {
  id: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { ui: U, t, can, request, timezone } = useOps();
  const q = useLoad<{ data: Balance }>("/receivables/" + id);
  const row = q.data?.data;
  const [edit, setEdit] = useState(false);
  const [posting, setPosting] = useState<Payment | null | undefined>();
  const [voiding, setVoiding] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const refresh = async () => {
    await q.reload();
    await onSaved();
  };
  return (
    <U.Dialog title={t("ops.balance")} onClose={onClose}>
      <State {...q} />
      {row && (
        <U.Stack>
          <div className="ops-print-sheet">
            <h2>{row.reference}</h2>
            <p>
              {row.customer?.first_name} {row.customer?.last_name} ·{" "}
              {row.due_on} · {t("ops." + row.effective_status)}
            </p>
            <p>
              {t("ops.total")}: {money(row, row.amount_minor)} · {t("ops.paid")}
              : {money(row, row.paid_minor)} · {t("ops.balance")}:{" "}
              {money(row, row.balance_minor)}
            </p>
            {row.refund_due_minor > 0 && (
              <U.Alert>
                {t("ops.refund_due")}: {money(row, row.refund_due_minor)}
              </U.Alert>
            )}
            <p>{row.notes}</p>
            <U.Table
              headers={[
                t("ops.date"),
                t("ops.type"),
                t("ops.amount"),
                t("ops.method"),
                t("ops.reason"),
                t("ops.actor"),
                t("ops.actions"),
              ]}
              rows={row.entries.map((e) => [
                e.paid_on,
                t("ops." + e.kind),
                money(row, e.amount_minor),
                t("ops." + e.method),
                [e.reference, e.reason].filter(Boolean).join(" · "),
                e.actor?.name,
                can("payments.reverse") &&
                  e.kind === "payment" &&
                  !row.entries.some((x) => x.reverses_id === e.id) && (
                    <U.Button
                      secondary
                      onClick={() => {
                        setKey(crypto.randomUUID());
                        setPosting(e);
                      }}
                    >
                      {t("ops.reverse")}
                    </U.Button>
                  ),
              ])}
            />
          </div>
          <Output module="payments" recordId={row.id} />
          {row.order_id && (
            <U.Link to={"/orders/" + row.order_id}>
              {t("ops.order")}: {row.order?.number}
            </U.Link>
          )}
          <U.Stack inline>
            {can("payments.write") && row.balance_minor > 0 && (
              <U.Button
                onClick={() => {
                  setKey(crypto.randomUUID());
                  setPosting(null);
                }}
              >
                {t("ops.recordPayment")}
              </U.Button>
            )}
            {can("payments.write") &&
              !["void", "refund_due"].includes(row.effective_status) && (
                <U.Button secondary onClick={() => setEdit(true)}>
                  {t("ops.edit")}
                </U.Button>
              )}
            {can("payments.reverse") && (
              <U.Button secondary onClick={() => setVoiding(true)}>
                {t("ops.void")}
              </U.Button>
            )}
          </U.Stack>
          {edit && (
            <BalanceEditor
              row={row}
              customer={String(row.customer_id)}
              onClose={() => setEdit(false)}
              onSaved={refresh}
            />
          )}
          {posting !== undefined && (
            <Edit
              title={t(posting ? "ops.reverse" : "ops.recordPayment")}
              values={{ method: "cash", paid_on: today(timezone) }}
              fields={[
                ...(!posting
                  ? [
                      { key: "amount", label: t("ops.amount"), required: true },
                      {
                        key: "method",
                        label: t("ops.method"),
                        type: "select",
                        options: options(
                          ["cash", "card", "bank_transfer", "other"],
                          t,
                        ),
                      },
                    ]
                  : [
                      {
                        key: "reason",
                        label: t("ops.reason"),
                        type: "textarea",
                        required: true,
                      },
                    ]),
                {
                  key: "paid_on",
                  label: t("ops.date"),
                  type: "date",
                  required: true,
                },
                { key: "reference", label: t("ops.reference") },
              ]}
              onClose={() => setPosting(undefined)}
              submit={async (v) => {
                await request(
                  "/receivables/" + id + "/payments",
                  json("POST", {
                    version: row.version,
                    creation_key: key,
                    paid_on: v.paid_on,
                    reference: v.reference,
                    ...(posting
                      ? { reverses_id: posting.id, reason: v.reason }
                      : { amount: v.amount, method: v.method }),
                  }),
                );
                await refresh();
              }}
            >
              <p>{t("ops.reversalHelp")}</p>
            </Edit>
          )}
          {voiding && (
            <Edit
              title={t("ops.void")}
              values={{}}
              fields={[
                {
                  key: "reason",
                  label: t("ops.reason"),
                  type: "textarea",
                  required: true,
                },
              ]}
              onClose={() => setVoiding(false)}
              submit={async (v) => {
                await request(
                  "/receivables/" + id + "/void",
                  json("POST", { version: row.version, reason: v.reason }),
                );
                await refresh();
              }}
            />
          )}
        </U.Stack>
      )}
    </U.Dialog>
  );
}
