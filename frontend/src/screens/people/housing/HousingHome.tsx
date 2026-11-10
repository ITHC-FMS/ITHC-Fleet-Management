"use client";

import Link from "next/link";
import { useMemo } from "react";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { workers } from "@/data/core";
import { leases, occupancy, properties, units } from "@/data/people";
import { capacityOf, currentLease, housingCostPerHead, occupiesOn } from "@/data/people/calc";
import { useAlerts } from "@/data/people/hooks";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { DaysBadge, Section } from "../common";

export default function HousingHome({ readOnly, editedBy }: ScreenProps) {
  const props = properties.useAll();
  const us = units.useAll();
  const ls = leases.useAll();
  const occ = occupancy.useAll();
  const ws = workers.useAll();
  const alerts = useAlerts();

  const active = occ.filter((o) => occupiesOn(o, TODAY));
  const cap = props.reduce((a, p) => a + capacityOf(us, p.id), 0);
  const cost = useMemo(() => housingCostPerHead(occ, ls), [occ, ls]);
  const rent = props.reduce((a, p) => (active.some((o) => o.propertyId === p.id) ? a + (currentLease(ls, p.id)?.monthlyCost ?? 0) : a), 0);
  const perHead = active.length ? Math.round(rent / active.length) : 0;
  const soon = ls.filter((l) => l.status === "current" && daysBetween(TODAY, l.end) <= 60).sort((a, b) => a.end.localeCompare(b.end));
  const residentIds = new Set(active.map((o) => o.workerId).filter(Boolean));
  const resAlerts = alerts.filter((a) => a.ownerKind === "worker" && residentIds.has(a.ownerId));
  const name = (id: string) => ws.find((w) => w.id === id)?.name ?? id;
  const pname = (id: string) => props.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <PageHeader title="Housing Dashboard" description="Occupancy, vacancy and lease expiries." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Occupied beds" value={active.length} hint={`of ${cap}`} />
        <KpiCard label="Vacant beds" value={Math.max(0, cap - active.length)} />
        <KpiCard label="Leases ending ≤60 days" value={soon.length} tone={soon.length ? "warn" : "good"} />
        <KpiCard label="Cost per head (KD)" value={formatKD(perHead, { symbol: false })} hint="Monthly rent ÷ residents" />
      </KpiGrid>

      <Section title="Occupancy and vacancy by property" actions={<Link href="/housing/occupancy" className="text-sm underline">Open ledger</Link>}>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-start">Property</th><th className="px-3 py-2 text-end">Beds</th><th className="px-3 py-2 text-end">Occupied</th><th className="px-3 py-2 text-end">Vacant</th><th className="px-3 py-2 text-end">Occupancy</th><th className="px-3 py-2 text-end">Cost / head (KD)</th></tr></thead>
            <tbody>
              {props.map((p) => {
                const c = capacityOf(us, p.id), n = active.filter((o) => o.propertyId === p.id).length;
                return <tr key={p.id} className="border-t"><td className="px-3 py-2">{p.name}</td><td className="px-3 py-2 text-end">{c}</td><td className="px-3 py-2 text-end">{n}</td><td className="px-3 py-2 text-end">{Math.max(0, c - n)}</td><td className="px-3 py-2 text-end">{c ? Math.round((n / c) * 100) : 0}%</td><td className="px-3 py-2 text-end">{n ? formatKD(cost.perProp.get(p.id) ?? 0, { symbol: false }) : "—"}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Lease expiries" actions={<Link href="/housing/leases" className="text-sm underline">Leases</Link>}>
          <ul className="space-y-1 text-sm">
            {soon.length === 0 && <li className="text-muted-foreground">No leases ending within 60 days.</li>}
            {soon.map((l) => <li key={l.id} className="flex items-center justify-between rounded border px-3 py-1.5"><span>{pname(l.propertyId)} <span className="text-xs text-muted-foreground">ends {fmtDate(l.end)}</span></span><DaysBadge days={daysBetween(TODAY, l.end)} /></li>)}
          </ul>
        </Section>
        <Section title="Resident document expiry (feeds the compliance watchlist)">
          <ul className="space-y-1 text-sm">
            {resAlerts.length === 0 && <li className="text-muted-foreground">No resident documents need attention.</li>}
            {resAlerts.slice(0, 8).map((a) => <li key={a.key} className="flex items-center justify-between rounded border px-3 py-1.5"><span>{a.ownerLabel} <span className="text-xs text-muted-foreground">{a.typeLabel}</span></span>{a.kind === "missing" ? <StatusBadge tone="bad">Missing</StatusBadge> : <DaysBadge days={a.daysLeft} />}</li>)}
            {resAlerts.length > 8 && <li className="text-xs text-muted-foreground">and {resAlerts.length - 8} more</li>}
          </ul>
        </Section>
      </div>

      <Section title="Who lives where">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {props.map((p) => {
            const here = active.filter((o) => o.propertyId === p.id);
            return (
              <div key={p.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="mb-1 font-medium">{p.name} <span className="text-xs text-muted-foreground">({here.length})</span></div>
                <div className="max-h-40 overflow-y-auto text-xs text-muted-foreground">{here.length ? here.map((o) => `${o.workerId ? name(o.workerId) : o.guestName} (${us.find((u) => u.id === o.unitId)?.unitNo})`).join(", ") : "Empty"}</div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
