"use client";

import Link from "next/link";
import { useMemo } from "react";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, toneFor, prettify } from "@/components/app/status-badge";
import { contracts } from "@/data/core";
import { scheduleConflicts } from "@/data/ops/conflicts";
import { monthLabel, weekStartOf } from "@/data/ops/dates";
import { fuelAnomalies } from "@/data/ops/fuel";
import { planRemaining, planStatus } from "@/data/ops/payroll-run";
import { clientRevenue } from "@/data/ops/revenue";
import { assignments, conflictAcks, docExpiries, entries, fuelTx, invoices, orders, periods, plans, segments, shifts } from "@/data/ops/store";
import { addDays, overlaps, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "../types";
import { useNames } from "./shared";

const kd = (n: number) => formatKD(n, { symbol: false });
function Card({ title, href, role, children }: { title: string; href: string; role: string; children: React.ReactNode }) {
  return <Link href={`/${role}/${href}`} className="block space-y-1 rounded-lg border bg-card p-4 hover:bg-muted/40"><p className="text-sm font-semibold">{title}</p><div className="space-y-1 text-sm">{children}</div></Link>;
}

export function OpsHome({ role }: ScreenProps) {
  const names = useNames();
  const ords = orders.useAll(), asg = assignments.useAll(), sh = shifts.useAll(), acks = conflictAcks.useAll(), per = periods.useAll(), ens = entries.useAll();
  const docs = docExpiries.useAll(), fu = fuelTx.useAll(), inv = invoices.useAll(), cons = contracts.useAll(), segs = segments.useAll();
  const week = weekStartOf(TODAY);
  const sheet = useMemo(() => ["cli-americana", "cli-talabat"].map((c) => {
    const roster = new Set(asg.filter((a) => a.clientId === c && a.kind === "regular" && overlaps(a.from, a.to, TODAY, TODAY)).map((a) => a.workerId));
    const done = ords.filter((o) => o.clientId === c && o.date === TODAY && roster.has(o.workerId)).length;
    return { c, done, total: roster.size };
  }), [ords, asg]);
  const conflicts = scheduleConflicts(sh).filter((c) => c.date >= week && c.date <= addDays(week, 6));
  const open = conflicts.filter((c) => !acks.some((a) => a.key === c.key));
  const expired = docs.filter((d) => d.expires < TODAY).length, soon = docs.filter((d) => d.expires >= TODAY && d.expires <= addDays(TODAY, 30)).length;
  const anomalies = fuelAnomalies(fu, names.vehicles);
  const cur = per.find((p) => p.month === TODAY.slice(0, 7)), open1 = per.find((p) => p.state === "open");
  const trans = ens.filter((e) => e.periodId === open1?.id && e.transition);
  const rev = (c: string, m: string) => clientRevenue(c, m, { orders: ords, contracts: cons, workers: names.workers, assignments: asg, segments: segs });
  const rec = inv.map((i) => ({ i, v: i.invoiced === null ? null : i.invoiced - rev(i.clientId, i.month) }));
  return (
    <div className="space-y-5">
      <PageHeader title="Operations Dashboard" description={`Today is ${TODAY}.`} />
      <KpiGrid>
        <KpiCard label="Orders entered today" value={sheet.reduce((a, s) => a + s.done, 0)} hint={`of ${sheet.reduce((a, s) => a + s.total, 0)} expected rows`} tone={sheet.some((s) => s.done < s.total) ? "warn" : "good"} />
        <KpiCard label="Payroll period" value={prettify(open1?.state ?? "closed")} hint={open1 ? monthLabel(open1.month) : ""} />
        <KpiCard label="Schedule conflicts" value={open.length} tone={open.length ? "bad" : "good"} hint="this week, unresolved" />
        <KpiCard label="Fuel anomalies" value={anomalies.length} tone={anomalies.length ? "warn" : "good"} />
      </KpiGrid>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Order entry status" href="orders" role={role}>{sheet.map((s) => <p key={s.c}>{names.client(s.c)}: <b>{s.done}</b> of {s.total} drivers entered {s.done < s.total && <StatusBadge tone="warn">incomplete</StatusBadge>}</p>)}</Card>
        <Card title="Payroll period state" href="payroll" role={role}>{per.map((p) => <p key={p.id}>{monthLabel(p.month)}: <StatusBadge tone={toneFor(p.state)}>{prettify(p.state)}</StatusBadge></p>)}{cur && cur.state === "not_generated" && <p className="text-muted-foreground">Current month not generated yet.</p>}</Card>
        <Card title="Drivers in transition" href="payroll" role={role}>{trans.length === 0 ? <p className="text-muted-foreground">None in the open period.</p> : trans.map((e) => <p key={e.id}><b>{names.worker(e.workerId)}</b>: {e.transition}</p>)}</Card>
        <Card title="Schedule conflicts" href="schedule" role={role}><p><b>{open.length}</b> to resolve, {conflicts.length - open.length} acknowledged this week.</p></Card>
        <Card title="Expiring documents" href="reports" role={role}><p><StatusBadge tone="bad">{expired} expired</StatusBadge> <StatusBadge tone="warn">{soon} within 30 days</StatusBadge></p></Card>
        <Card title="Fuel anomalies" href="reports" role={role}>{anomalies.slice(0, 4).map((a) => <p key={a.id}>{names.plate(a.vehicleId)}: {a.detail}</p>)}{anomalies.length === 0 && <p className="text-muted-foreground">None.</p>}</Card>
        <Card title="Client invoice reconciliation" href="reports" role={role}>
          <p><StatusBadge tone="good">{rec.filter((r) => r.v === 0).length} matched</StatusBadge> <StatusBadge tone="bad">{rec.filter((r) => r.v !== null && r.v !== 0).length} with variance</StatusBadge> <StatusBadge tone="warn">{rec.filter((r) => r.v === null).length} not invoiced</StatusBadge></p>
          {rec.filter((r) => r.v !== null && r.v !== 0).map((r) => <p key={r.i.id}>{names.client(r.i.clientId)} {r.i.month}: {kd(r.v ?? 0)} KD</p>)}
        </Card>
      </div>
    </div>
  );
}

export function PayrollHome({ role }: ScreenProps) {
  const names = useNames();
  const per = periods.useAll(), ens = entries.useAll(), pl = plans.useAll();
  const sorted = [...per].sort((a, b) => b.month.localeCompare(a.month));
  const cur = sorted.find((p) => p.state === "open") ?? sorted.find((p) => p.state === "not_generated") ?? sorted[0];
  const es = ens.filter((e) => e.periodId === cur.id);
  const gross = es.reduce((a, e) => a + e.result.gross, 0), net = es.reduce((a, e) => a + e.result.net, 0);
  const trans = es.filter((e) => e.transition);
  const repaying = pl.filter((p) => planStatus(p) === "repaying"), dueNow = pl.filter((p) => planRemaining(p) > 0 && p.startMonth <= cur.month);
  const reopened = per.flatMap((p) => p.events.filter((e) => e.action === "Reopened").map((e) => ({ p, e })));
  return (
    <div className="space-y-5">
      <PageHeader title="Payroll Overview" description={monthLabel(cur.month)} />
      <KpiGrid>
        <KpiCard label="Period status" value={prettify(cur.state)} /><KpiCard label="Drivers in run" value={es.length} /><KpiCard label="In transition" value={trans.length} tone={trans.length ? "warn" : "default"} /><KpiCard label="Net (KD)" value={kd(net)} hint={`Gross ${kd(gross)}`} />
      </KpiGrid>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Drivers in transition" href="payroll" role={role}>{trans.length === 0 ? <p className="text-muted-foreground">None this period.</p> : trans.map((e) => <p key={e.id}><b>{names.worker(e.workerId)}</b>: {e.transition}</p>)}</Card>
        <Card title="Advances and instalments" href="advances" role={role}>
          <p>{repaying.length} advance/deduction plan(s) repaying; {dueNow.length} instalment(s) due, {kd(dueNow.reduce((a, p) => a + Math.min(p.instalment, planRemaining(p)), 0))} KD.</p>
          {dueNow.slice(0, 5).map((p) => <p key={p.id} className="text-muted-foreground">{names.worker(p.workerId)}: {kd(Math.min(p.instalment, planRemaining(p)))} KD ({p.description})</p>)}
        </Card>
        <Card title="Periods reopened" href="payroll" role={role}>{reopened.length === 0 ? <p className="text-muted-foreground">None.</p> : reopened.map(({ p, e }, i) => <p key={i}><b>{monthLabel(p.month)}</b>, {e.at}, {e.by}: {e.reason}</p>)}</Card>
        <Card title="Period history" href="payroll" role={role}>{sorted.map((p) => <p key={p.id}>{monthLabel(p.month)}: <StatusBadge tone={toneFor(p.state)}>{prettify(p.state)}</StatusBadge></p>)}</Card>
      </div>
    </div>
  );
}
