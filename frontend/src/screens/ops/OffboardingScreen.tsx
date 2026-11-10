"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select } from "@/components/app/fields";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { addDays, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import { planPaid, planRemaining } from "@/data/ops/payroll-run";
import { assignments, entries, logAudit, offboardings, plans, segments, workerLogins, workerExt } from "@/data/ops/store";
import { addStatusSegment } from "@/data/ops/worker-ops";
import type { Offboarding } from "@/data/ops/types";
import type { ScreenProps } from "../types";
import { Notice, useActor, useNames } from "./shared";

const DOCS: { key: keyof Offboarding["docs"]; label: string }[] = [
  { key: "civilId", label: "Civil ID / residency card" }, { key: "licence", label: "Driving licence" }, { key: "uniform", label: "Uniform" },
  { key: "keys", label: "Keys and access cards" }, { key: "simCard", label: "SIM card" }, { key: "deviceBag", label: "Device and delivery bag" },
];
const kd = (n: number) => formatKD(n, { symbol: false });

function useSettlement(workerId: string, lastDay: string) {
  const ens = entries.useAll();
  const pl = plans.useAll().filter((p) => p.workerId === workerId && planRemaining(p) > 0);
  const final = ens.find((e) => e.workerId === workerId && e.periodId === `pp-${lastDay.slice(0, 7)}`);
  const outstanding = pl.reduce((a, p) => a + planRemaining(p), 0);
  return { final, pl, outstanding, net: (final?.result.net ?? 0) - outstanding };
}

function Detail({ rec, editable, onClose }: { rec: Offboarding; editable: boolean; onClose: () => void }) {
  const names = useNames();
  const actor = useActor();
  const segs = segments.useAll().filter((s) => s.workerId === rec.id);
  const asg = assignments.useAll().filter((a) => a.workerId === rec.id && a.vehicleId).sort((a, b) => b.from.localeCompare(a.from))[0];
  const st = useSettlement(rec.id, rec.lastDay);
  const [ref, setRef] = useState(rec.vehicleReturnRef ?? "");
  const [err, setErr] = useState("");
  const final = segs.find((s) => ["terminated", "inactive", "absconded"].includes(s.status));
  const save = (patch: Partial<Offboarding>) => offboardings.save({ ...rec, ...patch, version: rec.version + 1 });
  const docsDone = Object.values(rec.docs).filter(Boolean).length;
  const ready = !!final && rec.settlementApproved && (rec.vehicleReturned || !asg) && docsDone === DOCS.length;

  const approveSettlement = async () => {
    for (const p of st.pl) await plans.save({ ...p, repayments: [...p.repayments, { periodId: `settle-${rec.id}`, amount: planRemaining(p) }], version: p.version + 1 });
    await save({ settlementApproved: true });
    await logAudit({ actor, entity: "offboarding", entityId: rec.id, action: "settlement_approved", detail: `Final pay ${kd(st.final?.result.net ?? 0)} less outstanding ${kd(st.outstanding)} = ${kd(st.net)} KD` });
  };
  const complete = async () => {
    if (!ready) return setErr("Complete every step first: final status, settlement, vehicle return and all documents.");
    const login = workerLogins.getSync(rec.id);
    if (login) await workerLogins.save({ ...login, active: false });
    const ext = workerExt.getSync(rec.id);
    if (ext) await workerExt.save({ ...ext, offboarding: { startedOn: rec.startedOn, lastDay: rec.lastDay } });
    await save({ completed: true });
    await logAudit({ actor, entity: "offboarding", entityId: rec.id, action: "complete", detail: "Offboarding completed; worker login deactivated automatically" });
    onClose();
  };

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={`Offboarding: ${names.worker(rec.id)}`} description={`${rec.reason} · last day ${fmtDate(rec.lastDay)}`} wide hideSubmit>
      <section className="space-y-1"><h3 className="text-sm font-semibold">1. Final status segment</h3>
        {final ? <p className="text-sm"><StatusBadge tone="bad">{final.status}</StatusBadge> from {fmtDate(final.from)}</p> : (
          <div className="flex items-center gap-2"><p className="text-sm text-muted-foreground">No final status yet.</p>{editable && <Button size="sm" variant="outline" onClick={() => addStatusSegment({ workerId: rec.id, status: "terminated", from: addDays(rec.lastDay, 1), to: null, actor })}>Add terminated from {addDays(rec.lastDay, 1)}</Button>}</div>)}</section>
      <section className="space-y-1"><h3 className="text-sm font-semibold">2. Final payroll settlement</h3>
        <table className="w-full text-sm"><tbody>
          <tr className="border-b"><td className="py-1">Final month net pay ({rec.lastDay.slice(0, 7)})</td><td className="text-end tabular-nums">{st.final ? kd(st.final.result.net) : "not generated"}</td></tr>
          {st.pl.map((p) => <tr key={p.id} className="border-b"><td className="py-1">Less outstanding: {p.description} (repaid {kd(planPaid(p))} of {kd(p.total)})</td><td className="text-end tabular-nums">-{kd(planRemaining(p))}</td></tr>)}
          <tr className="font-semibold"><td className="py-1">{st.net >= 0 ? "Amount due to worker" : "Amount owed by worker"}</td><td className="text-end tabular-nums">{kd(Math.abs(st.net))}</td></tr>
        </tbody></table>
        {!st.final && <Notice tone="warn">The final month has not been generated in a payroll period yet. Generate it on the Payroll Run before approving.</Notice>}
        {rec.settlementApproved ? <StatusBadge tone="good">Settlement approved</StatusBadge> : editable && <Button size="sm" disabled={!st.final} onClick={approveSettlement}>Approve settlement (clears outstanding advances and deductions)</Button>}
        <p className="text-xs text-muted-foreground">Calculation only: no payment disbursement, WPS, PIFSS or indemnity calculation.</p></section>
      <section className="space-y-1"><h3 className="text-sm font-semibold">3. Vehicle and equipment return</h3>
        <p className="text-sm">{asg ? `Last vehicle: ${names.plate(asg.vehicleId)}` : "No vehicle assigned"}</p>
        {rec.vehicleReturned ? <StatusBadge tone="good">Closing handover event {rec.vehicleReturnRef}</StatusBadge> : editable && (
          <div className="flex items-end gap-2"><Field label="Closing handover event reference"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="HO-1109-001" className="w-52" /></Field><Button size="sm" disabled={!ref.trim()} onClick={() => { save({ vehicleReturned: true, vehicleReturnRef: ref.trim() }); logAudit({ actor, entity: "offboarding", entityId: rec.id, action: "vehicle_returned", detail: `Closing handover ${ref}` }); }}>Confirm return</Button></div>)}</section>
      <section className="space-y-1"><h3 className="text-sm font-semibold">4. Document return checklist ({docsDone}/{DOCS.length})</h3>
        {DOCS.map((d) => <label key={d.key} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable || rec.completed} checked={rec.docs[d.key]} onChange={(e) => save({ docs: { ...rec.docs, [d.key]: e.target.checked } })} />{d.label}</label>)}</section>
      {rec.completed ? <Notice tone="good">Offboarding completed. The worker login is deactivated.</Notice> : editable && (<div className="space-y-2"><Button disabled={!ready} onClick={complete}><UserMinus /> Complete offboarding (deactivates login)</Button>{err && <Notice tone="bad">{err}</Notice>}</div>)}
    </FormSheet>
  );
}

