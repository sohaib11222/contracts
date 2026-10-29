import { useEffect, useState } from "react";
import {
  CustomerChoice,
  useOps,
  useLoad,
  json,
  errorText,
  options,
} from "./shared";
import type { Template } from "./types";
type Recipient = {
  customer_id: number;
  name: string;
  recipient: string | null;
  eligible: boolean;
  reason: string | null;
};
export default function MessageWizard({
  ids: initialIds,
  channel: initialChannel,
  templates,
  onClose,
  onSaved,
}: {
  ids: number[];
  channel: string;
  templates: Template[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { ui: U, t, request, params } = useOps();
  const [step, setStep] = useState(0),
    [channel, setChannel] = useState(
      initialChannel === "sms" ? "sms" : "email",
    );
  const [timing, setTiming] = useState("now"),
    [date, setDate] = useState(""),
    [delay, setDelay] = useState("0");
  const [ids, setIds] = useState([...new Set(initialIds)]),
    [pick, setPick] = useState("");
  const [names, setNames] = useState<Record<number, string>>({});
  const [purpose, setPurpose] = useState("service"),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID()),
    [review, setReview] = useState<Recipient[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const readiness = useLoad<{
    data: { email: boolean; sms: boolean; email_issues?: string[] };
  }>("/communications/readiness", 15000);
  useEffect(() => {
    let active = true;
    for (const id of ids) {
      void request<{ data: { first_name: string; last_name: string } }>(
        "/customers/" + id,
      )
        .then((r) => {
          if (active)
            setNames((n) => ({
              ...n,
              [id]: r.data.first_name + " " + r.data.last_name,
            }));
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [ids, request]);
  const titles = [
    "wizard.channel",
    "wizard.when",
    "wizard.recipients",
    "wizard.compose",
    "wizard.review",
  ];
  function edit(fn: () => void) {
    fn();
    setReview([]);
    setKey(crypto.randomUUID());
    setError("");
  }
  function payload() {
    return {
      customer_ids: ids,
      channel,
      purpose,
      subject: channel === "email" ? subject : null,
      body,
      creation_key: key,
      scheduled_at: timing === "date" ? new Date(date).toISOString() : null,
      delay_minutes: timing === "delay" ? Number(delay) : 0,
    };
  }
  const valid =
    step === 0 ||
    (step === 1 &&
      (timing === "now" ||
        (timing === "date" && new Date(date).getTime() > Date.now()) ||
        (timing === "delay" &&
          Number.isInteger(Number(delay)) &&
          Number(delay) > 0 &&
          Number(delay) <= 525600))) ||
    (step === 2 && ids.length > 0 && ids.length <= 100) ||
    (step === 3 &&
      body.trim().length > 0 &&
      body.length <= 4000 &&
      (channel !== "email" ||
        (subject.trim().length > 0 && subject.length <= 200)));
  async function next() {
    setError("");
    if (step !== 3) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      const r = await request<{ data: { rows: Recipient[] } }>(
        "/communications/bulk/preview",
        json("POST", payload()),
      );
      setReview(r.data.rows);
      setStep(4);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    setBusy(true);
    setError("");
    try {
      const p = payload();
      if (ids.length === 1) {
        const { customer_ids, ...d } = p;
        await request(
          "/communications/messages",
          json("POST", {
            ...d,
            customer_id: customer_ids[0],
            reminder_id: params.get("reminder")
              ? Number(params.get("reminder"))
              : null,
          }),
        );
      } else {
        await request("/communications/bulk", json("POST", p));
      }
      setDone(true);
      await onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <U.Dialog
      title={t("ops.compose")}
      onClose={() => {
        if (!busy || done) onClose();
      }}
    >
      <U.Stack>
        {done ? (
          <>
            <U.Alert>
              {t(timing === "now" ? "wizard.queued" : "wizard.scheduled")}
            </U.Alert>
            <U.Button onClick={onClose}>{t("ops.close")}</U.Button>
          </>
        ) : (
          <>
            <nav aria-label={t("wizard.steps")}>
              <U.Stack inline>
                {titles.map((title, i) => (
                  <U.Button
                    key={title}
                    secondary={i !== step}
                    disabled={busy || i > step}
                    onClick={() => setStep(i)}
                  >
                    {i + 1}. {t(title)}
                  </U.Button>
                ))}
              </U.Stack>
            </nav>
            <h2>{t(titles[step])}</h2>
            {error && <U.Alert error>{error}</U.Alert>}
            {step === 0 && (
              <>
                <U.Field
                  disabled={busy}
                  label={t("ops.channel")}
                  type="select"
                  options={options(["email", "sms"], t)}
                  value={channel}
                  onChange={(v) =>
                    edit(() => {
                      setChannel(v);
                      setSubject("");
                      setBody("");
                    })
                  }
                />
                {readiness.data &&
                  !readiness.data.data[channel as "email" | "sms"] && (
                    <U.Alert error>
                      {t("wizard.notReady")}
                      {channel === "email" &&
                        readiness.data.data.email_issues?.map((issue) => (
                          <p key={issue}>{issue}</p>
                        ))}
                    </U.Alert>
                  )}
              </>
            )}
            {step === 1 && (
              <>
                <U.Field
                  disabled={busy}
                  label={t("wizard.when")}
                  type="select"
                  value={timing}
                  onChange={(v) => edit(() => setTiming(v))}
                  options={["now", "date", "delay"].map((value) => ({
                    value,
                    label: t("wizard." + value),
                  }))}
                />
                {timing === "date" && (
                  <U.Field
                    disabled={busy}
                    label={t("ops.sendAt")}
                    type="datetime-local"
                    required
                    value={date}
                    onChange={(v) => edit(() => setDate(v))}
                  />
                )}
                {timing === "delay" && (
                  <U.Field
                    disabled={busy}
                    label={t("ops.delayMinutes")}
                    type="number"
                    min={1}
                    max={525600}
                    value={delay}
                    onChange={(v) => edit(() => setDelay(v))}
                  />
                )}
                <p>{t("wizard.timingHelp")}</p>
              </>
            )}
            {step === 2 && (
              <>
                <CustomerChoice value={pick} onChange={setPick} />
                <U.Button
                  secondary
                  disabled={
                    busy ||
                    !pick ||
                    ids.includes(Number(pick)) ||
                    ids.length >= 100
                  }
                  onClick={() =>
                    edit(() => {
                      setIds([...ids, Number(pick)]);
                      setPick("");
                    })
                  }
                >
                  {t("wizard.addRecipient")}
                </U.Button>
                <p>
                  {t("ops.selectedCustomers")}: {ids.length}/100
                </p>
                <U.Table
                  headers={[t("ops.customer"), t("ops.actions")]}
                  rows={ids.map((id) => [
                    names[id] ?? "#" + id,
                    <U.Button
                      secondary
                      disabled={busy}
                      onClick={() =>
                        edit(() => setIds(ids.filter((v) => v !== id)))
                      }
                    >
                      {t("ops.removeRecipient")}
                    </U.Button>,
                  ])}
                />
              </>
            )}
            {step === 3 && (
              <>
                <U.Field
                  disabled={busy}
                  label={t("wizard.useTemplate")}
                  type="select"
                  value=""
                  options={[
                    { value: "", label: t("wizard.writeOwn") },
                    ...templates
                      .filter((v) => v.active && v.channel === channel)
                      .map((v) => ({ value: String(v.id), label: v.name })),
                  ]}
                  onChange={(v) => {
                    const row = templates.find((x) => x.id === Number(v));
                    if (row)
                      edit(() => {
                        setSubject(row.subject ?? "");
                        setBody(row.body);
                        setPurpose(row.purpose);
                      });
                  }}
                />
                <U.Field
                  disabled={busy}
                  label={t("ops.purpose")}
                  type="select"
                  options={options(["service", "marketing"], t)}
                  value={purpose}
                  onChange={(v) => edit(() => setPurpose(v))}
                />
                {channel === "email" && (
                  <U.Field
                    disabled={busy}
                    label={t("ops.subject")}
                    required
                    value={subject}
                    onChange={(v) => edit(() => setSubject(v))}
                  />
                )}
                <U.Field
                  disabled={busy}
                  label={t("ops.message")}
                  type="textarea"
                  required
                  value={body}
                  onChange={(v) => edit(() => setBody(v))}
                />
                <p>{t("ops.bulkVariables")}</p>
              </>
            )}
            {step === 4 && (
              <>
                <p>
                  {t("ops." + channel)} · {t("ops." + purpose)} ·{" "}
                  {t("wizard." + timing)}{" "}
                  {timing === "date"
                    ? new Date(date).toLocaleString()
                    : timing === "delay"
                      ? delay + " " + t("ops.delayMinutes")
                      : ""}
                </p>
                {channel === "email" && <strong>{subject}</strong>}
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {body}
                </p>
                <U.Table
                  headers={[
                    t("ops.customer"),
                    t("ops.recipient"),
                    t("ops.status"),
                  ]}
                  rows={review.map((r) => [
                    r.name,
                    r.recipient ?? "—",
                    t(r.eligible ? "ops.eligible" : "ops.bulk." + r.reason),
                  ])}
                />
                <U.Button
                  disabled={
                    busy ||
                    review.length !== ids.length ||
                    review.some((r) => !r.eligible)
                  }
                  onClick={() => void send()}
                >
                  {t(
                    busy
                      ? "ops.loading"
                      : timing === "now"
                        ? "wizard.send"
                        : "wizard.schedule",
                  )}
                </U.Button>
              </>
            )}
            <U.Stack inline>
              {step > 0 && (
                <U.Button
                  secondary
                  disabled={busy}
                  onClick={() => setStep(step - 1)}
                >
                  {t("wizard.back")}
                </U.Button>
              )}
              {step < 4 && (
                <U.Button disabled={busy || !valid} onClick={() => void next()}>
                  {t(busy ? "ops.loading" : "wizard.next")}
                </U.Button>
              )}
            </U.Stack>
          </>
        )}
      </U.Stack>
    </U.Dialog>
  );
}
