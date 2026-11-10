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
import { workers } from "@/data/core";
import { leases, occupancy, properties, stays, units, userAudit, type Occupancy, type Stay } from "@/data/people";
import { leaseValidOn, occupancyConflicts } from "@/data/people/calc";
import { addDays, daysBetween, fmtDate, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { DaysBadge, Errors, Notice, stamp, useActor } from "../common";

interface Draft { kind: "worker" | "guest"; workerId: string; guestName: string; guestSponsor: string; propertyId: string; unitId: string; bed: string; start: string; end: string; fileName: string }
type Mode = { type: "renew" | "out"; id: string; date: string };

export default function Stays({ readOnly, editedBy }: ScreenProps) {
  const actor = useActor();
  const ss = stays.useAll();
  const occ = occupancy.useAll();
  const props = properties.useAll();
  const us = units.useAll();
  const ls = leases.useAll();
  const ws = workers.useAll();
  const audit = userAudit.useAll();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [showEnded, setShowEnded] = useState(false);

  const pname = (id: string) => props.find((p) => p.id === id)?.name ?? id;
  const uname = (id: string) => us.find((u) => u.id === id)?.unitNo ?? id;
  const who = (s: Stay) => (s.kind === "worker" ? ws.find((w) => w.id === s.workerId)?.name ?? s.workerId : s.guestName) ?? "";
  const rows = ss.filter((s) => showEnded || s.status === "active");
  const active = ss.filter((s) => s.status === "active");
  const expiring = active.filter((s) => daysBetween(TODAY, s.end) >= 0 && daysBetween(TODAY, s.end) <= 30);
  const lapsed = active.filter((s) => s.end < TODAY);

  const cols: Column<Stay>[] = [
    { key: "who", header: "Resident", value: who, cell: (s) => <span>{who(s)} {s.kind === "guest" && <StatusBadge tone="info">Guest</StatusBadge>}</span> },
    { key: "property", header: "Property", value: (s) => pname(s.propertyId) },
    { key: "unit", header: "Unit", value: (s) => uname(s.unitId) },
    { key: "start", header: "Stay start", value: (s) => s.start, cell: (s) => fmtDate(s.start) },
    { key: "end", header: "Stay end", value: (s) => s.end, cell: (s) => fmtDate(s.end) },
    { key: "left", header: "Days left", value: (s) => daysBetween(TODAY, s.end), cell: (s) => (s.status === "ended" ? <StatusBadge>Ended</StatusBadge> : <DaysBadge days={daysBetween(TODAY, s.end)} />) },
    { key: "status", header: "Status", value: (s) => (s.status === "active" && s.end < TODAY ? "lapsed" : s.status), cell: (s) => (s.status === "ended" ? <StatusBadge>Ended</StatusBadge> : s.end < TODAY ? <StatusBadge tone="bad">Lapsed: move out manually</StatusBadge> : <StatusBadge tone="good">Active</StatusBadge>) },
    { key: "file", header: "Stay document", value: (s) => s.fileName ?? "" },
    ...(!readOnly ? [{ key: "act", header: "", sortable: false, cell: (s: Stay) => s.status === "active" ? (
      <span className="flex gap-1">
        <Button size="xs" variant="outline" onClick={() => { setErrs([]); setMode({ type: "renew", id: s.id, date: addDays(s.end, 365) }); }}>Renew</Button>
        <Button size="xs" variant="outline" onClick={() => { setErrs([]); setMode({ type: "out", id: s.id, date: TODAY }); }}>Move out</Button>
      </span>) : null } as Column<Stay>] : []),
  ];

  const openNew = () => { setErrs([]); setDraft({ kind: "worker", workerId: "", guestName: "", guestSponsor: "", propertyId: props.find((p) => leaseValidOn(ls, p.id))?.id ?? "", unitId: "", bed: "", start: TODAY, end: addDays(TODAY, 365), fileName: "" }); };
  const freeBeds = (d: Draft) => {
    const u = us.find((x) => x.id === d.unitId);
    if (!u) return [];
    return Array.from({ length: u.beds }, (_, i) => i + 1).filter((b) => !occ.some((o) => o.unitId === u.id && o.bed === b && o.moveIn <= d.start && (o.moveOut === null || o.moveOut >= d.start)));
  };

  const saveNew = async () => {
    if (!draft) return;
    const e: string[] = [];
    if (draft.kind === "worker" && !draft.workerId) e.push("Choose the worker");
    if (draft.kind === "guest" && !draft.guestName.trim()) e.push("Enter the guest's name");
    if (!draft.propertyId) e.push("Choose a property");
    else if (!leaseValidOn(ls, draft.propertyId, draft.start)) e.push("This building's contract is not valid on the stay start date");
    if (!draft.unitId || !draft.bed) e.push("Choose a unit and bed");
    if (!draft.start || !draft.end || draft.end < draft.start) e.push("Stay end must be on or after the stay start");
    const stayId = stays.nextId("stay");
    const o: Occupancy = { id: occupancy.nextId("occ"), workerId: draft.kind === "worker" ? draft.workerId : "", guestName: draft.kind === "guest" ? draft.guestName.trim() : undefined, propertyId: draft.propertyId, unitId: draft.unitId, bed: Number(draft.bed), moveIn: draft.start, moveOut: null, stayId };
    if (!e.length) e.push(...occupancyConflicts(occ, o));
    setErrs(e);
    if (e.length) return;
    await occupancy.save(o);
    await stays.save({ id: stayId, kind: draft.kind, workerId: o.workerId || undefined, guestName: o.guestName, guestSponsor: draft.guestSponsor || undefined, propertyId: draft.propertyId, unitId: draft.unitId, start: draft.start, end: draft.end, status: "active", fileName: draft.fileName || undefined, version: 1 });
    await userAudit.save({ id: userAudit.nextId("ua"), at: stamp(), by: actor, subjectId: stayId, action: "Stay created", detail: `${o.guestName ?? ws.find((w) => w.id === o.workerId)?.name}, ${pname(o.propertyId)} ${uname(o.unitId)} bed ${o.bed}, ${draft.start} to ${draft.end}` });
    setDraft(null);
  };

  const target = mode ? ss.find((s) => s.id === mode.id) : undefined;
  const saveMode = async () => {
    if (!mode || !target) return;
    const e: string[] = [];
    if (mode.type === "renew") {
      if (!mode.date || mode.date <= target.end) e.push(`The renewed end date must be after the current end (${fmtDate(target.end)})`);
      if (!leaseValidOn(ls, target.propertyId, mode.date)) e.push("The building contract does not cover the renewed period; renew the building contract first");
    } else if (!mode.date || mode.date < target.start) e.push("Move-out cannot be before the stay start");
    setErrs(e);
    if (e.length) return;
    const o = occ.find((x) => x.stayId === target.id && x.moveOut === null);
    if (mode.type === "renew") {
      const nid = stays.nextId("stay");
      await stays.save({ ...target, status: "ended", version: target.version + 1 });
      await stays.save({ ...target, id: nid, start: addDays(target.end, 1), end: mode.date, status: "active", renewedFromId: target.id, version: 1 });
      if (o) await occupancy.save({ ...o, stayId: nid });
      await userAudit.save({ id: userAudit.nextId("ua"), at: stamp(), by: actor, subjectId: nid, action: "Stay renewed", detail: `${who(target)} extended from ${target.end} to ${mode.date}` });
    } else {
      await stays.save({ ...target, status: "ended", end: mode.date < target.end ? mode.date : target.end, version: target.version + 1 });
      if (o) await occupancy.save({ ...o, moveOut: mode.date });
      await userAudit.save({ id: userAudit.nextId("ua"), at: stamp(), by: actor, subjectId: target.id, action: "Moved out", detail: `${who(target)} left ${pname(target.propertyId)} on ${mode.date}` });
    }
    setMode(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Stay Contracts" description="Each worker's or guest's accommodation stay, with its period and renewals." actions={!readOnly && <Button onClick={openNew}>New stay</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {lapsed.length > 0 && <Notice tone="bad">{lapsed.length} stay contract(s) have passed their end date while the resident is still in the bed: {lapsed.map(who).join(", ")}. Moving out is a manual action.</Notice>}
      <KpiGrid>
        <KpiCard label="Active stays" value={active.length} />
        <KpiCard label="Ending within 30 days" value={expiring.length} tone={expiring.length ? "warn" : "good"} />
        <KpiCard label="Lapsed, still housed" value={lapsed.length} tone={lapsed.length ? "bad" : "good"} />
        <KpiCard label="Guests" value={active.filter((s) => s.kind === "guest").length} />
      </KpiGrid>
      <Tabs tabs={[
        { id: "stays", label: "Stays", content: <DataTable rows={rows} columns={cols} exportName="stays" searchPlaceholder="Search stays…" filters={<label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} />Show ended</label>} /> },
        { id: "audit", label: "Audit log", content: <DataTable rows={[...audit].filter((a) => /^(stay|occ)-/.test(a.subjectId)).reverse()} exportName="stay-audit" columns={[{ key: "at", header: "When" }, { key: "by", header: "By" }, { key: "action", header: "Action" }, { key: "detail", header: "Detail" }]} /> },
      ]} />

      <FormSheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title="New stay" description="Creates the stay contract and the bed assignment in the occupancy ledger." onSubmit={saveNew}>
        {draft && (
          <>
            <Errors list={errs} />
            <Field label="Resident type"><Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}><option value="worker">Worker</option><option value="guest">Guest</option></Select></Field>
            {draft.kind === "worker"
              ? <Field label="Worker"><Select value={draft.workerId} onChange={(e) => setDraft({ ...draft, workerId: e.target.value })}><option value="">Choose…</option>{ws.filter((w) => !["terminated", "inactive", "absconded"].includes(w.status)).map((w) => <option key={w.id} value={w.id}>{w.name} ({w.username})</option>)}</Select></Field>
              : <><Field label="Guest name"><Input value={draft.guestName} onChange={(e) => setDraft({ ...draft, guestName: e.target.value })} /></Field><Field label="Sponsor / company"><Input value={draft.guestSponsor} onChange={(e) => setDraft({ ...draft, guestSponsor: e.target.value })} /></Field></>}
            <Field label="Property" hint="Only buildings with a valid building contract">
              <Select value={draft.propertyId} onChange={(e) => setDraft({ ...draft, propertyId: e.target.value, unitId: "", bed: "" })}><option value="">Choose…</option>{props.filter((p) => leaseValidOn(ls, p.id, draft.start)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit"><Select value={draft.unitId} onChange={(e) => setDraft({ ...draft, unitId: e.target.value, bed: "" })}><option value="">Choose…</option>{us.filter((u) => u.propertyId === draft.propertyId).map((u) => <option key={u.id} value={u.id}>{u.unitNo}</option>)}</Select></Field>
              <Field label="Bed"><Select value={draft.bed} onChange={(e) => setDraft({ ...draft, bed: e.target.value })}><option value="">Choose…</option>{freeBeds(draft).map((b) => <option key={b} value={b}>Bed {b}</option>)}</Select></Field>
              <Field label="Stay start"><Input type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value, bed: "" })} /></Field>
              <Field label="Stay end"><Input type="date" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></Field>
            </div>
            <Field label="Stay document (file name recorded)"><Input type="file" accept="application/pdf,image/*" onChange={(e) => setDraft({ ...draft, fileName: e.target.files?.[0]?.name ?? "" })} /></Field>
          </>
        )}
      </FormSheet>

      <FormSheet open={!!mode} onOpenChange={(o) => !o && setMode(null)} title={mode?.type === "renew" ? "Renew stay" : "Move out"} description={target ? `${who(target)}, ${pname(target.propertyId)}, ends ${fmtDate(target.end)}` : undefined} onSubmit={saveMode} submitLabel={mode?.type === "renew" ? "Renew" : "Move out"}>
        {mode && (
          <>
            <Errors list={errs} />
            <Field label={mode.type === "renew" ? "New stay end date" : "Last day in the bed"}><Input type="date" value={mode.date} onChange={(e) => setMode({ ...mode, date: e.target.value })} /></Field>
            {mode.type === "out" && <Notice>Moving a resident out after expiry is a manual action. This also ends their bed assignment.</Notice>}
          </>
        )}
      </FormSheet>
    </div>
  );
}
