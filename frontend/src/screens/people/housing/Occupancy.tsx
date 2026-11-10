"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { Button } from "@/components/ui/button";
import { workers } from "@/data/core";
import { leases, occupancy, properties, stays, units, type Occupancy } from "@/data/people";
import { capacityOf, currentLease, housingCostPerHead, leaseValidOn, occupancyConflicts, occupiesOn } from "@/data/people/calc";
import { fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { Errors, Notice, stamp, useActor } from "../common";
import { userAudit } from "@/data/people";

interface Draft { id?: string; kind: "worker" | "guest"; workerId: string; guestName: string; propertyId: string; unitId: string; bed: string; moveIn: string; note: string }
interface Out { id: string; date: string }

export default function OccupancyLedger({ readOnly, editedBy }: ScreenProps) {
  const actor = useActor();
  const occ = occupancy.useAll();
  const props = properties.useAll();
  const us = units.useAll();
  const ls = leases.useAll();
  const ws = workers.useAll();
  const st = stays.useAll();
  const [asOf, setAsOf] = useState(TODAY);
  const [propF, setPropF] = useState("all");
  const [history, setHistory] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [out, setOut] = useState<Out | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [wq, setWq] = useState("");

  const wname = (id: string) => ws.find((w) => w.id === id)?.name ?? id;
  const who = (o: Occupancy) => (o.workerId ? wname(o.workerId) : o.guestName ?? "Guest");
  const pname = (id: string) => props.find((p) => p.id === id)?.name ?? id;
  const uname = (id: string) => us.find((u) => u.id === id)?.unitNo ?? id;
  const cost = useMemo(() => housingCostPerHead(occ, ls, asOf), [occ, ls, asOf]);

  const active = occ.filter((o) => occupiesOn(o, asOf));
  const capacity = props.reduce((a, p) => a + capacityOf(us, p.id), 0);
  const rentTotal = props.reduce((a, p) => (active.some((o) => o.propertyId === p.id) ? a + (currentLease(ls, p.id)?.monthlyCost ?? 0) : a), 0);
  const perHead = active.length ? Math.round(rentTotal / active.length) : 0;

  const rows = occ.filter((o) => (history ? true : occupiesOn(o, asOf)) && (propF === "all" || o.propertyId === propF));

  const cols: Column<Occupancy>[] = [
    { key: "property", header: "Property", value: (o) => pname(o.propertyId) },
    { key: "unit", header: "Unit / bed", value: (o) => `${uname(o.unitId)} bed ${o.bed}`, cell: (o) => `${uname(o.unitId)} / bed ${o.bed}` },
    { key: "who", header: "Resident", value: who, cell: (o) => <span>{who(o)} {!o.workerId && <StatusBadge tone="info">Guest</StatusBadge>}</span> },
    { key: "in", header: "Move in", value: (o) => o.moveIn, cell: (o) => fmtDate(o.moveIn) },
    { key: "out", header: "Move out", value: (o) => o.moveOut ?? "9999", cell: (o) => (o.moveOut ? fmtDate(o.moveOut) : "—") },
    { key: "state", header: "On " + fmtDate(asOf), value: (o) => (occupiesOn(o, asOf) ? "Living here" : o.moveIn > asOf ? "Reserved" : "Moved out"), cell: (o) => occupiesOn(o, asOf) ? <StatusBadge tone="good">Living here</StatusBadge> : o.moveIn > asOf ? <StatusBadge tone="info">Reserved</StatusBadge> : <StatusBadge>Moved out</StatusBadge> },
    { key: "cost", header: "Cost / month (KD)", align: "end", value: (o) => cost.byOcc.get(o.id) ?? 0, cell: (o) => (cost.byOcc.has(o.id) ? formatKD(cost.byOcc.get(o.id)!, { symbol: false }) : "—") },
    ...(!readOnly ? [{ key: "act", header: "", sortable: false, cell: (o: Occupancy) => (o.moveOut === null || o.moveOut >= TODAY) ? <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setErrs([]); setOut({ id: o.id, date: TODAY }); }}>Move out</Button> : null } as Column<Occupancy>] : []),
  ];

  const openAssign = () => {
    const p = props.find((x) => leaseValidOn(ls, x.id));
    setErrs([]);
    setDraft({ kind: "worker", workerId: "", guestName: "", propertyId: p?.id ?? "", unitId: "", bed: "", moveIn: TODAY, note: "" });
  };

  const freeBeds = (d: Draft) => {
    const u = us.find((x) => x.id === d.unitId);
    if (!u) return [];
    return Array.from({ length: u.beds }, (_, i) => i + 1).filter((b) => !occ.some((o) => o.unitId === u.id && o.bed === b && o.id !== d.id && o.moveIn <= d.moveIn && (o.moveOut === null || o.moveOut >= d.moveIn)));
  };

  const save = async () => {
    if (!draft) return;
    const e: string[] = [];
    if (draft.kind === "worker" && !draft.workerId) e.push("Choose the worker");
    if (draft.kind === "guest" && !draft.guestName.trim()) e.push("Enter the guest's name");
    if (!draft.propertyId) e.push("Choose a property");
    else if (!leaseValidOn(ls, draft.propertyId, draft.moveIn)) e.push("This building's contract is not valid on the move-in date, so beds cannot be assigned");
    if (!draft.unitId) e.push("Choose a unit");
    if (!draft.bed) e.push("Choose a bed");
    if (!draft.moveIn) e.push("Move-in date is required");
    const rec: Occupancy = { id: occupancy.nextId("occ"), workerId: draft.kind === "worker" ? draft.workerId : "", guestName: draft.kind === "guest" ? draft.guestName.trim() : undefined, propertyId: draft.propertyId, unitId: draft.unitId, bed: Number(draft.bed), moveIn: draft.moveIn, moveOut: null, note: draft.note || undefined };
    if (!e.length) e.push(...occupancyConflicts(occ, rec));
    setErrs(e);
    if (e.length) return;
    await occupancy.save(rec);
    await userAudit.save({ id: userAudit.nextId("ua"), at: stamp(), by: actor, subjectId: rec.id, action: "Bed assigned", detail: `${who(rec)} to ${pname(rec.propertyId)} ${uname(rec.unitId)} bed ${rec.bed} from ${rec.moveIn}` });
    setDraft(null);
  };

  const doMoveOut = async () => {
    if (!out) return;
    const o = occ.find((x) => x.id === out.id)!;
    const e: string[] = [];
    if (!out.date) e.push("Move-out date is required");
    else if (out.date < o.moveIn) e.push("Move-out cannot be before move-in");
    setErrs(e);
    if (e.length) return;
    await occupancy.save({ ...o, moveOut: out.date });
    const stay = st.find((s) => s.id === o.stayId);
    if (stay && stay.status === "active") await stays.save({ ...stay, status: "ended", end: out.date < stay.end ? out.date : stay.end, version: stay.version + 1 });
    await userAudit.save({ id: userAudit.nextId("ua"), at: stamp(), by: actor, subjectId: o.id, action: "Moved out", detail: `${who(o)} from ${pname(o.propertyId)} on ${out.date}` });
    setOut(null);
  };

  const byProp = props.map((p) => {
    const cap = capacityOf(us, p.id);
    const here = active.filter((o) => o.propertyId === p.id);
    const lease = currentLease(ls, p.id);
    return { p, cap, occ: here.length, vac: Math.max(0, cap - here.length), rent: lease?.monthlyCost ?? 0, open: leaseValidOn(ls, p.id, asOf), per: here.length ? Math.round((lease?.monthlyCost ?? 0) / here.length) : 0 };
  });

  const workerHits = wq.trim() ? ws.filter((w) => `${w.name} ${w.username}`.toLowerCase().includes(wq.toLowerCase())).slice(0, 6) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Occupancy Ledger" description="Who lives where, for any date." actions={!readOnly && <Button onClick={openAssign}>Assign bed</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Occupied beds" value={active.length} hint={`of ${capacity} beds on ${fmtDate(asOf)}`} />
        <KpiCard label="Vacant beds" value={Math.max(0, capacity - active.length)} />
        <KpiCard label="Occupancy" value={`${capacity ? ((active.length / capacity) * 100).toFixed(1) : "0.0"}%`} />
        <KpiCard label="Housing cost per head" value={formatKD(perHead)} hint="Monthly rent ÷ residents" />
      </KpiGrid>
      <Tabs tabs={[
        { id: "ledger", label: "Ledger", content: (
          <DataTable rows={rows} columns={cols} exportName="occupancy-ledger" searchPlaceholder="Search resident…"
            filters={<>
              <Field label="" className="w-40"><Input type="date" aria-label="As of date" value={asOf} onChange={(e) => setAsOf(e.target.value || TODAY)} /></Field>
              <Select className="w-48" value={propF} onChange={(e) => setPropF(e.target.value)}><option value="all">All properties</option>{props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />Include past and future</label>
            </>} />) },
        { id: "property", label: "By property", content: (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-start">Property</th><th className="px-3 py-2 text-end">Capacity</th><th className="px-3 py-2 text-end">Occupied</th><th className="px-3 py-2 text-end">Vacant</th><th className="px-3 py-2 text-end">Rent (KD)</th><th className="px-3 py-2 text-end">Cost / head (KD)</th><th className="px-3 py-2 text-start">Building contract</th></tr></thead>
              <tbody>{byProp.map((r) => (
                <tr key={r.p.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.p.name}</td><td className="px-3 py-2 text-end">{r.cap}</td><td className="px-3 py-2 text-end">{r.occ}</td>
                  <td className="px-3 py-2 text-end">{r.vac}</td><td className="px-3 py-2 text-end">{formatKD(r.rent, { symbol: false })}</td><td className="px-3 py-2 text-end">{r.occ ? formatKD(r.per, { symbol: false }) : "—"}</td>
                  <td className="px-3 py-2">{r.open ? <StatusBadge tone="good">Valid</StatusBadge> : <StatusBadge tone="bad">Expired: closed to new beds</StatusBadge>}</td>
                </tr>))}</tbody>
            </table>
          </div>) },
        { id: "worker", label: "By worker", content: (
          <div className="space-y-3">
            <Input className="max-w-sm" placeholder="Find a worker…" value={wq} onChange={(e) => setWq(e.target.value)} />
            {workerHits.map((w) => (
              <div key={w.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="font-medium">{w.name} <span className="text-xs text-muted-foreground">{w.username}</span></div>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {occ.filter((o) => o.workerId === w.id).sort((a, b) => b.moveIn.localeCompare(a.moveIn)).map((o) => (
                    <li key={o.id}>{pname(o.propertyId)} / {uname(o.unitId)} bed {o.bed}: {fmtDate(o.moveIn)} to {o.moveOut ? fmtDate(o.moveOut) : "now"} {o.note && <em className="text-muted-foreground">({o.note})</em>}</li>
                  ))}
                  {!occ.some((o) => o.workerId === w.id) && <li className="text-muted-foreground">Never housed.</li>}
                </ul>
              </div>
            ))}
          </div>) },
      ]} />

      <FormSheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title="Assign bed" description="Date-ranged. The end date is entered when the resident moves out." onSubmit={save}>
        {draft && (
          <>
            <Errors list={errs} />
            <Field label="Resident type"><Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}><option value="worker">Worker</option><option value="guest">Guest</option></Select></Field>
            {draft.kind === "worker"
              ? <Field label="Worker"><Select value={draft.workerId} onChange={(e) => setDraft({ ...draft, workerId: e.target.value })}><option value="">Choose…</option>{ws.filter((w) => !["terminated", "inactive", "absconded"].includes(w.status)).map((w) => <option key={w.id} value={w.id}>{w.name} ({w.username})</option>)}</Select></Field>
              : <Field label="Guest name"><Input value={draft.guestName} onChange={(e) => setDraft({ ...draft, guestName: e.target.value })} /></Field>}
            <Field label="Property" hint="Only buildings with a valid building contract are listed">
              <Select value={draft.propertyId} onChange={(e) => setDraft({ ...draft, propertyId: e.target.value, unitId: "", bed: "" })}>
                <option value="">Choose…</option>{props.filter((p) => leaseValidOn(ls, p.id, draft.moveIn)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit"><Select value={draft.unitId} onChange={(e) => setDraft({ ...draft, unitId: e.target.value, bed: "" })}><option value="">Choose…</option>{us.filter((u) => u.propertyId === draft.propertyId).map((u) => <option key={u.id} value={u.id}>{u.unitNo} ({u.beds} beds)</option>)}</Select></Field>
              <Field label="Bed"><Select value={draft.bed} onChange={(e) => setDraft({ ...draft, bed: e.target.value })}><option value="">Choose…</option>{freeBeds(draft).map((b) => <option key={b} value={b}>Bed {b}</option>)}</Select></Field>
            </div>
            <Field label="Move-in date"><Input type="date" value={draft.moveIn} onChange={(e) => setDraft({ ...draft, moveIn: e.target.value, bed: "" })} /></Field>
            <Field label="Note"><Textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
          </>
        )}
      </FormSheet>

      <FormSheet open={!!out} onOpenChange={(o) => !o && setOut(null)} title="Move out" description="The move-out date is inclusive: the resident still occupies the bed on that day." onSubmit={doMoveOut} submitLabel="Move out">
        {out && (
          <>
            <Errors list={errs} />
            <Notice>Ends the bed assignment and the linked stay contract.</Notice>
            <Field label="Last day in the bed"><Input type="date" value={out.date} onChange={(e) => setOut({ ...out, date: e.target.value })} /></Field>
          </>
        )}
      </FormSheet>
    </div>
  );
}
