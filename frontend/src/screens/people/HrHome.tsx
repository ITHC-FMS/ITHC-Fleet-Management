"use client";

import Link from "next/link";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { vehicles, workers, type WorkerRole, type WorkerStatus } from "@/data/core";
import { useAlerts } from "@/data/people/hooks";
import { daysBetween, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { DaysBadge, Notice, Section } from "./common";

const ROLES: WorkerRole[] = ["driver", "picker", "warehouse", "security", "barista", "handover", "service"];
const STATUSES: WorkerStatus[] = ["active", "probation", "training", "standby", "sick_leave", "annual_leave", "blocked", "terminated"];
const LEAVING: WorkerStatus[] = ["terminated", "absconded", "inactive", "blocked"];

export default function HrHome({ readOnly, editedBy }: ScreenProps) {
  const ws = workers.useAll();
  const vs = vehicles.useAll();
  const alerts = useAlerts().filter((a) => a.ownerKind === "worker");

  const live = ws.filter((w) => !LEAVING.includes(w.status));
  const onboarding = ws.filter((w) => w.status === "training" || w.status === "probation" || daysBetween(w.joiningDate, TODAY) <= 30);
  const leavers = ws.filter((w) => LEAVING.includes(w.status));
  const d30 = alerts.filter((a) => a.kind !== "missing" && a.daysLeft! <= 30);
  const d60 = alerts.filter((a) => a.kind === "expiring" && a.daysLeft! > 30 && a.daysLeft! <= 60);
  const missing = alerts.filter((a) => a.kind === "missing");
  const bad = new Set(alerts.filter((a) => a.kind !== "expiring" || a.daysLeft! <= 30).map((a) => a.ownerId));

  const leased = vs.filter((v) => v.ownership === "rented" && v.status !== "off_fleet" && v.type !== "transport");
  const hire = (["car", "bike"] as const).map((t) => {
    const need = leased.filter((v) => v.type === t).length;
    const drivers = live.filter((w) => w.roles.includes("driver") && w.vehicleTypes?.includes(t));
    const compliant = drivers.filter((w) => !bad.has(w.id));
    return { t, need, drivers: drivers.length, compliant: compliant.length, hires: Math.max(0, need - compliant.length) };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Workforce Overview" description="Workers, onboarding, leavers and document compliance." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Active workers" value={live.length} />
        <KpiCard label="Onboarding" value={onboarding.length} hint="Training, probation or joined ≤30 days" />
        <KpiCard label="Expiring ≤30 days" value={d30.length} tone={d30.length ? "bad" : "good"} hint="Includes expired" />
        <KpiCard label="Missing documents" value={missing.length} tone={missing.length ? "warn" : "good"} />
      </KpiGrid>

      <Section title="Workers by role and status">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-start">Role</th>{STATUSES.map((s) => <th key={s} className="px-2 py-2 text-end text-xs">{prettify(s)}</th>)}<th className="px-3 py-2 text-end">Total</th></tr></thead>
            <tbody>
              {ROLES.map((r) => {
                const rows = ws.filter((w) => w.roles.includes(r));
                return <tr key={r} className="border-t"><td className="px-3 py-1.5">{prettify(r)}</td>{STATUSES.map((s) => <td key={s} className="px-2 py-1.5 text-end tabular-nums">{rows.filter((w) => w.status === s).length || "·"}</td>)}<td className="px-3 py-1.5 text-end font-medium">{rows.length}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Onboarding in progress">
          <ul className="space-y-1 text-sm">{onboarding.slice(0, 8).map((w) => <li key={w.id} className="flex justify-between rounded border px-3 py-1.5"><span>{w.name}</span><StatusBadge tone="warn">{prettify(w.status)}</StatusBadge></li>)}{onboarding.length === 0 && <li className="text-muted-foreground">Nobody onboarding.</li>}</ul>
        </Section>
        <Section title="Leavers in progress">
          <ul className="space-y-1 text-sm">{leavers.slice(0, 8).map((w) => <li key={w.id} className="flex justify-between rounded border px-3 py-1.5"><span>{w.name}</span><StatusBadge tone="bad">{prettify(w.status)}</StatusBadge></li>)}{leavers.length === 0 && <li className="text-muted-foreground">No leavers in progress.</li>}</ul>
        </Section>
      </div>

      <Section title="Documents expiring in 30 and 60 days, and missing" actions={<Link href="/hr/watchlist" className="text-sm underline">Compliance watchlist</Link>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Within 30 days (incl. expired)" value={d30.length} tone={d30.length ? "bad" : "good"} />
          <KpiCard label="31 to 60 days" value={d60.length} tone={d60.length ? "warn" : "good"} />
          <KpiCard label="Missing entirely" value={missing.length} />
        </div>
        <ul className="space-y-1 text-sm">
          {alerts.slice(0, 6).map((a) => <li key={a.key} className="flex items-center justify-between rounded border px-3 py-1.5"><span>{a.ownerLabel} <span className="text-xs text-muted-foreground">{a.typeLabel}</span></span>{a.kind === "missing" ? <StatusBadge tone="bad">Missing</StatusBadge> : <DaysBadge days={a.daysLeft} />}</li>)}
        </ul>
      </Section>

      <Section title="Hires needed for leased vehicles">
        <Notice>Estimated from leased vehicles in the fleet register against compliant drivers (no expired or missing documents). Formal vehicle assignment is managed by Fleet.</Notice>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-start">Vehicle type</th><th className="px-3 py-2 text-end">Leased vehicles</th><th className="px-3 py-2 text-end">Drivers</th><th className="px-3 py-2 text-end">Compliant</th><th className="px-3 py-2 text-end">Hires needed</th></tr></thead>
            <tbody>{hire.map((h) => <tr key={h.t} className="border-t"><td className="px-3 py-1.5">{prettify(h.t)}</td><td className="px-3 py-1.5 text-end">{h.need}</td><td className="px-3 py-1.5 text-end">{h.drivers}</td><td className="px-3 py-1.5 text-end">{h.compliant}</td><td className={`px-3 py-1.5 text-end font-medium ${h.hires ? "text-amber-600" : ""}`}>{h.hires}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
