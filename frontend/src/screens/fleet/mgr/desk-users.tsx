"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { locations as locationsCol, workers as workersCol } from "@/data/core";
import { deskUsers, fleetAudit, fmtStamp, generateUsername, handoverEvents, isLatinName, logAudit, nowStamp, type DeskUser } from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import type { ScreenProps } from "@/screens/types";
import { useActor } from "../_shared/hooks";

const ROLE = { desk_operator: "Desk operator", desk_lead: "Desk lead" } as const;

export default function DeskUsersScreen(_: ScreenProps) {
  void _;
  const actor = useActor();
  const users = deskUsers.useAll();
  const locs = locationsCol.useAll();
  const events = handoverEvents.useAll();
  const [add, setAdd] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [created, setCreated] = useState("");
  const cur = users.find((u) => u.id === sel);
  const desk = (id: string) => locs.find((l) => l.id === id)?.name ?? id;

  const cols: Column<DeskUser>[] = [
    { key: "name", header: "Name", value: (u) => u.name, cell: (u) => <span className="font-medium">{u.name}</span> },
    { key: "user", header: "Username", value: (u) => u.username, cell: (u) => <code className="text-xs">{u.username}</code> },
    { key: "desk", header: "Desk", value: (u) => desk(u.deskId) },
    { key: "role", header: "Role", value: (u) => ROLE[u.role] },
    { key: "pw", header: "First login", value: (u) => (u.mustChangePassword ? "pending" : "done"), cell: (u) => (u.status === "active" && u.mustChangePassword ? <StatusBadge tone="warn">must change password</StatusBadge> : "—") },
    { key: "st", header: "Status", value: (u) => u.status, cell: (u) => <StatusBadge tone={u.status === "active" ? "good" : "neutral"}>{u.status === "active" ? "Active" : "Offboarded (login off)"}</StatusBadge> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Handover desk users" description="Individual accounts for the staff who run the handover desks. Every handover is attributed to the person who recorded it." actions={<Button onClick={() => { setAdd(true); setCreated(""); }}><Plus /> Add desk user</Button>} />
      {created && <p className="rounded-md bg-emerald-100 p-3 text-sm text-emerald-900">{created}</p>}
      <DataTable rows={users} columns={cols} exportName="desk-users" onRowClick={(u) => setSel(u.id)} />
      {add && <AddForm actor={actor.name} onClose={(msg) => { setAdd(false); if (msg) setCreated(msg); }} />}
      {cur && <DetailSheet u={cur} actor={actor.name} desk={desk} handled={events.filter((e) => e.operatorId === cur.id).length} onClose={() => setSel(null)} />}
    </div>
  );
}

function AddForm({ actor, onClose }: { actor: string; onClose: (msg?: string) => void }) {
  const users = deskUsers.useAll();
  const desks = locationsCol.useAll().filter((l) => l.kind === "handover_desk");
  const workers = workersCol.useAll();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [deskId, setDeskId] = useState(desks[0]?.id ?? "");
  const [role, setRole] = useState<DeskUser["role"]>("desk_operator");
  const [err, setErr] = useState("");
  const full = `${first.trim()} ${last.trim()}`.trim();
  const preview = first.trim() && last.trim() && isLatinName(first) && isLatinName(last) ? generateUsername(full, users, workers.map((w) => w.username)) : "";

  const save = async () => {
    if (!first.trim() || !last.trim()) return setErr("First and last name are required.");
    if (!isLatinName(first) || !isLatinName(last)) return setErr("Write the name in Latin letters (Arabic names are transliterated).");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter a valid email address for the temporary password.");
    if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) return setErr("This email already belongs to a desk user.");
    if (!deskId) return setErr("Choose the desk this person works at.");
    const username = generateUsername(full, await deskUsers.list(), workers.map((w) => w.username));
    const id = deskUsers.nextId("du");
    await deskUsers.save({ id, name: full, username, email: email.trim(), deskId, role, status: "active", mustChangePassword: true, createdAt: nowStamp(), version: 1 });
    await logAudit(actor, "Desk user", id, "Created", `${full} (${username}) at ${desks.find((d) => d.id === deskId)?.name}, ${ROLE[role]}`);
    onClose(`Created ${full}. Username ${username} is fixed. A temporary password was emailed to ${email.trim()}; they must change it at first login.`);
  };

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Add desk user" description="Details and role in one step. The system creates the profile and login." onSubmit={save}>
      <div className="grid grid-cols-2 gap-3"><Field label="First name"><Input value={first} onChange={(e) => setFirst(e.target.value)} /></Field><Field label="Last name"><Input value={last} onChange={(e) => setLast(e.target.value)} /></Field></div>
      <Field label="Email (temporary password sent here)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Desk"><Select value={deskId} onChange={(e) => setDeskId(e.target.value)}>{desks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
      <Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value as DeskUser["role"])}><option value="desk_operator">Desk operator</option><option value="desk_lead">Desk lead</option></Select></Field>
      <div className="rounded-md bg-muted/50 p-2 text-sm">Generated username: <code>{preview || "(enter the name in Latin letters)"}</code><br /><span className="text-muted-foreground">Latin letters, words joined by a dot, unique number after a hyphen. Fixed after creation.</span></div>
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}

