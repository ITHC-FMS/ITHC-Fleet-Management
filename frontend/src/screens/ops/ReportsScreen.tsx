"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Input, Select } from "@/components/app/fields";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { contracts, locations } from "@/data/core";
import { DOW } from "@/data/ops/dates";
import { fuelAnomalies, fuelStats } from "@/data/ops/fuel";
import { HOUSING_CAPACITY, attendance, marginRows, productivity, trends, utilisation, volume, type MarginRow, type Window } from "@/data/ops/reports";
import { clientRevenue } from "@/data/ops/revenue";
import { assignments, docExpiries, entries, fuelTx, invoices, orders, segments, shifts, workerExt } from "@/data/ops/store";
import { addDays, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../types";
import { useNames } from "./shared";

const kd = (n: number) => formatKD(n, { symbol: false });
const pct = (n: number) => `${n.toFixed(1)}%`;
const REPORTS = [
  { id: "prod", title: "Daily productivity" }, { id: "util", title: "Vehicle utilisation" }, { id: "fuel", title: "Fuel and anomalies" }, { id: "margin", title: "Margin" },
  { id: "housing", title: "Housing occupancy" }, { id: "att", title: "Attendance summary" }, { id: "docs", title: "Document expiry watchlist" }, { id: "inv", title: "Invoice reconciliation" },
  { id: "rank", title: "Driver rankings (P1)" }, { id: "trend", title: "Day-of-week and weekly trends (P1)" },
];
const Bar = ({ v, max, tone = "bg-sky-500" }: { v: number; max: number; tone?: string }) => <div className="h-3 w-full rounded bg-muted"><div className={cn("h-3 rounded", tone)} style={{ width: `${max ? Math.min(100, (v / max) * 100) : 0}%` }} /></div>;

export default function ReportsScreen({ readOnly, editedBy }: ScreenProps) {
  const names = useNames();
  const cons = contracts.useAll(), locs = locations.useAll();
  const ords = orders.useAll(), sh = shifts.useAll(), fu = fuelTx.useAll(), asg = assignments.useAll(), segs = segments.useAll(), ens = entries.useAll(), docs = docExpiries.useAll(), ext = workerExt.useAll(), invs = invoices.useAll();
  const [rep, setRep] = useState("prod");
  const [date, setDate] = useState(addDays(TODAY, -1));
  const [win, setWin] = useState<Window>("prev_day");
  const [month, setMonth] = useState("2026-10");
  const [groupBy, setGroupBy] = useState<"worker" | "client" | "vehicle" | "contract">("client");

  const prod = useMemo(() => productivity(ords, date, win), [ords, date, win]);
  const util = useMemo(() => utilisation(sh, names.vehicles, "2026-11-02", "2026-11-08"), [sh, names.vehicles]);
  const stats = useMemo(() => fuelStats(fu, names.vehicles), [fu, names.vehicles]);
  const anomalies = useMemo(() => fuelAnomalies(fu, names.vehicles), [fu, names.vehicles]);
  const margin = useMemo(() => marginRows({ workers: names.workers, orders: ords, contracts: cons, assignments: asg, segments: segs, vehicles: names.vehicles, locations: locs, entries: ens }, month), [names, ords, cons, asg, segs, locs, ens, month]);
  const att = useMemo(() => attendance(names.workers, asg, segs, month), [names.workers, asg, segs, month]);
  const tr = useMemo(() => trends(ords, addDays(TODAY, -1)), [ords]);
  const rev = (c: string, m: string) => clientRevenue(c, m, { orders: ords, contracts: cons, workers: names.workers, assignments: asg, segments: segs });

  const marginGrouped = useMemo(() => {
    const keyOf = (r: MarginRow) => (groupBy === "worker" ? r.workerId : groupBy === "client" ? r.clientId : groupBy === "vehicle" ? r.vehicleId : r.contractNo);
    const labelOf = (k: string) => (groupBy === "worker" ? names.worker(k) : groupBy === "client" ? names.client(k) : groupBy === "vehicle" ? (k === "none" ? "No vehicle" : names.plate(k)) : k);
    const m = new Map<string, { id: string; label: string; heads: number } & Omit<MarginRow, "id" | "workerId" | "clientId" | "contractNo" | "vehicleId">>();
    for (const r of margin) {
      const k = keyOf(r);
      const g = m.get(k) ?? { id: k, label: labelOf(k), heads: 0, revenue: 0, pay: 0, housing: 0, vehicleCost: 0, transport: 0, margin: 0 };
      g.heads++; g.revenue += r.revenue; g.pay += r.pay; g.housing += r.housing; g.vehicleCost += r.vehicleCost; g.transport += r.transport; g.margin += r.margin;
      m.set(k, g);
    }
    return [...m.values()];
  }, [margin, groupBy, names]);

  const monthPick = <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40" />;
  const T = <R extends { id: string }>(rows: R[], columns: Column<R>[], name: string, filters?: React.ReactNode, rowClassName?: (r: R) => string | undefined) => <DataTable rows={rows} columns={columns} exportName={name} filters={filters} rowClassName={rowClassName} pageSize={15} />;

  const body = () => {
    if (rep === "prod")
      return T(prod, [
        { key: "w", header: "Driver", value: (r) => names.worker(r.workerId) }, { key: "client", header: "Client", value: (r) => names.client(names.wById.get(r.workerId)?.currentClientId) },
        { key: "volume", header: "Orders / events", align: "end" }, { key: "base", header: "Comparison", align: "end", value: (r) => (r.base === null ? null : Math.round(r.base * 10) / 10) },
        { key: "delta", header: "Change", align: "end", value: (r) => (r.delta === null ? null : Math.round(r.delta * 10) / 10), cell: (r) => (r.delta === null ? "—" : <span className={r.delta < 0 ? "text-red-600" : "text-emerald-700"}>{r.delta > 0 ? "+" : ""}{r.delta.toFixed(1)}%</span>) },
      ], `productivity-${date}`, <><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" /><Select value={win} onChange={(e) => setWin(e.target.value as Window)} className="w-52"><option value="prev_day">vs previous day</option><option value="same_weekday">vs same weekday last week</option><option value="avg7">vs 7-day average</option></Select></>);
    if (rep === "util")
      return (<div className="space-y-4">
        <p className="text-sm text-muted-foreground">Week 2 to 8 Nov 2026: share of days each vehicle ran a shift.</p>
        {T(util.byOwnership, [{ key: "ownership", header: "Ownership type" }, { key: "vehicles", header: "Vehicles", align: "end" }, { key: "avgPct", header: "Avg utilisation", align: "end", cell: (r) => pct(r.avgPct), value: (r) => Math.round(r.avgPct) }, { key: "avgCost", header: "Avg monthly cost (KD)", align: "end", cell: (r) => kd(r.avgCost), value: (r) => r.avgCost }], "utilisation-by-ownership")}
        {T(util.rows, [{ key: "plate", header: "Vehicle", value: (r) => r.vehicle.plate }, { key: "type", header: "Type", value: (r) => r.vehicle.type }, { key: "own", header: "Ownership", value: (r) => r.vehicle.ownership }, { key: "days", header: "Days used", align: "end", value: (r) => r.daysUsed }, { key: "hours", header: "Planned hours", align: "end", value: (r) => r.hours }, { key: "pct", header: "Utilisation", align: "end", value: (r) => Math.round(r.pct), cell: (r) => <div className="flex items-center gap-2"><Bar v={r.pct} max={100} />{pct(r.pct)}</div> }], "utilisation-by-vehicle")}
      </div>);
    if (rep === "fuel")
      return (<div className="space-y-4">
        <div className="rounded-lg border bg-card p-3"><p className="mb-2 text-sm font-semibold">Anomalies ({anomalies.length})</p>{anomalies.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : anomalies.map((a) => <p key={a.id} className="text-sm"><StatusBadge tone="bad">{a.kind.replace(/_/g, " ")}</StatusBadge> <b>{names.plate(a.vehicleId)}</b> {a.date && fmtDate(a.date)} {a.detail}</p>)}</div>
        {T(stats.map((x) => ({ ...x, id: x.vehicleId })), [{ key: "v", header: "Vehicle", value: (r) => names.plate(r.vehicleId) }, { key: "fills", header: "Fills", align: "end" }, { key: "litres", header: "Litres", align: "end", value: (r) => Math.round(r.litres) }, { key: "cost", header: "Cost (KD)", align: "end", value: (r) => r.cost, cell: (r) => kd(r.cost) }, { key: "km", header: "Km", align: "end" }, { key: "l100", header: "L/100km", align: "end", value: (r) => (r.lPer100 === null ? null : Math.round(r.lPer100 * 10) / 10) }, { key: "flag", header: "Flag", value: (r) => (anomalies.some((a) => a.vehicleId === r.vehicleId) ? "anomaly" : ""), cell: (r) => (anomalies.some((a) => a.vehicleId === r.vehicleId) ? <StatusBadge tone="bad">Anomaly</StatusBadge> : null) }], "fuel-consumption")}
      </div>);
    if (rep === "margin")
      return T(marginGrouped, [{ key: "label", header: groupBy[0].toUpperCase() + groupBy.slice(1) }, { key: "heads", header: "Heads", align: "end" }, { key: "revenue", header: "Revenue", align: "end", cell: (r) => kd(r.revenue) }, { key: "pay", header: "Pay cost", align: "end", cell: (r) => kd(r.pay) }, { key: "housing", header: "Housing / head", align: "end", cell: (r) => kd(r.housing) }, { key: "vehicleCost", header: "Vehicle", align: "end", cell: (r) => kd(r.vehicleCost) }, { key: "transport", header: "Transport / head", align: "end", cell: (r) => kd(r.transport) }, { key: "margin", header: "Margin (KD)", align: "end", cell: (r) => <b className={r.margin < 0 ? "text-red-600" : ""}>{kd(r.margin)}</b> }], `margin-by-${groupBy}-${month}`, <>{monthPick}<Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)} className="w-36"><option value="worker">Per worker</option><option value="client">Per client</option><option value="vehicle">Per vehicle</option><option value="contract">Per contract</option></Select></>, (r) => (r.margin < 0 ? "bg-red-50" : undefined));
    if (rep === "housing") {
      const rows = locs.filter((l) => l.kind === "housing").map((l) => { const occ = names.workers.filter((w) => w.housingLocationId === l.id && !["terminated", "absconded"].includes(w.status)); const cap = HOUSING_CAPACITY[l.id] ?? 20; return { id: l.id, name: l.name, cap, occ: occ.length, vac: cap - occ.length, who: occ.map((w) => w.name).join(", ") }; });
      return T(rows, [{ key: "name", header: "Property" }, { key: "cap", header: "Capacity", align: "end" }, { key: "occ", header: "Occupied", align: "end" }, { key: "vac", header: "Vacant", align: "end", cell: (r) => <span className={r.vac < 0 ? "font-semibold text-red-600" : ""}>{r.vac}</span> }, { key: "who", header: "Who lives here", className: "max-w-xl whitespace-normal text-xs" }], "housing-occupancy");
    }
    if (rep === "att")
      return T(att, [{ key: "client", header: "Client", value: (r) => names.client(r.clientId) }, { key: "site", header: "Placement site" }, { key: "heads", header: "Workers", align: "end" }, { key: "present", header: "Present days", align: "end" }, { key: "leave", header: "Leave days", align: "end" }, { key: "unpaid", header: "Unpaid days", align: "end" }, { key: "pct", header: "Attendance", align: "end", value: (r) => Math.round(r.pct), cell: (r) => pct(r.pct) }], `attendance-${month}`, monthPick);
    if (rep === "docs") {
      const rows = [...docs.map((d) => ({ id: d.id, workerId: d.workerId, type: d.type.replace(/_/g, " "), expires: d.expires })), ...ext.filter((e) => e.contractEnd).map((e) => ({ id: `c-${e.id}`, workerId: e.id, type: "contract", expires: e.contractEnd! }))].filter((r) => r.expires < addDays(TODAY, 60)).map((r) => ({ ...r, tier: r.expires < TODAY ? "expired" : r.expires <= addDays(TODAY, 30) ? "within 30 days" : "within 60 days" })).sort((a, b) => a.expires.localeCompare(b.expires));
      return T(rows, [{ key: "w", header: "Worker", value: (r) => names.worker(r.workerId) }, { key: "type", header: "Document" }, { key: "expires", header: "Expires", cell: (r) => fmtDate(r.expires) }, { key: "tier", header: "Tier", cell: (r) => <StatusBadge tone={r.tier === "expired" ? "bad" : r.tier === "within 30 days" ? "warn" : "info"}>{r.tier}</StatusBadge> }], "compliance-watchlist");
    }
    if (rep === "inv") {
      const rows = invs.map((i) => { const c = rev(i.clientId, i.month); const v = i.invoiced === null ? null : i.invoiced - c; return { ...i, computed: c, variance: v }; });
      return T(rows, [{ key: "client", header: "Client", value: (r) => names.client(r.clientId) }, { key: "month", header: "Month" }, { key: "computed", header: "Computed revenue", align: "end", cell: (r) => kd(r.computed) }, { key: "invoiced", header: "Invoiced", align: "end", cell: (r) => (r.invoiced === null ? "Not issued" : kd(r.invoiced)) }, { key: "variance", header: "Variance", align: "end", value: (r) => r.variance, cell: (r) => (r.variance === null ? "—" : <span className={r.variance !== 0 ? "font-semibold text-red-600" : ""}>{kd(r.variance)}</span>) }, { key: "status", header: "Status", value: (r) => (r.variance === null ? "to invoice" : r.variance === 0 ? "matched" : "variance"), cell: (r) => <StatusBadge tone={r.variance === null ? "warn" : r.variance === 0 ? "good" : "bad"}>{r.variance === null ? "To invoice" : r.variance === 0 ? "Matched" : "Variance"}</StatusBadge> }], "invoice-reconciliation");
    }
    if (rep === "rank") {
      const m = new Map<string, { id: string; vol: number; days: number }>();
      for (const o of ords) if (o.date.startsWith(month)) { const r = m.get(o.workerId) ?? { id: o.workerId, vol: 0, days: 0 }; r.vol += volume(o); r.days++; m.set(o.workerId, r); }
      const rows = [...m.values()].sort((a, b) => b.vol - a.vol).map((r, i) => ({ ...r, rank: i + 1, avg: r.vol / r.days }));
      return T(rows, [{ key: "rank", header: "#", align: "end" }, { key: "w", header: "Driver", value: (r) => names.worker(r.id) }, { key: "vol", header: "Total orders / events", align: "end" }, { key: "days", header: "Days worked", align: "end" }, { key: "avg", header: "Avg per day", align: "end", value: (r) => Math.round(r.avg * 10) / 10 }], `driver-rankings-${month}`, monthPick);
    }
    const max = Math.max(1, ...tr.dow, ...tr.weeks.map((w) => w.total));
    return (<div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2 rounded-lg border bg-card p-4"><p className="text-sm font-semibold">Average daily volume by weekday (last 8 weeks)</p>{tr.dow.map((v, i) => <div key={i} className="flex items-center gap-2 text-sm"><span className="w-10">{DOW[i]}</span><Bar v={v} max={Math.max(...tr.dow, 1)} /><span className="w-16 text-end tabular-nums">{Math.round(v)}</span></div>)}</div>
      <div className="space-y-2 rounded-lg border bg-card p-4"><p className="text-sm font-semibold">Week over week total volume</p>{tr.weeks.map((w, i) => { const prev = tr.weeks[i - 1]?.total; return <div key={w.from} className="flex items-center gap-2 text-sm"><span className="w-24 text-xs">{w.from.slice(5)}..{w.to.slice(5)}</span><Bar v={w.total} max={max} tone="bg-emerald-500" /><span className="w-16 text-end tabular-nums">{w.total}</span><span className={cn("w-16 text-end text-xs", prev && w.total < prev ? "text-red-600" : "text-emerald-700")}>{prev ? `${(((w.total - prev) / prev) * 100).toFixed(1)}%` : ""}</span></div>; })}</div>
    </div>);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Every report exports to CSV from its table toolbar." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <div className="flex flex-wrap gap-1.5">{REPORTS.map((r) => <button key={r.id} type="button" onClick={() => setRep(r.id)} className={cn("rounded-md border px-3 py-1.5 text-sm", rep === r.id ? "bg-foreground text-background" : "hover:bg-muted")}>{r.title}</button>)}</div>
      {body()}
    </div>
  );
}
