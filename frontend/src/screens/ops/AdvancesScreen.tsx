"use client";

import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, toneFor } from "@/components/app/status-badge";
import { nextMonth, monthLabel } from "@/data/ops/dates";
import { instalmentCount, planPaid, planRemaining, planStatus } from "@/data/ops/payroll-run";
import { audit, logAudit, payConfig, plans, versionConflict } from "@/data/ops/store";
import type { DeductionPlan } from "@/data/ops/types";
import { TODAY } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import type { ScreenProps } from "../types";
import { ImportWizard } from "./ImportWizard";
import { Notice, ReasonSheet, useActor, useNames } from "./shared";

const kd = (n: number) => formatKD(n, { symbol: false });

function PlanForm({ initial, advance, onClose }: { initial: DeductionPlan | null; advance: boolean; onClose: () => void }) {
  const names = useNames();
  const actor = useActor();
  const types = payConfig.useAll().filter((c) => c.group === "deduction" && c.active && (advance ? c.key === "advance" : c.key !== "advance"));
  const [f, setF] = useState({ workerId: initial?.workerId ?? "", kind: initial?.kind ?? types[0]?.key ?? "other", description: initial?.description ?? "", total: initial ? String(initial.total / 1000) : "", instalment: initial ? String(initial.instalment / 1000) : "", startMonth: initial?.startMonth ?? nextMonth(TODAY.slice(0, 7)) });
  const [opened] = useState(initial?.version ?? 0);
  const [err, setErr] = useState("");
  const total = parseKD(f.total), inst = parseKD(f.instalment);
  const n = Number.isFinite(total) && inst > 0 ? Math.ceil(total / inst) : 0;
  const submit = async () => {
    if (!f.workerId) return setErr("Choose a worker.");
    if (!Number.isFinite(total) || total <= 0) return setErr("Total must be greater than zero.");
    if (!Number.isFinite(inst) || inst <= 0 || inst > total) return setErr("Instalment must be greater than zero and not above the total.");
    if (initial && planPaid(initial) > total) return setErr("Total cannot be below what is already repaid.");
    const cur = initial ? plans.getSync(initial.id) : undefined;
    if (initial && versionConflict(opened, cur)) return setErr(`Changed by someone else (now v${cur?.version}).`);
    const rec: DeductionPlan = { id: initial?.id ?? plans.nextId("pln"), workerId: f.workerId, kind: advance ? "advance" : f.kind, description: f.description.trim() || (types.find((t) => t.key === f.kind)?.label ?? f.kind), total, instalment: inst, startMonth: f.startMonth, issuedOn: initial?.issuedOn ?? TODAY, repayments: initial?.repayments ?? [], version: (cur?.version ?? 0) + 1 };
    await plans.save(rec);
    await logAudit({ actor, entity: "deduction_plan", entityId: rec.id, action: initial ? "update" : "create", detail: `${names.worker(rec.workerId)}: ${rec.kind} ${kd(total)} KD at ${kd(inst)} KD per period` });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={initial ? "Edit plan" : advance ? "New advance" : "New deduction"} description={advance ? "Repayments are generated automatically as payroll deductions." : "A fine can be recovered in instalments across periods."} onSubmit={submit}>
      <Field label="Worker"><Select value={f.workerId} onChange={(e) => setF({ ...f, workerId: e.target.value })} disabled={!!initial}><option value="">Select…</option>{names.workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
      {!advance && <Field label="Deduction type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select></Field>}
      <Field label="Description / reference"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total (KD)"><Input value={f.total} inputMode="decimal" onChange={(e) => setF({ ...f, total: e.target.value })} /></Field>
        <Field label="Per period (KD)"><Input value={f.instalment} inputMode="decimal" onChange={(e) => setF({ ...f, instalment: e.target.value })} /></Field>
        <Field label="First deduction month"><Input type="month" value={f.startMonth} onChange={(e) => setF({ ...f, startMonth: e.target.value })} /></Field>
      </div>
      {n > 0 && <Notice tone="info">{kd(total)} KD recovered at {kd(inst)} KD over {n} period{n === 1 ? "" : "s"} from {monthLabel(f.startMonth)}.</Notice>}
      {err && <Notice tone="bad">{err}</Notice>}
    </FormSheet>
  );
}

export default function AdvancesScreen({ readOnly, editedBy }: ScreenProps) {
  const names = useNames();
  const actor = useActor();
  const all = plans.useAll();
  const cfg = payConfig.useAll();
  const log = audit.useAll().filter((a) => a.entity === "deduction_plan");
  const [form, setForm] = useState<{ p: DeductionPlan | null; advance: boolean } | null>(null);
  const [sel, setSel] = useState<DeductionPlan | null>(null);
  const [cancel, setCancel] = useState<DeductionPlan | null>(null);
  const [imp, setImp] = useState(false);
  const label = (k: string) => cfg.find((c) => c.group === "deduction" && c.key === k)?.label ?? k.replace(/_/g, " ");

  const kpi = useMemo(() => ({ out: all.reduce((a, p) => a + planRemaining(p), 0), repaying: all.filter((p) => planStatus(p) === "repaying").length, issued: all.filter((p) => planStatus(p) === "issued").length, due: all.filter((p) => planRemaining(p) > 0 && p.startMonth <= TODAY.slice(0, 7)).reduce((a, p) => a + Math.min(p.instalment, planRemaining(p)), 0) }), [all]);
  const cols: Column<DeductionPlan>[] = [
    { key: "worker", header: "Worker", value: (p) => names.worker(p.workerId) },
    { key: "kind", header: "Type", value: (p) => label(p.kind) },
    { key: "description", header: "Description" },
    { key: "total", header: "Total (KD)", align: "end", value: (p) => p.total, cell: (p) => kd(p.total) },
    { key: "inst", header: "Per period (KD)", align: "end", value: (p) => p.instalment, cell: (p) => kd(p.instalment) },
    { key: "rem", header: "Remaining (KD)", align: "end", value: (p) => planRemaining(p), cell: (p) => kd(planRemaining(p)) },
    { key: "start", header: "Starts", value: (p) => p.startMonth },
    { key: "status", header: "Status", value: planStatus, cell: (p) => <StatusBadge tone={planStatus(p) === "cancelled" ? "bad" : toneFor(planStatus(p))}>{planStatus(p)}</StatusBadge> },
  ];

  const schedule = (p: DeductionPlan) => {
    const rows: { month: string; amount: number; state: string }[] = [];
    let left = p.total, m = p.startMonth;
    for (let i = 0; i < instalmentCount(p) && left > 0; i++, m = nextMonth(m)) {
      const amount = Math.min(p.instalment, left);
      left -= amount;
      const rep = p.repayments.find((r) => r.periodId === `pp-${m}`);
      rows.push({ month: m, amount, state: rep ? "Deducted (period locked)" : m <= TODAY.slice(0, 7) ? "Due in payroll run" : "Scheduled" });
    }
    return rows;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Advances & Deductions" description="Advances move issued, repaying, settled. Instalments become payroll deductions automatically."
        actions={!readOnly && <><Button variant="outline" onClick={() => setImp(true)}><Upload /> Import deductions</Button><Button variant="outline" onClick={() => setForm({ p: null, advance: false })}><Plus /> New deduction</Button><Button onClick={() => setForm({ p: null, advance: true })}><Plus /> New advance</Button></>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Outstanding (KD)" value={kd(kpi.out)} /><KpiCard label="Repaying" value={kpi.repaying} /><KpiCard label="Issued, not started" value={kpi.issued} /><KpiCard label="Instalments due now (KD)" value={kd(kpi.due)} />
      </KpiGrid>
      <DataTable rows={all} columns={cols} exportName="advances-deductions" onRowClick={setSel} />
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Audit trail</h2>
        <ul className="space-y-1 text-sm">{[...log].reverse().slice(0, 6).map((a) => <li key={a.id}><span className="text-muted-foreground">{a.at}</span> · {a.actor} · <b>{a.action}</b> {a.entityId} · {a.detail}{a.reason ? ` · reason: ${a.reason}` : ""}</li>)}{log.length === 0 && <li className="text-muted-foreground">No mutations yet.</li>}</ul>
      </div>
      {sel && (
        <FormSheet open onOpenChange={(o) => !o && setSel(null)} title={`${label(sel.kind)}: ${names.worker(sel.workerId)}`} description={sel.description} hideSubmit wide>
          <div className="flex items-center gap-2 text-sm"><StatusBadge tone={toneFor(planStatus(sel))}>{planStatus(sel)}</StatusBadge>Total {kd(sel.total)} · repaid {kd(planPaid(sel))} · remaining {kd(planRemaining(sel))} KD</div>
          <table className="w-full text-sm"><thead><tr className="border-b"><th className="py-1 text-start">Period</th><th className="text-end">Amount (KD)</th><th className="ps-4 text-start">State</th></tr></thead>
            <tbody>{schedule(sel).map((r) => <tr key={r.month} className="border-b"><td className="py-1">{monthLabel(r.month)}</td><td className="text-end tabular-nums">{kd(r.amount)}</td><td className="ps-4">{r.state}</td></tr>)}</tbody></table>
          {!readOnly && planStatus(sel) !== "settled" && planStatus(sel) !== "cancelled" && (
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setForm({ p: sel, advance: sel.kind === "advance" }); setSel(null); }}>Edit plan</Button><Button size="sm" variant="destructive" onClick={() => { setCancel(sel); setSel(null); }}>Cancel plan</Button></div>
          )}
        </FormSheet>
      )}
      {form && !readOnly && <PlanForm key={form.p?.id ?? "new"} initial={form.p} advance={form.advance} onClose={() => setForm(null)} />}
      {cancel && (
        <ReasonSheet open onOpenChange={(o) => !o && setCancel(null)} title="Cancel plan" description="Remaining instalments stop. Past repayments stay recorded." submitLabel="Cancel plan"
          onConfirm={async (reason) => { await plans.save({ ...cancel, cancelled: true, version: cancel.version + 1 }); await logAudit({ actor, entity: "deduction_plan", entityId: cancel.id, action: "cancel", reason, detail: `Cancelled with ${kd(planRemaining(cancel))} KD remaining` }); setCancel(null); }} />
      )}
      {imp && (
        <FormSheet open onOpenChange={(o) => !o && setImp(false)} title="Import deductions" description="Same import wizard as Data Import & Export" hideSubmit wide>
          <ImportWizard fixedTarget="deductions" />
        </FormSheet>
      )}
    </div>
  );
}