function DetailSheet({ u, actor, desk, handled, onClose }: { u: DeskUser; actor: string; desk: (id: string) => string; handled: number; onClose: () => void }) {
  const desks = locationsCol.useAll().filter((l) => l.kind === "handover_desk");
  const audit = fleetAudit.useAll().filter((a) => a.entity === "Desk user" && a.entityId === u.id).slice().reverse();
  const [deskId, setDeskId] = useState(u.deskId);
  const [role, setRole] = useState(u.role);
  const [reason, setReason] = useState("");
  const [off, setOff] = useState(false);
  const [err, setErr] = useState("");
  const [lock] = useState(u.version);

  const save = async () => {
    const cur = deskUsers.getSync(u.id);
    if (!cur || cur.version !== lock) return setErr("This user changed elsewhere. Reopen it.");
    if (off) {
      if (!reason.trim()) return setErr("A reason is required to offboard.");
      await deskUsers.save({ ...cur, status: "offboarded", offboardedAt: nowStamp(), version: cur.version + 1 });
      await logAudit(actor, "Desk user", u.id, "Offboarded", `${u.name}: login deactivated automatically. Account kept for attribution`, reason.trim());
      return onClose();
    }
    if (deskId === cur.deskId && role === cur.role) return setErr("Nothing changed.");
    if (!reason.trim()) return setErr("A reason is required for a change.");
    await deskUsers.save({ ...cur, deskId, role, version: cur.version + 1 });
    await logAudit(actor, "Desk user", u.id, "Changed", `${desk(cur.deskId)} to ${desk(deskId)}; ${ROLE[cur.role]} to ${ROLE[role]}`, reason.trim());
    onClose();
  };

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={u.name} description={`${u.username} · ${u.status === "active" ? "active" : "offboarded"}`} onSubmit={save} hideSubmit={u.status !== "active"} submitLabel={off ? "Offboard" : "Save"}>
      <div className="space-y-1 text-sm"><p>Email {u.email}</p><p>Created {fmtStamp(u.createdAt)}{u.offboardedAt ? ` · offboarded ${fmtStamp(u.offboardedAt)}` : ""}</p><p>{handled} handover events recorded by this person</p></div>
      {u.status === "active" && (
        <>
          <Field label="Desk"><Select value={deskId} disabled={off} onChange={(e) => setDeskId(e.target.value)}>{desks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label="Role"><Select value={role} disabled={off} onChange={(e) => setRole(e.target.value as DeskUser["role"])}><option value="desk_operator">Desk operator</option><option value="desk_lead">Desk lead</option></Select></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={off} onChange={(e) => setOff(e.target.checked)} /> Offboard this user (deactivates the login; accounts are never deleted)</label>
          <Field label="Reason (audit)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </>
      )}
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
      <div><p className="mb-1 text-sm font-medium">Audit log</p>{audit.map((a) => <p key={a.id} className="text-sm">{fmtStamp(a.at)} · {a.actor} · {a.action}: {a.detail}{a.reason ? ` (${a.reason})` : ""}</p>)}{audit.length === 0 && <p className="text-sm text-muted-foreground">No changes since creation.</p>}</div>
    </FormSheet>
  );
}
