import Output from "./Output";
import { useState } from "react";
import type { Employee, Page } from "./types";
import {
  useOps,
  useLoad,
  State,
  Pager,
  Edit,
  initial,
  json,
  Choice,
  options,
} from "./shared";
export default function Employees() {
  const { ui: U, t, can, request, actorId, invitationUrl } = useOps();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Employee | null | undefined>();
  const [role, setRole] = useState("salesperson");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [invite, setInvite] = useState("");
  const [renewing, setRenewing] = useState<Employee>();
  const rows = useLoad<Page<Employee>>(
    `/employees?page=${page}&search=${encodeURIComponent(search)}`,
  );
  const catalog = useLoad<{
    roles: { name: string; permissions: string[] }[];
    permissions: string[];
  }>("/employees/catalog");
  const open = (employee: Employee | null) => {
    setEditing(employee);
    setRole(employee?.role ?? "salesperson");
    setOverrides(employee?.permission_overrides ?? {});
  };
  const defaults =
    catalog.data?.roles.find((r) => r.name === role)?.permissions ?? [];
  return (
    <U.Panel
      title={t("ops.employees")}
      actions={
        can("employees.manage") && (
          <U.Button onClick={() => open(null)}>
            {t("ops.inviteEmployee")}
          </U.Button>
        )
      }
    >
      <U.Stack>
        <U.Alert>{t("ops.employeeHelp")}</U.Alert>
        <U.Field
          key="search"
          label={t("ops.search")}
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
        <State {...rows} />
        <State {...catalog} />
        {invite && (
          <U.Panel title={t("ops.invitation")}>
            <p>{t("ops.invitationHelp")}</p>
            <U.Field
              key="invitation-link"
              label={t("ops.invitation")}
              value={invite}
              onChange={() => undefined}
            />
            <U.Button secondary onClick={() => setInvite("")}>
              {t("ops.close")}
            </U.Button>
          </U.Panel>
        )}
        <U.Table
          headers={[
            t("ops.name"),
            t("ops.email"),
            t("ops.role"),
            t("ops.status"),
            t("ops.actions"),
          ]}
          rows={(rows.data?.data ?? []).map((e) => [
            e.name,
            e.email,
            t("ops." + e.role),
            t("ops." + e.status),
            can("employees.manage") &&
              e.role !== "owner" &&
              e.user_id !== actorId && (
                <U.Stack inline>
                  <U.Button secondary onClick={() => open(e)}>
                    {t("ops.edit")}
                  </U.Button>
                  {e.status === "invited" && (
                    <U.Button secondary onClick={() => setRenewing(e)}>
                      {t("ops.renewInvitation")}
                    </U.Button>
                  )}
                </U.Stack>
              ),
          ])}
        />
        <Pager page={page} last={rows.data?.last_page} setPage={setPage} />
        {editing !== undefined && (
          <Edit
            title={t(editing ? "ops.editEmployee" : "ops.inviteEmployee")}
            values={initial(editing ?? { status: "active" })}
            fields={[
              { key: "name", label: t("ops.name"), required: true, max: 150 },
              ...(!editing
                ? [
                    {
                      key: "email",
                      label: t("ops.email"),
                      type: "email",
                      required: true,
                    },
                  ]
                : []),
              {
                key: "status",
                label: t("ops.status"),
                type: "select",
                options: options(["active", "suspended"], t),
              },
            ]}
            onClose={() => setEditing(undefined)}
            submit={async (v) => {
              const result = await request<{ invitation_token?: string }>(
                "/employees" + (editing ? "/" + editing.id : ""),
                json(editing ? "PATCH" : "POST", {
                  name: v.name,
                  ...(!editing
                    ? { email: v.email }
                    : { version: editing.version }),
                  role,
                  permission_overrides: overrides,
                  status: v.status === "suspended" ? "suspended" : "active",
                }),
              );
              if (result.invitation_token)
                setInvite(invitationUrl(result.invitation_token));
              await rows.reload();
            }}
          >
            <Choice
              label={t("ops.role")}
              value={role}
              onChange={(v) => {
                setRole(v);
                setOverrides({});
              }}
              choices={(catalog.data?.roles ?? []).map((r) => ({
                value: r.name,
                label: t("ops." + r.name),
              }))}
            />
            <p>{t("ops.permissionHelp")}</p>
            {(catalog.data?.permissions ?? []).map((p) => (
              <Choice
                key={p}
                label={p}
                value={p in overrides ? String(overrides[p]) : "default"}
                onChange={(v) =>
                  setOverrides((old) => {
                    const next = { ...old };
                    if (v === "default") delete next[p];
                    else next[p] = v === "true";
                    return next;
                  })
                }
                choices={[
                  {
                    value: "default",
                    label:
                      t("ops.roleDefault") +
                      ": " +
                      t(defaults.includes(p) ? "ops.allowed" : "ops.denied"),
                  },
                  { value: "true", label: t("ops.allowed") },
                  { value: "false", label: t("ops.denied") },
                ]}
              />
            ))}
          </Edit>
        )}
        {renewing && (
          <Edit
            title={t("ops.renewInvitation")}
            fields={[]}
            values={{}}
            onClose={() => setRenewing(undefined)}
            submit={async () => {
              const r = await request<{ invitation_token: string }>(
                "/employees/" + renewing.id + "/invite",
                json("POST", {}),
              );
              setInvite(invitationUrl(r.invitation_token));
              await rows.reload();
            }}
          >
            <p>
              {renewing.name} · {renewing.email}
            </p>
            <p>{t("ops.renewHelp")}</p>
          </Edit>
        )}
      </U.Stack>
    </U.Panel>
  );
}
export function ActivityLog() {
  const { ui: U, t } = useOps();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = new URLSearchParams({
    page: String(page),
    action,
    actor_id: actor,
    from,
    to,
  });
  const q = useLoad<
    Page<{
      id: number;
      action: string;
      actor?: { name: string };
      actor_id?: number;
      subject_type?: string;
      subject_id?: number;
      created_at: string;
    }>
  >("/activity?" + query);
  return (
    <U.Panel title={t("ops.audit")}>
      <U.Stack>
        <Output module="audit" />
        <U.Stack inline>
          {[
            ["action", action, setAction],
            ["actorId", actor, setActor],
            ["from", from, setFrom],
            ["to", to, setTo],
          ].map(([key, value, update]) => (
            <U.Field
              key={key as string}
              label={t("ops." + key)}
              value={value as string}
              type={["from", "to"].includes(key as string) ? "date" : "text"}
              onChange={(v) => {
                (update as (v: string) => void)(v);
                setPage(1);
              }}
            />
          ))}
        </U.Stack>
        <State {...q} />
        <U.Table
          headers={[
            t("ops.date"),
            t("ops.actor"),
            t("ops.action"),
            t("ops.record"),
          ]}
          rows={(q.data?.data ?? []).map((r) => [
            new Date(r.created_at).toLocaleString(),
            r.actor?.name ?? String(r.actor_id ?? ""),
            r.action,
            [r.subject_type, r.subject_id].join(" #"),
          ])}
        />
        <Pager page={page} last={q.data?.last_page} setPage={setPage} />
      </U.Stack>
    </U.Panel>
  );
}