export default function OffboardingScreen({ readOnly, editedBy }: ScreenProps) {
  const names = useNames();
  const actor = useActor();
  const all = offboardings.useAll();
  const pl = plans.useAll();
  const [sel, setSel] = useState<string | null>(null);
  const [start, setStart] = useState(false);
  const [w, setW] = useState(""), [last, setLast] = useState(TODAY), [reason, setReason] = useState("Resigned");
  const cols: Column<Offboarding>[] = [
    { key: "w", header: "Worker", value: (r) => names.worker(r.id) }, { key: "last", header: "Last day", cell: (r) => fmtDate(r.lastDay), value: (r) => r.lastDay },
    { key: "reason", header: "Reason" },
    { key: "owed", header: "Outstanding (KD)", align: "end", value: (r) => pl.filter((p) => p.workerId === r.id).reduce((a, p) => a + planRemaining(p), 0), cell: (r) => kd(pl.filter((p) => p.workerId === r.id).reduce((a, p) => a + planRemaining(p), 0)) },
    { key: "settle", header: "Settlement", value: (r) => (r.settlementApproved ? "approved" : "open"), cell: (r) => <StatusBadge tone={r.settlementApproved ? "good" : "warn"}>{r.settlementApproved ? "Approved" : "Open"}</StatusBadge> },
    { key: "veh", header: "Vehicle returned", value: (r) => (r.vehicleReturned ? "yes" : "no"), cell: (r) => <StatusBadge tone={r.vehicleReturned ? "good" : "warn"}>{r.vehicleReturned ? "Yes" : "Pending"}</StatusBadge> },
    { key: "docs", header: "Documents returned", value: (r) => Object.values(r.docs).filter(Boolean).length, cell: (r) => `${Object.values(r.docs).filter(Boolean).length}/${DOCS.length}` },
    { key: "state", header: "State", value: (r) => (r.completed ? "completed" : "in progress"), cell: (r) => <StatusBadge tone={r.completed ? "good" : "warn"}>{r.completed ? "Completed" : "In progress"}</StatusBadge> },
  ];
  const rec = all.find((r) => r.id === sel);
  return (
    <div className="space-y-5">
      <PageHeader title="Offboarding" description="A worker leaving the company: final status, settlement, vehicle and document return." actions={!readOnly && <Button onClick={() => setStart(true)}><UserMinus /> Start offboarding</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <DataTable rows={all} columns={cols} exportName="offboarding" onRowClick={(r) => setSel(r.id)} />
      {rec && <Detail key={rec.id + rec.version} rec={rec} editable={!readOnly} onClose={() => setSel(null)} />}
      {start && (
        <FormSheet open onOpenChange={(o) => !o && setStart(false)} title="Start offboarding" submitLabel="Start"
          onSubmit={async () => { if (!w) return; await offboardings.save({ id: w, lastDay: last, startedOn: TODAY, reason, vehicleReturned: false, docs: { civilId: false, licence: false, uniform: false, keys: false, simCard: false, deviceBag: false }, settlementApproved: false, completed: false, version: 1 }); await logAudit({ actor, entity: "offboarding", entityId: w, action: "start", detail: `${reason}, last day ${last}` }); setStart(false); setSel(w); }}>
          <Field label="Worker"><Select value={w} onChange={(e) => setW(e.target.value)}><option value="">Select…</option>{names.workers.filter((x) => !all.some((r) => r.id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
          <Field label="Last working day"><Input type="date" value={last} onChange={(e) => setLast(e.target.value)} /></Field>
          <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </FormSheet>
      )}
    </div>
  );
}
