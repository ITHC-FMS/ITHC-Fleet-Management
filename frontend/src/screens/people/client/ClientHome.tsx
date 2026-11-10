"use client";

import Link from "next/link";
import { useMemo } from "react";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { clients, contracts, workers } from "@/data/core";
import { benchRecords, leases, occupancy, opportunities, placements, seatRequirements, useSettings } from "@/data/people";
import { benchEligible, dailyCarry, fmtX, gateOf, housingCostPerHead, isDeployed, isLabour, multipleX100, placementActive, seatRows } from "@/data/people/calc";
import { addDays, daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { Notice, Section } from "../common";

export default function ClientHome({ readOnly, editedBy }: ScreenProps) {
  const cons = contracts.useAll();
  const clientList = clients.useAll();
  const ws = workers.useAll();
  const plc = placements.useAll();
  const reqs = seatRequirements.useAll();
  const opps = opportunities.useAll();
  const recs = benchRecords.useAll();
  const occ = occupancy.useAll();
  const ls = leases.useAll();
  const settings = useSettings();
  const cname = (id: string) => clientList.find((c) => c.id === id)?.name ?? id;

  const seats = useMemo(() => seatRows({ contracts: cons, reqs, placements: plc, workers: ws, settings }), [cons, reqs, plc, ws, settings]);
  const contracted = seats.reduce((a, r) => a + r.contracted, 0);
  const filled = seats.reduce((a, r) => a + Math.min(r.filled, r.contracted), 0);
  const fillPct = contracted ? (filled / contracted) * 100 : 0;
  const housing = useMemo(() => housingCostPerHead(occ, ls), [occ, ls]);

  const elig = ws.filter(benchEligible);
  const deployed = elig.filter((w) => isDeployed(w, plc));
  const bench = elig.filter((w) => !isDeployed(w, plc));
  const benchPct = deployed.length ? (bench.length / deployed.length) * 100 : 0;
  const benchDaily = bench.reduce((a, w) => a + dailyCarry({ worker: w, housingPerHead: housing.byWorker.get(w.id) ?? 0, settings }), 0);

  const open = opps.filter((o) => o.stage !== "lost" && o.stage !== "signed");
  const gateAlerts = open.filter((o) => gateOf(o, settings) !== "ok" && o.approval !== "approved");
  const stages = ["lead", "proposal", "negotiation", "signed"] as const;

  const horizon = addDays(TODAY, 365);
  const renewals = cons.filter((c) => c.status === "active" && c.validTo && c.validTo >= TODAY && c.validTo <= horizon).sort((a, b) => a.validTo!.localeCompare(b.validTo!));

  // Loss-making heads: estimated contribution = revenue share - carrying cost (bench heads earn nothing).
  const loss = useMemo(() => {
    const out: { id: string; name: string; client: string; monthly: number; days: number }[] = [];
    for (const w of elig) {
      const h = housing.byWorker.get(w.id) ?? 0;
      const cost = dailyCarry({ worker: w, housingPerHead: h, settings }) * 30;
      const p = plc.find((x) => x.workerId === w.id && placementActive(x));
      if (!isDeployed(w, plc)) {
        const rec = recs.find((r) => r.workerId === w.id);
        const ended = plc.filter((x) => x.workerId === w.id && x.to).sort((a, b) => b.to!.localeCompare(a.to!))[0];
        const since = rec?.since ?? (ended ? addDays(ended.to!, 1) : w.joiningDate);
        out.push({ id: w.id, name: w.name, client: "Bench", monthly: -cost, days: daysBetween(since, TODAY) });
      } else if (p) {
        const c = cons.find((x) => x.id === p.contractId);
        if (!c || !isLabour(c)) continue;
        const rate = c.rates[0]?.amount ?? 0;
        const revenue = c.pricingModel === "hourly" ? rate * 208 : rate;
        if (revenue - cost < 0) out.push({ id: w.id, name: w.name, client: cname(c.clientId), monthly: revenue - cost, days: daysBetween(p.from, TODAY) });
      }
    }
    return out.sort((a, b) => a.monthly - b.monthly);
  }, [elig, housing, settings, plc, recs, cons]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <PageHeader title="Deployment Dashboard" description="Seat-fill, bench and pipeline at a glance." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Seat-fill" value={`${fillPct.toFixed(1)}%`} tone={fillPct >= settings.seatTargetPct ? "good" : "warn"} hint={`Target ${settings.seatTargetPct}%`} />
        <KpiCard label="Bench %" value={`${benchPct.toFixed(1)}%`} tone={benchPct >= settings.benchMinPct && benchPct <= settings.benchMaxPct ? "good" : "warn"} hint={`${bench.length} on bench, target ${settings.benchMinPct}–${settings.benchMaxPct}%`} />
        <KpiCard label="Open seats" value={seats.reduce((a, r) => a + r.gap, 0)} />
        <KpiCard label="Gate alerts" value={gateAlerts.length} tone={gateAlerts.length ? "bad" : "good"} />
      </KpiGrid>

      <Section title="Seat-fill per contract" actions={<Link href="/client/seat-fill" className="text-sm underline">Details</Link>}>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-start">Contract</th><th className="px-3 py-2 text-end">Contracted</th><th className="px-3 py-2 text-end">Filled</th><th className="px-3 py-2 text-end">Gap</th><th className="px-3 py-2 text-end">Fill</th><th className="px-3 py-2 text-end">Minimum</th><th className="px-3 py-2 text-start">Status</th></tr></thead>
            <tbody>{seats.map((r) => (
              <tr key={r.contract.id} className="border-t">
                <td className="px-3 py-1.5">{r.contract.contractNo} <span className="text-xs text-muted-foreground">{cname(r.contract.clientId)}</span></td>
                <td className="px-3 py-1.5 text-end">{r.contracted}</td><td className="px-3 py-1.5 text-end">{r.filled}</td><td className="px-3 py-1.5 text-end">{r.gap}</td>
                <td className="px-3 py-1.5 text-end">{r.pct.toFixed(1)}%</td><td className="px-3 py-1.5 text-end">{r.floor}</td>
                <td className="px-3 py-1.5">{r.state === "below_minimum" ? <StatusBadge tone="bad">Below client minimum</StatusBadge> : r.state === "below_target" ? <StatusBadge tone="warn">Below target</StatusBadge> : <StatusBadge tone="good">On target</StatusBadge>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Bench size and cost" actions={<Link href="/client/bench" className="text-sm underline">Bench</Link>}>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="On bench" value={bench.length} hint={`${deployed.length} deployed`} />
            <KpiCard label="Daily carrying cost" value={formatKD(benchDaily)} hint={`${formatKD(benchDaily * 30)} per month`} />
          </div>
        </Section>
        <Section title="Pipeline in seats" actions={<Link href="/client/pipeline" className="text-sm underline">Pipeline</Link>}>
          <table className="w-full text-sm">
            <thead><tr className="text-muted-foreground"><th className="text-start">Stage</th><th className="text-end">Opportunities</th><th className="text-end">Heads</th><th className="text-end">Monthly revenue</th></tr></thead>
            <tbody>{stages.map((s) => { const l = opps.filter((o) => o.stage === s); return <tr key={s} className="border-t"><td className="py-1">{prettify(s)}</td><td className="text-end">{l.length}</td><td className="text-end">{l.reduce((a, o) => a + o.heads, 0)}</td><td className="text-end">{formatKD(l.reduce((a, o) => a + o.heads * o.revenuePerHead, 0), { symbol: false })}</td></tr>; })}</tbody>
          </table>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Contract economics gate alerts">
          {gateAlerts.length === 0 && <p className="text-sm text-muted-foreground">No opportunities waiting on approval.</p>}
          <ul className="space-y-1 text-sm">{gateAlerts.map((o) => <li key={o.id} className="flex justify-between rounded border px-3 py-1.5"><span>{o.clientId ? cname(o.clientId) : o.prospectName} <span className="text-xs text-muted-foreground">{o.heads} heads</span></span><StatusBadge tone={gateOf(o, settings) === "escalate" ? "bad" : "warn"}>{fmtX(multipleX100(o))}{gateOf(o, settings) === "escalate" ? " escalate weekly" : " needs approval"}</StatusBadge></li>)}</ul>
        </Section>
        <Section title="Renewal calendar, next 12 months" actions={<Link href="/client/renewals" className="text-sm underline">Calendar</Link>}>
          <ul className="space-y-1 text-sm">
            {renewals.length === 0 && <li className="text-muted-foreground">No fixed-term contracts ending.</li>}
            {renewals.map((c) => <li key={c.id} className="flex justify-between rounded border px-3 py-1.5"><span>{c.contractNo} <span className="text-xs text-muted-foreground">{cname(c.clientId)}</span></span><span>{fmtDate(c.validTo)} ({daysBetween(TODAY, c.validTo!)}d)</span></li>)}
          </ul>
        </Section>
      </div>

      <Section title="Loss-making workers (estimate)">
        <Notice>Estimated from placement revenue against the carrying cost used on the Bench page; bench heads earn nothing. The authoritative list is the margin-per-worker report.</Notice>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-start">Worker</th><th className="px-3 py-2 text-start">Client</th><th className="px-3 py-2 text-end">Monthly contribution (KD)</th><th className="px-3 py-2 text-end">Days in state</th></tr></thead>
            <tbody>{loss.slice(0, 10).map((l) => <tr key={l.id} className="border-t"><td className="px-3 py-1.5">{l.name}</td><td className="px-3 py-1.5">{l.client}</td><td className="px-3 py-1.5 text-end text-red-600">{formatKD(l.monthly, { symbol: false })}</td><td className="px-3 py-1.5 text-end">{l.days}</td></tr>)}
              {loss.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No loss-making workers.</td></tr>}</tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
