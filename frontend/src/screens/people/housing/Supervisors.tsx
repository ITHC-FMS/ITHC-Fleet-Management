"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { Button } from "@/components/ui/button";
import { clients, locations, workers } from "@/data/core";
import { supervisors, userAudit, type SiteSupervisor } from "@/data/people";
import { DEMO_USERS } from "@/lib/auth";
import { fmtDate, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { Errors, Notice, stamp, useActor } from "../common";

const ROLES = ["Site supervisor", "Site supervisor (client contact)"];
const LATIN = /^[A-Za-z][A-Za-z' -]*$/;

interface Draft { id?: string; version?: number; name: string; email: string; roleLabel: string; siteLocationId: string; clientId: string }

/** ahmed.ali-0042 style: first and last name, Latin letters only, unique number after the hyphen. */
function makeUsername(name: string, taken: number[]) {
  const words = name.trim().toLowerCase().replace(/[^a-z\s-]/g, "").split(/[\s]+/).filter(Boolean).map((w) => w.replace(/-/g, ""));
  const base = words.length > 1 ? `${words[0]}.${words.slice(1).join("")}` : words[0];
  const n = Math.max(100, ...taken) + 1;
  return `${base}-${String(n).padStart(4, "0")}`;
}

export default function Supervisors({ readOnly, editedBy }: ScreenProps) {
  const actor = useActor();
  const list = supervisors.useAll();
  const audit = userAudit.useAll();
  const locs = locations.useAll();
  const clientList = clients.useAll();
  const ws = workers.useAll();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [off, setOff] = useState<SiteSupervisor | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [done, setDone] = useState<SiteSupervisor | null>(null);
  const [showOff, setShowOff] = useState(false);

  const takenNums = () => [
    ...list.map((s) => Number(s.username.split("-").pop())),
    ...ws.map((w) => Number(w.username.split("-").pop())),
    ...Object.values(DEMO_USERS).map((u) => Number(u.username.split("-").pop())),
  ].filter(Number.isFinite);
  const sites = locs.filter((l) => ["client_site", "operating_building", "housing"].includes(l.kind));
  const sname = (id: string) => locs.find((l) => l.id === id)?.name ?? id;
  const rows = list.filter((s) => showOff || s.status === "active");

  const cols: Column<SiteSupervisor>[] = [
    { key: "name", header: "Name", cell: (s) => <div><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.email}</div></div> },
    { key: "username", header: "Username" },
    { key: "role", header: "Role", value: (s) => s.roleLabel },
    { key: "site", header: "Site", value: (s) => sname(s.siteLocationId) },
    { key: "client", header: "Client", value: (s) => clientList.find((c) => c.id === s.clientId)?.name ?? "" },
    { key: "login", header: "Login", value: (s) => (s.loginActive ? "active" : "deactivated"), cell: (s) => (s.loginActive ? <StatusBadge tone="good">Active{s.mustChangePassword ? ", must change password" : ""}</StatusBadge> : <StatusBadge tone="bad">Deactivated</StatusBadge>) },
    { key: "status", header: "Status", value: (s) => s.status, cell: (s) => (s.status === "active" ? <StatusBadge tone="good">Active</StatusBadge> : <StatusBadge>Offboarded {fmtDate(s.offboardedOn)}</StatusBadge>) },
    ...(!readOnly ? [{ key: "act", header: "", sortable: false, cell: (s: SiteSupervisor) => s.status === "active" ? (
      <span className="flex gap-1">
        <Button size="xs" variant="outline" onClick={() => { setErrs([]); setDraft({ id: s.id, version: s.version, name: s.name, email: s.email, roleLabel: s.roleLabel, siteLocationId: s.siteLocationId, clientId: s.clientId ?? "" }); }}>Change site / role</Button>
        <Button size="xs" variant="outline" onClick={() => setOff(s)}>Offboard</Button>
      </span>) : null } as Column<SiteSupervisor>] : []),
  ];

  const save = async () => {
    if (!draft) return;
    const e: string[] = [];
    const cur = draft.id ? list.find((s) => s.id === draft.id) : undefined;
    if (!draft.id) {
      if (!draft.name.trim()) e.push("Name is required");
      else if (!LATIN.test(draft.name.trim())) e.push("Write the name in Latin letters (transliterate Arabic names)");
      if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) e.push("A valid email address is required (the temporary password is emailed there)");
      else if (list.some((s) => s.email.toLowerCase() === draft.email.trim().toLowerCase())) e.push("That email already belongs to another supervisor");
    }
    if (!draft.siteLocationId) e.push("Choose the site this supervisor is linked to");
    if (draft.roleLabel.includes("client contact") && !draft.clientId) e.push("Choose the client this contact belongs to");
    if (cur && cur.version !== draft.version) e.push("Changed by someone else. Close and reopen.");
    setErrs(e);
    if (e.length) return;
    const clientId = draft.roleLabel.includes("client contact") ? draft.clientId : undefined;
    if (cur) {
      const notes: string[] = [];
      if (cur.siteLocationId !== draft.siteLocationId) notes.push(`site ${sname(cur.siteLocationId)} to ${sname(draft.siteLocationId)}`);
      if (cur.roleLabel !== draft.roleLabel) notes.push(`role ${cur.roleLabel} to ${draft.roleLabel}`);
      if (!notes.length) { setDraft(null); return; }
      await supervisors.save({ ...cur, siteLocationId: draft.siteLocationId, roleLabel: draft.roleLabel, clientId, version: cur.version + 1 });
      await userAudit.save({ id: userAudit.nextId("ua"), at: stamp(), by: actor, subjectId: cur.id, action: cur.roleLabel !== draft.roleLabel ? "Role changed" : "Site changed", detail: notes.join("; ") });
      setDraft(null);
      return;
    }
    const taken = takenNums();
    const sup: SiteSupervisor = {
      id: supervisors.nextId("sup"), name: draft.name.trim(), email: draft.email.trim(), username: makeUsername(draft.name, taken), roleLabel: draft.roleLabel,
      siteLocationId: draft.siteLocationId, clientId, status: "active", loginActive: true, mustChangePassword: true, createdOn: TODAY, version: 1,
    };
    await supervisors.save(sup);
    await userAudit.save({ id: userAudit.nextId("ua"), at: stamp(), by: actor, subjectId: sup.id, action: "Account created", detail: `${sup.username}, ${sup.roleLabel}, ${sname(sup.siteLocationId)}; temporary password emailed` });
    setDraft(null);
    setDone(sup);
  };

  const offboard = async () => {
    if (!off) return;
    await supervisors.save({ ...off, status: "offboarded", loginActive: false, mustChangePassword: false, offboardedOn: TODAY, version: off.version + 1 });
    await userAudit.save({ id: userAudit.nextId("ua"), at: stamp(), by: actor, subjectId: off.id, action: "Offboarded", detail: "Login deactivated automatically; the account is kept" });
    setOff(null);
  };

  const active = list.filter((s) => s.status === "active");
  return (
    <div className="space-y-6">
      <PageHeader title="Site Supervisors" description="Onboard and offboard the supervisors for each site." actions={!readOnly && <Button onClick={() => { setErrs([]); setDone(null); setDraft({ name: "", email: "", roleLabel: ROLES[0], siteLocationId: "", clientId: "" }); }}>Add supervisor</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {done && <Notice tone="good">Account created for <b>{done.name}</b>. Username <b>{done.username}</b> (fixed from now on). A temporary password was emailed to {done.email}; they must change it at first login.</Notice>}
      <KpiGrid>
        <KpiCard label="Active supervisors" value={active.length} />
        <KpiCard label="Client contacts" value={active.filter((s) => s.clientId).length} />
        <KpiCard label="Sites covered" value={new Set(active.map((s) => s.siteLocationId)).size} />
        <KpiCard label="Awaiting first login" value={active.filter((s) => s.mustChangePassword).length} />
      </KpiGrid>
      <Tabs tabs={[
        { id: "list", label: "Supervisors", content: <DataTable rows={rows} columns={cols} exportName="site-supervisors" searchPlaceholder="Search supervisors…" filters={<label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} />Show offboarded</label>} /> },
        { id: "audit", label: "Audit log", content: <DataTable rows={[...audit].filter((a) => a.subjectId.startsWith("sup-")).reverse()} exportName="supervisor-audit" columns={[{ key: "at", header: "When" }, { key: "by", header: "By" }, { key: "subject", header: "Supervisor", value: (a) => list.find((s) => s.id === a.subjectId)?.name ?? a.subjectId }, { key: "action", header: "Action" }, { key: "detail", header: "Detail" }]} /> },
      ]} />

      <FormSheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title={draft?.id ? "Change site or role" : "Add supervisor"} description={draft?.id ? "The username is fixed and cannot change." : "Details and role in one step. The username is generated."} onSubmit={save}>
        {draft && (
          <>
            <Errors list={errs} />
            <Field label="Full name (Latin letters)"><Input disabled={!!draft.id} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Email" hint="The temporary password is emailed here"><Input type="email" disabled={!!draft.id} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
            {!draft.id && draft.name.trim() && LATIN.test(draft.name.trim()) && (
              <p className="text-xs text-muted-foreground">Username will be like <b>{makeUsername(draft.name, takenNums())}</b></p>
            )}
            <Field label="Role"><Select value={draft.roleLabel} onChange={(e) => setDraft({ ...draft, roleLabel: e.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
            {draft.roleLabel.includes("client contact") && (
              <Field label="Client"><Select value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}><option value="">Choose…</option>{clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            )}
            <Field label="Site" hint="The supervisor sees only this site"><Select value={draft.siteLocationId} onChange={(e) => setDraft({ ...draft, siteLocationId: e.target.value })}><option value="">Choose…</option>{sites.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
          </>
        )}
      </FormSheet>

      <FormSheet open={!!off} onOpenChange={(o) => !o && setOff(null)} title="Offboard supervisor" onSubmit={offboard} submitLabel="Offboard">
        {off && <Notice tone="warn">{off.name} ({off.username}) will lose access immediately. The login is deactivated automatically and the account is kept for the audit trail; accounts are never deleted by hand.</Notice>}
      </FormSheet>
    </div>
  );
}
