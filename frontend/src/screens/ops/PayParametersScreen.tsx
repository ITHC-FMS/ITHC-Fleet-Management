"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input } from "@/components/app/fields";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { fmtDate } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import { monthEnd } from "@/data/ops/dates";
import type { Worker } from "@/data/entities";
import { audit, coreWorkersCol, logAudit, payParams, periods } from "@/data/ops/store";
import type { PayParamRec } from "@/data/ops/types";
import type { ScreenProps } from "../types";
import { Notice, ReasonSheet, useActor, useNames } from "./shared";

const kd = (n: number) => formatKD(n, { symbol: false });
const toKd = (n: number) => String(n / 1000);

function EditSheet({ w, rec, onClose }: { w: Worker; rec: PayParamRec | undefined; onClose: () => void }) {
  const actor = useActor();
  const closed = periods.useAll().filter((p) => p.state === "closed");
  const mp = rec?.marketplace;
  const [f, setF] = useState({ base: toKd(w.baseSalary), ot: toKd(w.overtimeComponent), food: toKd(rec?.foodAllowance ?? 0), acc: toKd(rec?.accommodationMax ?? 0), target: String(rec?.monthlyOrderTarget ?? 0), above: String(rec?.incentiveRateAbove ?? 0), below: String(rec?.incentiveRateBelow ?? 0), from: "2026-11-09", pt: String(mp?.pickupTarget ?? ""), dt: String(mp?.dropoffTarget ?? ""), pb: String(mp?.pickupBonusRate ?? ""), ps: String(mp?.pickupShortfallRate ?? ""), db: String(mp?.dropoffBonusRate ?? ""), ds: String(mp?.dropoffShortfallRate ?? "") });
  const [opened] = useState(w.version);
  const [err, setErr] = useState("");
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const retro = closed.filter((p) => f.from <= monthEnd(p.month));
  const isMk = !!f.pt || !!f.dt || !!mp;

  const save = async (reason: string) => {
    const money = [f.base, f.ot, f.food, f.acc].map(parseKD);
    const ints = [f.target, f.above, f.below, ...(isMk ? [f.pt, f.dt, f.pb, f.ps, f.db, f.ds] : [])].map(Number);
    if (money.some((m) => !Number.isFinite(m) || m < 0)) return setErr("Money fields must be valid KD amounts.");
    if (ints.some((n) => !Number.isInteger(n) || n < 0)) return setErr("Targets and fils rates must be whole numbers, zero or more.");
    const cur = coreWorkersCol.getSync(w.id);
    if (cur && cur.version !== opened) return setErr(`Worker changed by someone else (now v${cur.version}). Close and reopen.`);
    const [base, ot, food, acc] = money;
    const n = Object.fromEntries(Object.entries({ pt: f.pt, dt: f.dt, pb: f.pb, ps: f.ps, db: f.db, ds: f.ds }).map(([k, v]) => [k, Number(v) || 0]));
    const next: PayParamRec = { id: w.id, foodAllowance: food, accommodationMax: acc, monthlyOrderTarget: Number(f.target), incentiveRateAbove: Number(f.above), incentiveRateBelow: Number(f.below), effectiveFrom: f.from, version: (rec?.version ?? 0) + 1, marketplace: isMk ? { pickupTarget: n.pt, dropoffTarget: n.dt, pickupBonusRate: n.pb, pickupShortfallRate: n.ps, dropoffBonusRate: n.db, dropoffShortfallRate: n.ds } : undefined };
    await coreWorkersCol.save({ ...(cur ?? w), baseSalary: base, overtimeComponent: ot, version: (cur?.version ?? w.version) + 1 });
    await payParams.save(next);
    await logAudit({ actor, entity: "pay_parameters", entityId: w.id, action: "update", reason, detail: `Base ${kd(w.baseSalary)} to ${kd(base)}, overtime ${kd(w.overtimeComponent)} to ${kd(ot)}, target ${rec?.monthlyOrderTarget ?? 0} to ${f.target}; effective ${f.from}` });
    onClose();
  };

  return (
    <ReasonSheet open onOpenChange={(o) => !o && onClose()} title={`Pay parameters: ${w.name}`} description="Every change is audit-logged with a reason." onConfirm={save}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Base salary (KD)"><Input value={f.base} onChange={(e) => set({ base: e.target.value })} /></Field>
        <Field label="Overtime component (KD)"><Input value={f.ot} onChange={(e) => set({ ot: e.target.value })} /></Field>
        <Field label="Food allowance (KD)"><Input value={f.food} onChange={(e) => set({ food: e.target.value })} /></Field>
        <Field label="Accommodation allowance max (KD)"><Input value={f.acc} onChange={(e) => set({ acc: e.target.value })} /></Field>
        <Field label="Monthly order target"><Input value={f.target} onChange={(e) => set({ target: e.target.value })} /></Field>
        <Field label="Effective from"><Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></Field>
        <Field label="Incentive above target (fils per order)"><Input value={f.above} onChange={(e) => set({ above: e.target.value })} /></Field>
        <Field label="Incentive below target (fils per order)"><Input value={f.below} onChange={(e) => set({ below: e.target.value })} /></Field>
      </div>
      <p className="text-xs font-medium text-muted-foreground">Marketplace targets and bonus rates (fils per event). Leave blank for non-marketplace workers.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pickup target"><Input value={f.pt} onChange={(e) => set({ pt: e.target.value })} /></Field><Field label="Dropoff target"><Input value={f.dt} onChange={(e) => set({ dt: e.target.value })} /></Field>
        <Field label="Pickup bonus (fils)"><Input value={f.pb} onChange={(e) => set({ pb: e.target.value })} /></Field><Field label="Pickup shortfall (fils)"><Input value={f.ps} onChange={(e) => set({ ps: e.target.value })} /></Field>
        <Field label="Dropoff bonus (fils)"><Input value={f.db} onChange={(e) => set({ db: e.target.value })} /></Field><Field label="Dropoff shortfall (fils)"><Input value={f.ds} onChange={(e) => set({ ds: e.target.value })} /></Field>
      </div>
      {retro.length > 0 && <Notice tone="warn">Effective date falls inside closed period {retro.map((p) => p.month).join(", ")}. Closed periods are not altered; reopen one with a reason to recompute it.</Notice>}
      {err && <Notice tone="bad">{err}</Notice>}
    </ReasonSheet>
  );
}

