"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { Button } from "@/components/ui/button";
import { clients, companies } from "@/data/core";
import {
  MANAGER_ROLES, ROLE_LABEL, audit, managedUsers, queueEmail, stamp, type ManagedUser, type ManagerRole, type UserScope,
} from "@/data/admin";
import { TODAY, addDays, fmtDate } from "@/lib/dates";
import type { ScreenProps } from "../types";
import { OutboxPanel } from "./outbox-panel";
import { AuditTrail, CONFLICT, Notice, stillCurrent, useActor, useBanner } from "./shared";

const LATIN = /^[A-Za-z][A-Za-z'’\- ]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const words = (s: string) => s.trim().split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z]/g, "")).filter(Boolean);

/** Latin name words joined by dots plus a unique number, e.g. ahmed.ali-0042. Never changes after creation. */
export function makeUsername(first: string, last: string, existing: ManagedUser[]) {
  const max = Math.max(100, ...existing.map((u) => Number(u.username.split("-").pop()) || 0));
  return `${[...words(first), ...words(last)].join(".")}-${String(max + 1).padStart(4, "0")}`;
}

const tempPassword = () => Array.from({ length: 10 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 56)]).join("");

const emptyScope = (): UserScope => ({ employingCompanyIds: ["cmp-ithc"], contractCompanyIds: ["cmp-ithc"], clientIds: [] });

