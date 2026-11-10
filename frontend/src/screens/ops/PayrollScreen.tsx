"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, Lock, Printer, RefreshCw, RotateCcw, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/app/form-sheet";
import { Input } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, toneFor, prettify } from "@/components/app/status-badge";
import { contracts, companies } from "@/data/core";
import { monthLabel } from "@/data/ops/dates";
import { runSelfCheck } from "@/data/ops/payroll-engine";
import { applyRepayments, generateEntries, revertRepayments, type RunContext } from "@/data/ops/payroll-run";
import { assignments, entries as entriesCol, logAudit, orders, payConfig, payParams, periods, plans, segments, useWorkerView, coreWorkersCol } from "@/data/ops/store";
import type { PayrollEntry, PayrollPeriod } from "@/data/ops/types";
import { formatKD } from "@/lib/money";
import { TODAY } from "@/lib/dates";
import type { ScreenProps } from "../types";
import { PayslipSheet as Payslip } from "./Payslip";
import { PayrollTable } from "./PayrollTable";
import { exportCsv, exportExcel, exportJson, printPayslips } from "./payroll-exports";
import { Notice, ReasonSheet, useActor } from "./shared";

export default function PayrollScreen({ readOnly, editedBy }: ScreenProps) {
  const actor = useActor();
  const ws = useWorkerView();
  const rawWorkers = coreWorkersCol.useAll();
  const periodList = periods.useAll();
  const allEntries = entriesCol.useAll();
  const planList = plans.useAll(), segs = segments.useAll(), ords = orders.useAll(), prm = payParams.useAll(), asg = assignments.useAll(), cons = contracts.useAll(), cfg = payConfig.useAll();
  const company = companies.useAll().find((c) => c.id === "cmp-ithc")?.name ?? "ITHC Logistics";
  const [month, setMonth] = useState("2026-10");
  const [slip, setSlip] = useState<PayrollEntry | null>(null);
  const [mode, setMode] = useState<"" | "approve" | "reopen" | "regen">("");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "transition" | "placed" | "negative">("all");
  const [showCheck, setShowCheck] = useState(false);
  const check = useMemo(() => runSelfCheck(), []);

  const sorted = [...periodList].sort((a, b) => a.month.localeCompare(b.month));
  const period = sorted.find((p) => p.month === month) ?? sorted[0];
  const nameOf = (id: string) => ws.find((w) => w.id === id)?.name ?? id;
  const entries = allEntries.filter((e) => e.periodId === period.id);
  const shown = entries.filter((e) => (!q || nameOf(e.workerId).toLowerCase().includes(q.toLowerCase())) && (only === "all" || (only === "transition" ? !!e.transition : only === "placed" ? e.placed : e.result.net < 0)))
    .sort((a, b) => nameOf(a.workerId).localeCompare(nameOf(b.workerId)));
  const ctx: RunContext = { workers: rawWorkers, segments: segs, orders: ords, plans: planList, params: prm, assignments: asg, contracts: cons, config: cfg };
  const totals = entries.reduce((a, e) => ({ gross: a.gross + e.result.gross, net: a.net + e.result.net, tr: a.tr + (e.transition ? 1 : 0), neg: a.neg + (e.result.net < 0 ? 1 : 0) }), { gross: 0, net: 0, tr: 0, neg: 0 });
  const dedTypes = cfg.filter((c) => c.group === "deduction" && c.active);
  const locked = period.state === "closed";

  const savePeriod = async (p: PayrollPeriod, action: string, extra: Partial<PayrollPeriod>, reason?: string) =>
    periods.save({ ...p, ...extra, version: p.version + 1, events: [...p.events, { at: TODAY, by: actor, action, reason }] });

  const generate = async () => {
    const fresh = generateEntries(period.month, ctx);
    await entriesCol.saveMany(fresh);
    await savePeriod(period, "Generated", { state: "open", generatedAt: TODAY });
    await logAudit({ entity: "payroll_period", entityId: period.id, action: "generate", detail: `${fresh.length} entries generated for ${period.month}` });
  };
  const regenerate = async () => {
    const fresh = generateEntries(period.month, ctx, entries);
    const keep = new Set(fresh.map((e) => e.id));
    for (const e of entries) if (!keep.has(e.id)) await entriesCol.remove(e.id);
    await entriesCol.saveMany(fresh);
    await savePeriod(period, "Regenerated", {});
    await logAudit({ entity: "payroll_period", entityId: period.id, action: "regenerate", detail: "Entries recomputed from current data; manual deductions kept" });
    setMode("");
  };
  const approve = async () => {
    await plans.saveMany(applyRepayments(planList, entries, period.id));
    await savePeriod(period, "Approved and locked", { state: "closed", approvedBy: actor, approvedAt: TODAY });
    await logAudit({ entity: "payroll_period", entityId: period.id, action: "approve_lock", detail: `Locked with net ${formatKD(totals.net)}` });
    setMode("");
  };
  const reopen = async (reason: string) => {
    await plans.saveMany(revertRepayments(planList, period.id));
    await savePeriod(period, "Reopened", { state: "open", approvedBy: undefined, approvedAt: undefined }, reason);
    await logAudit({ entity: "payroll_period", entityId: period.id, action: "reopen", reason, detail: `Period ${period.month} reopened` });
    setMode("");
  };
  const onEntry = async (e: PayrollEntry) => { await entriesCol.save(e); };
  const out = entries.slice().sort((a, b) => nameOf(a.workerId).localeCompare(nameOf(b.workerId)));
  const canEdit = !readOnly && period.state === "open";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll Run"
        description={`${company} · ${monthLabel(period.month)}`}
        actions={
          !readOnly && (
            <>
              {period.state === "not_generated" && <Button onClick={generate}><Play /> Generate period</Button>}
              {period.state === "open" && <Button variant="outline" onClick={() => setMode("regen")}><RefreshCw /> Regenerate</Button>}
              {period.state === "open" && <Button onClick={() => setMode("approve")}><Lock /> Approve &amp; lock</Button>}
              {locked && <Button variant="outline" onClick={() => setMode("reopen")}><RotateCcw /> Reopen</Button>}
            </>
          )
        }
      />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <div className="flex flex-wrap items-center gap-2">
        {sorted.map((p) => (
          <Button key={p.id} size="sm" variant={p.id === period.id ? "default" : "outline"} onClick={() => setMonth(p.month)}>
            {monthLabel(p.month)} <StatusBadge tone={toneFor(p.state)} className="ms-1">{prettify(p.state)}</StatusBadge>
          </Button>
        ))}
        <button type="button" onClick={() => setShowCheck(!showCheck)} className="ms-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
          {check.pass ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />}
          Engine self-check: {check.pass ? "pass" : "FAIL"} ({check.results.filter((r) => r.pass).length}/{check.results.length} scenarios)
        </button>
      </div>
      {showCheck && (
        <Notice tone={check.pass ? "good" : "bad"}>
          <ul className="list-disc ps-5">{check.results.map((r) => <li key={r.name}>{r.pass ? "pass" : "FAIL"}: {r.name} {r.failures.join("; ")}</li>)}</ul>
        </Notice>
      )}
      <KpiGrid>
        <KpiCard label="Period status" value={prettify(period.state)} hint={period.approvedBy ? `Locked by ${period.approvedBy}, ${period.approvedAt}` : "Not locked"} tone={locked ? "good" : period.state === "open" ? "warn" : "default"} />
        <KpiCard label="Drivers in run" value={entries.length} hint={`${totals.tr} in transition`} />
        <KpiCard label="Gross (KD)" value={formatKD(totals.gross, { symbol: false })} />
        <KpiCard label="Net (KD)" value={formatKD(totals.net, { symbol: false })} tone={totals.neg ? "bad" : "default"} hint={totals.neg ? `${totals.neg} negative net` : undefined} />
      </KpiGrid>
      {period.state === "not_generated" ? (
        <Notice tone="info">Period {monthLabel(period.month)} has not been generated. Generate it to compute every driver from status segments, orders, pay parameters and deductions.</Notice>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search driver…" value={q} onChange={(e) => setQ(e.target.value)} className="w-52" />
            {(["all", "transition", "placed", "negative"] as const).map((k) => <Button key={k} size="sm" variant={only === k ? "secondary" : "ghost"} onClick={() => setOnly(k)}>{prettify(k)}</Button>)}
            <span className="ms-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => printPayslips(period.month, out, nameOf, company)}><Printer /> Export payslips (PDF)</Button>
              <Button size="sm" variant="outline" onClick={() => exportExcel(period.month, out, nameOf, company)}><Download /> Excel</Button>
              <Button size="sm" variant="outline" onClick={() => exportCsv(period.month, out, nameOf)}><Download /> Accounting CSV</Button>
              <Button size="sm" variant="outline" onClick={() => exportJson(period.month, out, nameOf)}><Download /> JSON</Button>
            </span>
          </div>
          {locked && <Notice tone="info">This period is locked. Retroactive changes to assignments, pay parameters or statuses do not alter it. Reopen it (with a reason) to recompute.</Notice>}
          <PayrollTable entries={shown} nameOf={nameOf} editable={canEdit} types={dedTypes} onChange={onEntry} onPayslip={setSlip} />
          <p className="text-xs text-muted-foreground">Calculation only: no payment disbursement, WPS, PIFSS or indemnity calculation is performed.</p>
        </>
      )}
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Period history</h2>
        {period.events.length === 0 ? <p className="text-sm text-muted-foreground">No events yet.</p> : (
          <ul className="space-y-1 text-sm">{period.events.map((ev, i) => <li key={i}><span className="text-muted-foreground">{ev.at}</span> · {ev.by} · <b>{ev.action}</b>{ev.reason ? ` · reason: ${ev.reason}` : ""}</li>)}</ul>
        )}
      </div>
      <Payslip entry={slip} month={period.month} name={slip ? nameOf(slip.workerId) : ""} company={company} onClose={() => setSlip(null)} />
      <FormSheet open={mode === "approve"} onOpenChange={(o) => !o && setMode("")} title="Approve and lock period" description={monthLabel(period.month)} submitLabel="Approve & lock" onSubmit={approve}>
        <p className="text-sm">Locking {entries.length} entries with gross {formatKD(totals.gross)} and net {formatKD(totals.net)}. Advance and fine instalments in this run are recorded as repayments.</p>
        {totals.neg > 0 && <Notice tone="bad">{totals.neg} entr{totals.neg === 1 ? "y has" : "ies have"} negative net pay. Review before locking.</Notice>}
        {totals.tr > 0 && <Notice tone="warn">{totals.tr} driver(s) are in transition (computed against more than one contract or client).</Notice>}
      </FormSheet>
      <FormSheet open={mode === "regen"} onOpenChange={(o) => !o && setMode("")} title="Regenerate open period" submitLabel="Regenerate" onSubmit={regenerate}>
        <p className="text-sm">Recomputes every entry from current statuses, orders, parameters and instalment plans. Manual deduction lines you added are kept; instalment amounts you adjusted are reset.</p>
      </FormSheet>
      <ReasonSheet open={mode === "reopen"} onOpenChange={(o) => !o && setMode("")} title="Reopen closed period" description={`${monthLabel(period.month)} will become editable again. Instalment repayments recorded at lock are reverted.`} submitLabel="Reopen period" onConfirm={reopen} />
    </div>
  );
}
