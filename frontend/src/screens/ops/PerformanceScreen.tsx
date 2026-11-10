"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Select } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { BATCHES, CRITERIA, THRESHOLDS, batchForScore, demotionMargin, scoreOf } from "@/data/ops/perf";
import { audit, coreWorkersCol, logAudit, orders, weeklyPerf } from "@/data/ops/store";
import type { Worker } from "@/data/entities";
import { addDays, TODAY } from "@/lib/dates";
import type { ScreenProps } from "../types";
import { Bar, ScoreCells, SpecialHoursPanel, WeeklySheet, rulesNote } from "./PerfPanels";
import { Notice, ReasonSheet, useActor, useNames } from "./shared";

interface Row { id: string; w: Worker; score: number | null; parts: Record<string, number>; proposed: string | null; margin: number | null; week: string }

export default function PerformanceScreen({ readOnly, editedBy }: ScreenProps) {
  const names = useNames();
  const actor = useActor();
  const perf = weeklyPerf.useAll();
  const log = audit.useAll().filter((a) => a.action === "batch_override");
  const ords = orders.useAll();
  const [ov, setOv] = useState<Worker | null>(null);
  const [batch, setBatch] = useState("Batch 1");
  const [err, setErr] = useState("");

  const riders = names.workers.filter((w) => w.riderId);
  const rows: Row[] = useMemo(() => riders.map((w) => {
    const last = perf.filter((p) => p.workerId === w.id).sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
    const sc = last ? scoreOf(last) : null;
    return { id: w.id, w, score: sc?.score ?? null, parts: sc?.parts ?? {}, proposed: sc ? batchForScore(sc.score) : null, margin: sc ? demotionMargin(w.batch, sc.score) : null, week: last?.weekStart ?? "" };
  }), [riders, perf]);
  const watch = rows.filter((r) => r.margin !== null && r.margin < THRESHOLDS.watchMargin).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0));
  const dist = BATCHES.map((b) => ({ b, n: riders.filter((w) => w.batch === b).length }));
  const monthStart = TODAY.slice(0, 8) + "01", elapsed = Number(TODAY.slice(8)) - 1;
  const pace = riders.map((w) => {
    const mo = ords.filter((o) => o.workerId === w.id && o.date >= monthStart && o.date < TODAY && o.kind === "marketplace");
    const p = mo.reduce((a, o) => a + (o.kind === "marketplace" ? o.pickups : 0), 0);
    const target = Math.round((600 * elapsed) / 30);
    return { id: w.id, w, p, target, pct: target ? (p / target) * 100 : 0 };
  });
  const behind = pace.filter((x) => x.pct < 85);
  const overridesThisMonth = log.filter((a) => a.at.startsWith(TODAY.slice(0, 7))).length;

  const openOverride = (w: Worker, to?: string) => { setOv(w); setBatch(to ?? w.batch ?? "Batch 1"); setErr(""); };
  const cols: Column<Row>[] = [
    { key: "w", header: "Driver", value: (r) => r.w.name },
    { key: "rider", header: "Rider ID", value: (r) => r.w.riderId },
    { key: "batch", header: "Current batch", value: (r) => r.w.batch ?? "", cell: (r) => <StatusBadge tone={r.w.batch === "Batch 1" ? "good" : r.w.batch === "Batch 2" ? "info" : "warn"}>{r.w.batch ?? "None"}</StatusBadge> },
    { key: "score", header: "Score (latest week)", align: "end", value: (r) => r.score },
    { key: "proposed", header: "Rule proposes", value: (r) => r.proposed ?? "", cell: (r) => (r.proposed && r.proposed !== r.w.batch ? <StatusBadge tone="warn">{r.proposed}</StatusBadge> : <span className="text-muted-foreground">{r.proposed ? "same" : "—"}</span>) },
    { key: "last", header: "Last override reason", sortable: false, value: (r) => log.filter((a) => a.entityId === r.id).slice(-1)[0]?.reason ?? "" },
    ...(!readOnly ? [{ key: "a", header: "", sortable: false, cell: (r: Row) => <Button size="xs" variant="outline" onClick={() => openOverride(r.w)}>Override batch</Button> }] : []),
  ];

  const submit = async (reason: string) => {
    if (!ov) return;
    if (batch === ov.batch) return setErr("Choose a different batch.");
    const cur = coreWorkersCol.getSync(ov.id);
    await coreWorkersCol.save({ ...(cur ?? ov), batch, version: (cur?.version ?? ov.version) + 1 });
    await logAudit({ actor, entity: "batch", entityId: ov.id, action: "batch_override", reason, detail: `${ov.name}: ${ov.batch ?? "none"} to ${batch}. Orders already entered keep the batch snapshotted at order time.` });
    setOv(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Marketplace Performance" description="Performance bands drive marketplace revenue. Manual overrides need a reason and are logged." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Marketplace drivers" value={riders.length} /><KpiCard label="Overrides this month" value={overridesThisMonth} /><KpiCard label="On watchlist" value={watch.length} tone={watch.length ? "warn" : "good"} /><KpiCard label="Behind pace (<85%)" value={behind.length} tone={behind.length ? "bad" : "good"} />
      </KpiGrid>
      <Tabs tabs={[
        { id: "d", label: "Drivers and batch", content: <DataTable rows={rows} columns={cols} exportName="marketplace-performance" pageSize={15} /> },
        { id: "o", label: "Override audit", content: (
          <div className="divide-y rounded-lg border bg-card">{log.length === 0 && <p className="p-6 text-center text-muted-foreground">No overrides logged.</p>}
            {[...log].reverse().map((a) => <div key={a.id} className="space-y-0.5 px-3 py-2 text-sm"><p><b>{names.worker(a.entityId)}</b> · {a.detail}</p><p className="text-xs text-muted-foreground">{a.at} · {a.actor} · reason: {a.reason}</p></div>)}</div>) },
        { id: "w", label: "Weekly sheet (P1)", content: <WeeklySheet /> },
        { id: "s", label: "Scoring proposals (P1)", content: (
          <div className="space-y-3"><Notice tone="info">{rulesNote}</Notice>
            <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="px-2 py-2 text-start">Driver</th>{CRITERIA.map((c) => <th key={c.key} className="px-2 text-end font-medium">{c.label.split(" (")[0]}</th>)}<th className="px-2 text-end">Score</th><th className="px-2">Current</th><th className="px-2">Proposed</th><th /></tr></thead>
              <tbody>{rows.filter((r) => r.score !== null).map((r) => <tr key={r.id} className="border-t"><td className="px-2 py-1.5 font-medium">{r.w.name}</td><ScoreCells parts={r.parts} /><td className="px-2 text-end font-semibold tabular-nums">{r.score}</td><td className="px-2 text-center">{r.w.batch}</td><td className="px-2 text-center">{r.proposed !== r.w.batch ? <StatusBadge tone="warn">{r.proposed}</StatusBadge> : "same"}</td><td className="px-2">{!readOnly && r.proposed !== r.w.batch && <Button size="xs" variant="outline" onClick={() => openOverride(r.w, r.proposed ?? undefined)}>Review change</Button>}</td></tr>)}</tbody></table></div></div>) },
        { id: "wl", label: "Batch defence watchlist (P1)", content: (
          <div className="divide-y rounded-lg border bg-card">{watch.length === 0 && <p className="p-6 text-center text-muted-foreground">Nobody is within {THRESHOLDS.watchMargin} points of demotion.</p>}
            {watch.map((r) => <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm"><b className="w-44">{r.w.name}</b><StatusBadge>{r.w.batch}</StatusBadge><span className="flex-1">score {r.score}, {r.margin !== null && r.margin < 0 ? `${Math.abs(r.margin).toFixed(1)} points below the threshold` : `${r.margin?.toFixed(1)} points above the demotion line`}</span></div>)}</div>) },
        { id: "h", label: "Special hours (P1)", content: <SpecialHoursPanel /> },
        { id: "k", label: "Operations dashboard (P1)", content: (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2 rounded-lg border bg-card p-4"><p className="text-sm font-semibold">Batch distribution</p>{dist.map((d) => <div key={d.b} className="flex items-center gap-2 text-sm"><span className="w-16">{d.b}</span><Bar v={d.n} max={riders.length} /><span className="w-8 text-end">{d.n}</span></div>)}</div>
            <div className="space-y-2 rounded-lg border bg-card p-4"><p className="text-sm font-semibold">Pace against monthly pickup target (to {addDays(TODAY, -1)})</p>{pace.map((x) => <div key={x.id} className="flex items-center gap-2 text-sm"><span className="w-32 truncate">{x.w.name}</span><Bar v={x.pct} max={120} tone={x.pct < 85 ? "bg-red-500" : "bg-emerald-500"} /><span className="w-14 text-end tabular-nums">{x.pct.toFixed(0)}%</span></div>)}</div>
            <div className="space-y-1 rounded-lg border bg-card p-4 lg:col-span-2"><p className="text-sm font-semibold">KPI alerts</p>
              {behind.map((x) => <p key={x.id} className="text-sm"><StatusBadge tone="bad">Pace</StatusBadge> {x.w.name} at {x.pct.toFixed(0)}% of pickup target</p>)}
              {watch.map((r) => <p key={r.id} className="text-sm"><StatusBadge tone="warn">Batch</StatusBadge> {r.w.name} close to demotion from {r.w.batch}</p>)}
              {behind.length + watch.length === 0 && <p className="text-sm text-muted-foreground">No alerts.</p>}</div>
          </div>) },
      ]} />
      {ov && !readOnly && (
        <ReasonSheet open onOpenChange={(o) => !o && setOv(null)} title={`Override batch: ${ov.name}`} description={`Currently ${ov.batch ?? "none"}. The change applies from now; past orders keep the batch they were entered with.`} submitLabel="Apply override" onConfirm={submit}>
          <Field label="New batch"><Select value={batch} onChange={(e) => setBatch(e.target.value)}>{BATCHES.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          {err && <Notice tone="bad">{err}</Notice>}
        </ReasonSheet>
      )}
    </div>
  );
}
