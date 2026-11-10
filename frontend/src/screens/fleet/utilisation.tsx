"use client";

import { useMemo, useState } from "react";
import { locations as locationsCol, vehicles as vehiclesCol } from "@/data/core";
import {
  AVAIL_PER_DAY, capitalOf, costSchedules, DESK_BUILDING, fuelAnomalies, fuelTxns, handoverEvents, holdingMonthly, peakConcurrent, transportRoutes,
  utilisation, vehicleAssignments, WINDOW_DAYS, type UtilRow,
} from "@/data/fleet";
import { DataTable, type Column } from "@/components/app/data-table";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { useClock } from "./_shared/hooks";

const TARGET = 10;
const BUFFER = 1.1;
const pct = (n: number) => `${n.toFixed(1)}%`;

interface Group { id: string; label: string; vehicles: number; used: number; available: number; pct: number; idle: number }
const group = (rows: UtilRow[], key: (r: UtilRow) => string, label: (k: string) => string): Group[] => {
  const m = new Map<string, UtilRow[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return [...m.entries()].map(([k, rs]) => {
    const used = rs.reduce((s, r) => s + r.used, 0), available = rs.reduce((s, r) => s + r.available, 0);
    return { id: k, label: label(k), vehicles: rs.length, used, available, pct: available ? (used / available) * 100 : 0, idle: rs.filter((r) => r.pct < 10).length };
  });
};

export default function UtilisationScreen(_: ScreenProps) {
  void _;
  const now = useClock();
  const vehicles = vehiclesCol.useAll();
  const locs = locationsCol.useAll();
  const events = handoverEvents.useAll();
  const assignments = vehicleAssignments.useAll();
  const routes = transportRoutes.useAll();
  const sched = costSchedules.useAll();
  const fuel = fuelTxns.useAll();
  const [remove, setRemove] = useState(5);

  const rows = useMemo(() => utilisation(vehicles, events, assignments, routes, now), [vehicles, events, assignments, routes, now]);
  const anomalies = useMemo(() => fuelAnomalies(fuel, vehicles), [fuel, vehicles]);
  const locName = (id: string) => locs.find((l) => l.id === id)?.name ?? id;
  const total = group(rows, () => "all", () => "All");
  const overall = total[0];
  const buildingOf = (desk: string) => DESK_BUILDING[desk] ?? desk;

  const byDesk = group(rows, (r) => r.desk, locName);
  const byLoc = group(rows, (r) => buildingOf(r.desk), locName);
  const byOwn = group(rows, (r) => r.vehicle.ownership, (k) => prettify(k));

  // fleet sizing: pooled cars per desk against peak simultaneous demand
  const sizing = useMemo(() => {
    const desks = [...new Set(rows.filter((r) => r.vehicle.mode === "pooled").map((r) => r.desk))];
    return desks.map((d) => {
      const pool = rows.filter((r) => r.vehicle.mode === "pooled" && r.desk === d && r.vehicle.status === "in_service");
      const peak = peakConcurrent(events, new Set(pool.map((r) => r.vehicle.id)), now);
      const needed = Math.ceil(peak * BUFFER);
      const surplus = Math.max(0, pool.length - needed);
      const candidates = [...pool].sort((a, b) => a.pct - b.pct).slice(0, surplus);
      return { desk: d, pool: pool.length, peak, needed, surplus, candidates, all: pool };
    });
  }, [rows, events, now]);
  const surplusTotal = sizing.reduce((s, x) => s + x.surplus, 0);
  const cand = sizing.flatMap((x) => x.candidates);
  const monthly = (r: UtilRow) => holdingMonthly(sched.find((s) => s.id === r.vehicle.id), r.vehicle.ownership, r.vehicle.monthlyCost);
  const saveMonthly = cand.reduce((s, r) => s + monthly(r), 0);
  const capital = cand.reduce((s, r) => s + capitalOf(sched.find((x) => x.id === r.vehicle.id)), 0);
  const pooledAll = rows.filter((r) => r.vehicle.mode === "pooled" && r.vehicle.status === "in_service");
  const pooledUsed = pooledAll.reduce((s, r) => s + r.used, 0), pooledAvail = pooledAll.reduce((s, r) => s + r.available, 0);
  const peakAll = sizing.reduce((s, x) => s + x.peak, 0);
  const afterN = Math.max(1, pooledAll.length - remove);
  const whatIfPct = (pooledUsed / ((pooledAvail / Math.max(1, pooledAll.length)) * afterN)) * 100;
  const shortfall = Math.max(0, peakAll - afterN);
  const cheapest = [...pooledAll].sort((a, b) => a.pct - b.pct).slice(0, remove);

  const cols: Column<UtilRow & { id: string }>[] = [
    { key: "plate", header: "Vehicle", value: (r) => r.vehicle.plate, cell: (r) => <span className="font-medium">{r.vehicle.plate}</span> },
    { key: "own", header: "Ownership", value: (r) => r.vehicle.ownership, cell: (r) => prettify(r.vehicle.ownership) },
    { key: "mode", header: "Mode", value: (r) => r.vehicle.mode },
    { key: "desk", header: "Desk", value: (r) => locName(r.desk) },
    { key: "used", header: "Used hrs", align: "end", value: (r) => r.used, cell: (r) => r.used.toFixed(0) },
    { key: "avail", header: "Available hrs", align: "end", value: (r) => r.available, cell: (r) => r.available.toFixed(0) },
    { key: "pct", header: "Utilisation %", align: "end", value: (r) => r.pct, cell: (r) => <span className={r.pct < 10 ? "font-medium text-red-700" : r.pct < 35 ? "text-amber-700" : ""}>{pct(r.pct)}</span> },
    { key: "fuel", header: "Fuel flags", align: "end", value: (r) => fuel.filter((f) => f.vehicleId === r.vehicle.id && anomalies.has(f.id)).length, cell: (r) => { const n = fuel.filter((f) => f.vehicleId === r.vehicle.id && anomalies.has(f.id)).length; return n ? <StatusBadge tone="bad">{n}</StatusBadge> : "—"; } },
  ];
  const gCols: Column<Group>[] = [
    { key: "label", header: "Group", value: (g) => g.label },
    { key: "veh", header: "Vehicles", align: "end", value: (g) => g.vehicles },
    { key: "used", header: "Used hrs", align: "end", value: (g) => g.used, cell: (g) => g.used.toFixed(0) },
    { key: "avail", header: "Available hrs", align: "end", value: (g) => g.available, cell: (g) => g.available.toFixed(0) },
    { key: "pct", header: "Utilisation %", align: "end", value: (g) => g.pct, cell: (g) => pct(g.pct) },
    { key: "idle", header: "Idle vehicles (<10%)", align: "end", value: (g) => g.idle },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Vehicle utilisation" description={`Hours in productive use versus available over the last ${WINDOW_DAYS} days. Pooled cars: out between issue and return. Dedicated bikes: assigned days × average daily hours. Available: ${AVAIL_PER_DAY.pooled} h/day pooled, ${AVAIL_PER_DAY.dedicated} h/day dedicated.`} />
      <KpiGrid>
        <KpiCard label="Fleet utilisation" value={pct(overall?.pct ?? 0)} hint={`${(overall?.used ?? 0).toFixed(0)} of ${(overall?.available ?? 0).toFixed(0)} hours`} />
        <KpiCard label="Idle vehicles (<10%)" value={rows.filter((r) => r.pct < 10).length} tone="warn" />
        <KpiCard label="Fuel anomalies" value={[...anomalies.keys()].filter((id) => !fuel.find((f) => f.id === id)?.reviewNote).length} tone="bad" hint="Unreviewed" />
        <KpiCard label="Vehicles that could be avoided" value={`${surplusTotal} of ${TARGET}`} tone={surplusTotal >= TARGET ? "good" : "warn"} hint="Measured against peak demand" />
      </KpiGrid>
      <Tabs tabs={[
        { id: "sizing", label: "Fewer vehicles needed", content: (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Target: {TARGET} fewer vehicles</p><StatusBadge tone={surplusTotal >= TARGET ? "good" : "warn"}>{surplusTotal} identified</StatusBadge></div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, (surplusTotal / TARGET) * 100)}%` }} /></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Monthly cost avoided</p><p className="text-xl font-semibold tabular-nums">{formatKD(saveMonthly)}</p></div>
                <div><p className="text-xs text-muted-foreground">Capital avoided (purchase price)</p><p className="text-xl font-semibold tabular-nums">{formatKD(capital)}</p></div>
                <div><p className="text-xs text-muted-foreground">Annual cost avoided</p><p className="text-xl font-semibold tabular-nums">{formatKD(saveMonthly * 12)}</p></div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">A desk needs its peak simultaneous demand plus a {Math.round((BUFFER - 1) * 100)}% buffer. Pooled cars above that are surplus; the least-used are listed as the ones to avoid. The demo fleet is a sample; the {TARGET}-vehicle target applies to the full fleet.</p>
            </div>
            <DataTable rows={sizing.map((s) => ({ ...s, id: s.desk }))} columns={[
              { key: "d", header: "Desk", value: (s) => locName(s.desk) },
              { key: "p", header: "Pooled cars in service", align: "end", value: (s) => s.pool },
              { key: "k", header: "Peak out at once", align: "end", value: (s) => s.peak },
              { key: "n", header: `Needed (+${Math.round((BUFFER - 1) * 100)}%)`, align: "end", value: (s) => s.needed },
              { key: "s", header: "Surplus", align: "end", value: (s) => s.surplus, cell: (s) => <b className={s.surplus ? "text-emerald-700" : ""}>{s.surplus}</b> },
              { key: "c", header: "Cars to avoid", value: (s) => s.candidates.map((c) => c.vehicle.plate).join(", "), cell: (s) => s.candidates.map((c) => `${c.vehicle.plate} (${pct(c.pct)})`).join(", ") || "—" },
            ]} exportName="fleet-sizing" />
            <div className="space-y-2 rounded-lg border p-4">
              <p className="font-medium">What if we remove N pooled cars?</p>
              <div className="flex items-center gap-3"><input type="range" min={0} max={Math.min(TARGET, pooledAll.length - 1)} value={remove} onChange={(e) => setRemove(Number(e.target.value))} className="w-64" /><b className="tabular-nums">{remove}</b></div>
              <p className="text-sm">Pooled utilisation goes from <b>{pct(pooledAvail ? (pooledUsed / pooledAvail) * 100 : 0)}</b> to <b>{pct(whatIfPct)}</b>. Monthly cost avoided: <b>{formatKD(cheapest.reduce((s, r) => s + monthly(r), 0))}</b>; capital avoided: <b>{formatKD(cheapest.reduce((s, r) => s + capitalOf(sched.find((x) => x.id === r.vehicle.id)), 0))}</b>.</p>
              {shortfall > 0 ? <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">Not safe: at the busiest moment {peakAll} cars were out at once but only {afterN} would remain (short by {shortfall}).</p> : <p className="rounded-md bg-emerald-100 p-2 text-sm text-emerald-800">Covers the busiest moment ({peakAll} cars out at once across desks).</p>}
            </div>
          </div>
        ) },
        { id: "veh", label: "By vehicle", content: <DataTable rows={rows.map((r) => ({ ...r, id: r.vehicle.id }))} columns={cols} exportName="utilisation-by-vehicle" /> },
        { id: "desk", label: "By desk", content: <DataTable rows={byDesk} columns={gCols} exportName="utilisation-by-desk" /> },
        { id: "loc", label: "By location", content: <DataTable rows={byLoc} columns={gCols} exportName="utilisation-by-location" /> },
        { id: "own", label: "By ownership type", content: <DataTable rows={byOwn} columns={gCols} exportName="utilisation-by-ownership" /> },
      ]} />
    </div>
  );
}
