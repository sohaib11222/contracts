import { useState } from "react";
import { useOps, errorText } from "./shared";
export default function Output({
  module,
  customerId,
  recordId,
}: {
  module: string;
  customerId?: number;
  recordId?: number;
}) {
  const { ui: U, t, request, can } = useOps();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!can(module + ".print") && !can(module + ".export")) return null;
  const run = async (purpose: "print" | "export") => {
    setBusy(true);
    setError("");
    const popup =
      purpose === "print"
        ? window.open("", "_blank", "width=1000,height=800")
        : null;
    try {
      if (purpose === "print" && !popup) throw new Error(t("ops.allowPopup"));
      const result = await request<{
        filename: string;
        csv: string;
        title: string;
        headers: string[];
        rows: (string | number)[][];
        ledger?: (string | number)[][];
        ledger_headers?: string[];
      }>(
        "/record-output/" +
          module +
          "?" +
          new URLSearchParams({
            purpose,
            from,
            to,
            ...(recordId ? { record_id: String(recordId) } : {}),
            ...(customerId ? { customer_id: String(customerId) } : {}),
          }),
      );
      if (purpose === "export") {
        const url = URL.createObjectURL(
          new Blob([result.csv], { type: "text/csv;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (popup) {
        // Use textContent for every server value, including customer-entered text.
        popup.opener = null;
        const doc = popup.document;
        doc.title = t("ops." + module);
        const style = doc.createElement("style");
        style.textContent =
          "body{font:12px Arial;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:left;overflow-wrap:anywhere}h1{font-size:20px}";
        doc.head.append(style);
        const heading = doc.createElement("h1");
        heading.textContent = t("ops." + module);
        doc.body.append(heading);
        const table = doc.createElement("table");
        [result.headers, ...result.rows].forEach((row, n) => {
          const tr = doc.createElement("tr");
          row.forEach((value) => {
            const td = doc.createElement(n ? "td" : "th");
            td.textContent = String(value ?? "");
            tr.append(td);
          });
          table.append(tr);
        });
        doc.body.append(table);
        if (result.ledger?.length) {
          const ledger = doc.createElement("table");
          ledger.style.marginTop = "24px";
          [result.ledger_headers ?? [], ...result.ledger].forEach((row, n) => {
            const tr = doc.createElement("tr");
            row.forEach((v) => {
              const td = doc.createElement(n ? "td" : "th");
              td.textContent = String(v ?? "");
              tr.append(td);
            });
            ledger.append(tr);
          });
          doc.body.append(ledger);
        }
        popup.focus();
        popup.print();
      }
    } catch (e) {
      popup?.close();
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <U.Panel title={t("ops.output")}>
      <U.Stack>
        <p>{t("ops.outputHelp")}</p>
        <U.Stack inline>
          <U.Field
            label={t("ops.from")}
            type="date"
            value={from}
            onChange={setFrom}
          />
          <U.Field
            label={t("ops.to")}
            type="date"
            value={to}
            onChange={setTo}
          />
          {can(module + ".export") && (
            <U.Button
              secondary
              disabled={busy}
              onClick={() => void run("export")}
            >
              {t("ops.export")}
            </U.Button>
          )}
          {can(module + ".print") && (
            <U.Button
              secondary
              disabled={busy}
              onClick={() => void run("print")}
            >
              {t("ops.print")}
            </U.Button>
          )}
        </U.Stack>
        {error && <U.Alert error>{error}</U.Alert>}
      </U.Stack>
    </U.Panel>
  );
}