function Checks({ options, value, onChange }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={value.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export default function ManagerUsersScreen({ readOnly, editedBy }: ScreenProps) {
  const users = managedUsers.useAll();
  const cos = companies.useAll().filter((c) => c.kind === "operating");
  const cls = clients.useAll();
  const actor = useActor();
  const banner = useBanner();
  const [status, setStatus] = useState("");
  const [roleF, setRoleF] = useState("");
  const [creating, setCreating] = useState(false);
  const [sel, setSel] = useState<ManagedUser | null>(null);
  const [mode, setMode] = useState<"view" | "role" | "offboard">("view");

  // create form
  const [f, setF] = useState({ first: "", last: "", email: "", role: "" as ManagerRole | "", scope: emptyScope() });
  const [errs, setErrs] = useState<string[]>([]);
  // change role / offboard
  const [newRole, setNewRole] = useState<ManagerRole | "">("");
  const [reason, setReason] = useState("");
  const [lastDay, setLastDay] = useState(TODAY);
  const [opened, setOpened] = useState(0);
  const [formErr, setFormErr] = useState("");

  const preview = f.first.trim() && f.last.trim() && words(f.first + " " + f.last).length ? makeUsername(f.first, f.last, users) : "";
  const rows = useMemo(() => users.filter((u) => (!status || u.status === status) && (!roleF || u.role === roleF)), [users, status, roleF]);
  const active = users.filter((u) => u.status === "active");
  const pendingPw = active.filter((u) => u.mustChangePassword);

  const tempState = (u: ManagedUser) =>
    !u.mustChangePassword ? null : u.tempPasswordExpires && u.tempPasswordExpires < TODAY ? "expired" : "pending";

  const openCreate = () => { setF({ first: "", last: "", email: "", role: "", scope: emptyScope() }); setErrs([]); setCreating(true); };

  const create = async () => {
    const e: string[] = [];
    if (!f.first.trim() || !LATIN.test(f.first.trim())) e.push("First name must be written in Latin letters.");
    if (!f.last.trim() || !LATIN.test(f.last.trim())) e.push("Last name must be written in Latin letters (write Arabic names in Latin letters).");
    if (!EMAIL.test(f.email.trim())) e.push("A valid email address is required: the temporary password is sent there.");
    else if (users.some((u) => u.status === "active" && u.email.toLowerCase() === f.email.trim().toLowerCase())) e.push("An active account already uses this email address.");
    if (!f.role || !(MANAGER_ROLES as readonly string[]).includes(f.role)) e.push("Choose one of the seven manager roles.");
    if (f.scope.employingCompanyIds.length === 0 || f.scope.contractCompanyIds.length === 0) e.push("Company access needs at least one employing company and one contract-owning company.");
    if (e.length) return setErrs(e);
    const name = `${f.first.trim()} ${f.last.trim()}`;
    const username = makeUsername(f.first, f.last, users);
    const id = `usr-${username.split("-").pop()}`;
    const user: ManagedUser = {
      id, name, username, email: f.email.trim(), role: f.role as ManagerRole, scope: f.scope, status: "active", loginActive: true,
      mustChangePassword: true, tempPasswordExpires: addDays(TODAY, 3), createdAt: stamp(), version: 1,
    };
    await managedUsers.save(user);
    await queueEmail({
      to: user.email, kind: "credentials", recipientRole: user.role, subject: "Your ITHC Fleet Platform account",
      body: `Hello ${f.first.trim()},\nYour account has been created.\nUsername: ${username}\nTemporary password: ${tempPassword()}\nYou must change it at first login. It expires on ${addDays(TODAY, 3)} and works once.`,
    });
    await audit({ actor, entity: "user", entityId: id, action: "Account created", detail: `${username} as ${ROLE_LABEL[user.role]}; temporary password emailed` });
    setCreating(false);
    banner.ok(`Account ${username} created as ${ROLE_LABEL[user.role]}. The temporary password email is in the Email outbox tab.`);
  };

  const openRow = (u: ManagedUser, m: "view" | "role" | "offboard" = "view") => {
    setSel(u); setMode(m); setNewRole(""); setReason(""); setLastDay(TODAY); setFormErr(""); setOpened(u.version);
  };

  const changeRole = async () => {
    if (!sel) return;
    if (!newRole) return setFormErr("Choose the new role.");
    if (!reason.trim()) return setFormErr("A reason is required.");
    if (!stillCurrent(managedUsers.getSync(sel.id), opened)) return setFormErr(CONFLICT);
    await managedUsers.save({ ...sel, role: newRole, version: sel.version + 1 });
    await audit({ actor, entity: "user", entityId: sel.id, action: "Role changed", detail: `${ROLE_LABEL[sel.role]} -> ${ROLE_LABEL[newRole]}`, reason });
    banner.ok(`${sel.name} is now ${ROLE_LABEL[newRole]}.`);
    setSel(null);
  };

  const offboard = async () => {
    if (!sel) return;
    if (!reason.trim()) return setFormErr("A reason is required.");
    if (!stillCurrent(managedUsers.getSync(sel.id), opened)) return setFormErr(CONFLICT);
    await managedUsers.save({ ...sel, status: "offboarded", loginActive: false, mustChangePassword: false, offboardedAt: `${lastDay} ${stamp().slice(11)}`, offboardReason: reason, version: sel.version + 1 });
    await audit({ actor, entity: "user", entityId: sel.id, action: "Offboarded", detail: `Login deactivated automatically (last day ${fmtDate(lastDay)})`, reason });
    banner.ok(`${sel.name} offboarded. The login is deactivated; the account stays on record and cannot be deleted.`);
    setSel(null);
  };

  const cols: Column<ManagedUser>[] = [
    { key: "name", header: "Name" },
    { key: "username", header: "Username", className: "font-mono text-xs" },
    { key: "role", header: "Role", value: (u) => ROLE_LABEL[u.role] },
    { key: "email", header: "Email" },
    { key: "login", header: "Login", value: (u) => (u.loginActive ? "active" : "deactivated"), cell: (u) => <StatusBadge tone={u.loginActive ? "good" : "bad"}>{u.loginActive ? "Active" : "Deactivated"}</StatusBadge> },
    { key: "pw", header: "Password", value: (u) => tempState(u) ?? "changed", cell: (u) => {
      const t = tempState(u);
      return t === "expired" ? <StatusBadge tone="bad">Temp expired</StatusBadge> : t ? <StatusBadge tone="warn">Must change at first login</StatusBadge> : u.status === "active" ? <StatusBadge tone="good">Changed</StatusBadge> : <span>—</span>;
    } },
    { key: "act", header: "", sortable: false, cell: (u) => u.status === "active" && !readOnly ? (
      <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="xs" variant="outline" onClick={() => openRow(u, "role")}>Change role</Button>
        <Button size="xs" variant="destructive" onClick={() => openRow(u, "offboard")}>Offboard</Button>
      </span>
    ) : null },
  ];

  const list = (
    <div className="space-y-4">
      <KpiGrid>
        <KpiCard label="Active managers" value={active.length} />
        <KpiCard label="Must change temporary password" value={pendingPw.length} tone={pendingPw.length ? "warn" : "default"} />
        <KpiCard label="Offboarded" value={users.length - active.length} />
        <KpiCard label="Roles in use" value={new Set(active.map((u) => u.role)).size} hint="of 7 manager roles" />
      </KpiGrid>
      <DataTable
        rows={rows} columns={cols} onRowClick={(u) => openRow(u)} exportName="manager-users" searchPlaceholder="Search name, username, email"
        filters={<>
          <Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option value="active">Active</option><option value="offboarded">Offboarded</option></Select>
          <Select className="w-52" value={roleF} onChange={(e) => setRoleF(e.target.value)} aria-label="Filter by role"><option value="">All roles</option>{MANAGER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
        </>}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manager Users"
        description="Create and offboard the seven manager roles. Workers, handover desk users and site supervisors are created by their owning roles."
        actions={!readOnly && <Button onClick={openCreate}><Plus /> Add user</Button>}
      />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {banner.msg && <Notice tone={banner.msg.tone}>{banner.msg.text}</Notice>}
      <Tabs tabs={[
        { id: "users", label: "Users", content: list },
        { id: "outbox", label: "Email outbox", content: <OutboxPanel kind="credentials" /> },
        { id: "audit", label: "Audit log", content: <AuditTrail entity="user" /> },
      ]} />

      <FormSheet open={creating} onOpenChange={setCreating} title="Add manager" description="Details and role in one step. The username and temporary password are generated and emailed." onSubmit={create} submitLabel="Create and email credentials" wide>
        {errs.length > 0 && <Notice tone="bad"><ul className="list-disc ps-4">{errs.map((x) => <li key={x}>{x}</li>)}</ul></Notice>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name (Latin letters)"><Input value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></Field>
          <Field label="Last name (Latin letters)"><Input value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} /></Field>
        </div>
        <Field label="Email (receives the temporary password)"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role (one role per person)">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as ManagerRole })}>
            <option value="">Select role</option>
            {MANAGER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </Field>
        <Field label="Username (generated, fixed afterwards)"><Input readOnly disabled value={preview || "e.g. ahmed.ali-0105"} className="font-mono" /></Field>
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">Company and client access</p>
          <p className="text-xs text-muted-foreground">Access resolves separately on each of the three below. ITHC is the only operating company today.</p>
          <Field label="Employing company"><Checks options={cos.map((c) => ({ id: c.id, label: c.name }))} value={f.scope.employingCompanyIds} onChange={(v) => setF({ ...f, scope: { ...f.scope, employingCompanyIds: v } })} /></Field>
          <Field label="Contract-owning company"><Checks options={cos.map((c) => ({ id: c.id, label: c.name }))} value={f.scope.contractCompanyIds} onChange={(v) => setF({ ...f, scope: { ...f.scope, contractCompanyIds: v } })} /></Field>
          <Field label="Clients" hint="Leave all unticked for every client."><Checks options={cls.map((c) => ({ id: c.id, label: c.name }))} value={f.scope.clientIds} onChange={(v) => setF({ ...f, scope: { ...f.scope, clientIds: v } })} /></Field>
        </div>
      </FormSheet>

      <FormSheet
        open={!!sel} onOpenChange={(o) => !o && setSel(null)} wide
        title={sel ? (mode === "role" ? `Change role: ${sel.name}` : mode === "offboard" ? `Offboard ${sel.name}` : sel.name) : ""}
        description={sel?.username}
        hideSubmit={mode === "view"}
        submitLabel={mode === "role" ? "Change role" : "Offboard and deactivate login"}
        onSubmit={mode === "role" ? changeRole : offboard}
      >
        {sel && (
          <>
            {formErr && <Notice tone="bad">{formErr}</Notice>}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Role</dt><dd>{ROLE_LABEL[sel.role]}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Email</dt><dd>{sel.email}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Login</dt><dd>{sel.loginActive ? "Active" : "Deactivated"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Created</dt><dd>{sel.createdAt}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Employing company</dt><dd>{sel.scope.employingCompanyIds.join(", ")}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Contract-owning company</dt><dd>{sel.scope.contractCompanyIds.join(", ")}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted-foreground">Clients</dt><dd>{sel.scope.clientIds.length ? sel.scope.clientIds.join(", ") : "All clients"}</dd></div>
              {sel.offboardedAt && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Offboarded</dt><dd>{sel.offboardedAt}: {sel.offboardReason}</dd></div>}
            </dl>
            {mode === "view" && sel.status === "active" && !readOnly && (
              <div className="flex gap-2"><Button variant="outline" onClick={() => openRow(sel, "role")}>Change role</Button><Button variant="destructive" onClick={() => openRow(sel, "offboard")}>Offboard</Button></div>
            )}
            {mode === "role" && (
              <>
                <Field label="New role (within the roles Admin may assign)">
                  <Select value={newRole} onChange={(e) => setNewRole(e.target.value as ManagerRole)}>
                    <option value="">Select role</option>
                    {MANAGER_ROLES.filter((r) => r !== sel.role).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>
                </Field>
                <Field label="Reason (audited)"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              </>
            )}
            {mode === "offboard" && (
              <>
                <Notice tone="warn">Offboarding deactivates this person&apos;s login automatically. Accounts are never deleted.</Notice>
                <Field label="Last working day"><Input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} /></Field>
                <Field label="Reason (audited)"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              </>
            )}
            <div>
              <h3 className="mb-2 text-sm font-medium">History</h3>
              <AuditTrail entity="user" entityId={sel.id} />
            </div>
          </>
        )}
      </FormSheet>
    </div>
  );
}