export default function PayParametersScreen({ readOnly, editedBy }: ScreenProps) {
  const names = useNames();
  const recs = payParams.useAll();
  const log = audit.useAll().filter((a) => a.entity === "pay_parameters");
  const [sel, setSel] = useState<Worker | null>(null);
  const cols: Column<Worker>[] = [
    { key: "name", header: "Worker" }, { key: "base", header: "Base (KD)", align: "end", value: (w) => w.baseSalary, cell: (w) => kd(w.baseSalary) }, { key: "ot", header: "Overtime (KD)", align: "end", value: (w) => w.overtimeComponent, cell: (w) => kd(w.overtimeComponent) },
    { key: "food", header: "Food (KD)", align: "end", value: (w) => recs.find((r) => r.id === w.id)?.foodAllowance ?? 0, cell: (w) => kd(recs.find((r) => r.id === w.id)?.foodAllowance ?? 0) },
    { key: "acc", header: "Accommodation (KD)", align: "end", value: (w) => recs.find((r) => r.id === w.id)?.accommodationMax ?? 0, cell: (w) => kd(recs.find((r) => r.id === w.id)?.accommodationMax ?? 0) },
    { key: "target", header: "Target", align: "end", value: (w) => { const r = recs.find((x) => x.id === w.id); return r?.marketplace ? `${r.marketplace.pickupTarget}P / ${r.marketplace.dropoffTarget}D` : r?.monthlyOrderTarget ?? 0; } },
    { key: "rates", header: "Rates (fils)", value: (w) => { const r = recs.find((x) => x.id === w.id); return r?.marketplace ? `+${r.marketplace.pickupBonusRate}/${r.marketplace.dropoffBonusRate} −${r.marketplace.pickupShortfallRate}/${r.marketplace.dropoffShortfallRate}` : `+${r?.incentiveRateAbove ?? 0} −${r?.incentiveRateBelow ?? 0}`; } },
    { key: "from", header: "Effective from", value: (w) => recs.find((r) => r.id === w.id)?.effectiveFrom ?? "", cell: (w) => fmtDate(recs.find((r) => r.id === w.id)?.effectiveFrom) },
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Pay Parameters" description="Rates and targets per worker. These are configuration; the engine reads them, never constants." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <DataTable rows={names.workers} columns={cols} exportName="pay-parameters" onRowClick={readOnly ? undefined : setSel} pageSize={20} />
      <div className="space-y-1"><h2 className="text-sm font-semibold">Change log</h2>
        {log.length === 0 ? <p className="text-sm text-muted-foreground">No changes since go-live.</p> : [...log].reverse().slice(0, 8).map((a) => <p key={a.id} className="text-sm"><span className="text-muted-foreground">{a.at}</span> · {a.actor} · {names.worker(a.entityId)} · {a.detail} · reason: {a.reason}</p>)}</div>
      {sel && !readOnly && <EditSheet key={sel.id} w={sel} rec={recs.find((r) => r.id === sel.id)} onClose={() => setSel(null)} />}
    </div>
  );
}
