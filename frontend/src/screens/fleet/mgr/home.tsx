"use client";

import { useMemo } from "react";
import Link from "next/link";
import { vehicles as vehiclesCol } from "@/data/core";
import { docState, fuelAnomalies, fuelTxns, handoverEvents, incidents, serviceJobs, transportRoutes, utilisation, vehicleAssignments, vehicleDocs } from "@/data/fleet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { useClock } from "../_shared/hooks";
import { Section } from "../_shared/ui";

const L = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href} className="text-sm underline underline-offset-2">{children}</Link>;

export default function FleetHome(_: ScreenProps) {
  void _;
  const now = useClock();
  const vehicles = vehiclesCol.useAll();
  const incs = incidents.useAll();
  const jobs = serviceJobs.useAll();
  const fuel = fuelTxns.useAll();
  const docs = vehicleDocs.useAll();
  const events = handoverEvents.useAll();
  const assignments = vehicleAssignments.useAll();
  const routes = transportRoutes.useAll();
  const v = (id?: string) => vehicles.find((x) => x.id === id);

  const anomalies = useMemo(() => fuelAnomalies(fuel, vehicles), [fuel, vehicles]);
  const util = useMemo(() => utilisation(vehicles, events, assignments, routes, now), [vehicles, events, assignments, routes, now]);
  const byOwn = ["cash", "rented", "financed"].map((o) => {
    const r = util.filter((x) => x.vehicle.ownership === o);
    const used = r.reduce((s, x) => s + x.used, 0), avail = r.reduce((s, x) => s + x.available, 0);
    return { o, n: r.length, pct: avail ? (used / avail) * 100 : 0 };
  }).filter((x) => x.n);

  const open = jobs.filter((j) => j.status !== "returned").sort((a, b) => (a.expectedReturn < b.expectedReturn ? -1 : 1));
  const incoming = incs.filter((i) => i.status === "routed" || i.status === "received");
  const replacements = incs.filter((i) => i.replacementVehicleId);
  const expiring = docs.filter((d) => d.status === "current" && ["expired", "expiring"].includes(docState(d))).sort((a, b) => (a.expires < b.expires ? -1 : 1));
  const count = (s: string) => vehicles.filter((x) => x.status === s).length;
  const openCost = open.reduce((s, j) => s + j.costFils, 0);
  const unreviewed = [...anomalies.keys()].filter((id) => !fuel.find((f) => f.id === id)?.reviewNote);

  return (
    <div className="space-y-4">
      <PageHeader title="Fleet overview" description="Vehicle status, service work and daily operations." />
      <KpiGrid>
        <KpiCard label="In service" value={count("in_service")} tone="good" />
        <KpiCard label="Under repair" value={count("under_repair")} tone="warn" />
        <KpiCard label="Off fleet" value={count("off_fleet")} />
        <KpiCard label="Fuel anomalies" value={unreviewed.length} tone={unreviewed.length ? "bad" : "good"} hint="Unreviewed" />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Incoming damaged vehicles" right={<L href="/fleet/damaged">Open</L>}>
          {incoming.length === 0 ? <p className="text-sm text-muted-foreground">None waiting.</p> : incoming.map((i) => <p key={i.id} className="flex justify-between text-sm"><span>{v(i.vehicleId)?.plate} · {i.description.slice(0, 50)}</span><StatusBadge tone={i.status === "routed" ? "bad" : "warn"}>{i.status}</StatusBadge></p>)}
        </Section>
        <Section title={`Open service jobs (${open.length}) · ${formatKD(openCost)}`} right={<L href="/fleet/jobs">Open</L>}>
          {open.map((j) => <p key={j.id} className="flex justify-between text-sm"><span>{v(j.vehicleId)?.plate} · {j.work.slice(0, 36)}</span><span className={j.expectedReturn < TODAY && j.status === "open" ? "text-red-700" : ""}>{j.status === "completed" ? "ready to return" : `back ${fmtDate(j.expectedReturn)} · ${formatKD(j.costFils, { symbol: false })}`}</span></p>)}
          {open.length === 0 && <p className="text-sm text-muted-foreground">No open jobs.</p>}
        </Section>
        <Section title={`Replacement vehicles issued (${replacements.length})`} right={<L href="/fleet/inspections">Incidents</L>}>
          {replacements.slice(-6).reverse().map((i) => <p key={i.id} className="text-sm">{v(i.vehicleId)?.plate} replaced by <b>{v(i.replacementVehicleId)?.plate}</b> <span className="text-muted-foreground">({i.id})</span></p>)}
        </Section>
        <Section title="Vehicle documents expiring or expired" right={<L href="/fleet/documents">Open</L>}>
          {expiring.slice(0, 6).map((d) => <p key={d.id} className="flex justify-between text-sm"><span>{v(d.vehicleId)?.plate} · {prettify(d.type)}</span><StatusBadge tone={docState(d) === "expired" ? "bad" : "warn"}>{docState(d) === "expired" ? `expired ${-daysBetween(TODAY, d.expires)} d ago` : `${daysBetween(TODAY, d.expires)} d left`}</StatusBadge></p>)}
          {expiring.length === 0 && <p className="text-sm text-muted-foreground">Nothing expiring within 30 days.</p>}
        </Section>
        <Section title="Fuel anomalies" right={<L href="/fleet/fuel">Open</L>}>
          {unreviewed.slice(0, 5).map((id) => { const f = fuel.find((x) => x.id === id)!; return <p key={id} className="text-sm">{v(f.vehicleId)?.plate} · {fmtDate(f.date)} · {anomalies.get(id)![0]}</p>; })}
          {unreviewed.length === 0 && <p className="text-sm text-muted-foreground">No unreviewed anomalies.</p>}
        </Section>
        <Section title="Utilisation by ownership type" right={<L href="/fleet/utilisation">Open</L>}>
          {byOwn.map((x) => (
            <div key={x.o} className="space-y-1 text-sm"><div className="flex justify-between"><span>{prettify(x.o)} ({x.n})</span><span className="tabular-nums">{x.pct.toFixed(1)}%</span></div><div className="h-2 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, x.pct)}%` }} /></div></div>
          ))}
        </Section>
      </div>
    </div>
  );
}
