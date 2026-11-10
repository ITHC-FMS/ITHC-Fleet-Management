"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Select } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { attendance, type AttendanceRecord } from "@/data/admin";
import { formatKD } from "@/lib/money";
import { fmtMinutes, useSite } from "./site";

const MONTHS = [["2026-11", "November 2026"], ["2026-10", "October 2026"]];

export default function AttendanceSummaryScreen() {
  const site = useSite();
  const all = attendance.useAll();
  const [month, setMonth] = useState("2026-11");

  const data = useMemo(() => {
    const recs = all.filter((a) => a.locationId === site.locationId && a.date.startsWith(month));
    const days = new Set(recs.map((r) => r.date)).size;
    const by = new Map<string, AttendanceRecord[]>();
    recs.forEach((r) => by.set(r.workerId, [...(by.get(r.workerId) ?? []), r]));
    const rate = site.contract?.rates[0]?.amount ?? 0;
    const hourly = site.contract?.pricingModel === "hourly";
    const rows = site.placed.map((w) => {
      const r = by.get(w.id) ?? [];
      const present = r.filter((x) => x.status === "present").length;
      const partial = r.filter((x) => x.status === "partial").length;
      const absent = r.filter((x) => x.status === "absent").length;
      const minutes = r.reduce((s, x) => s + x.minutes, 0);
      // Revenue: hourly = hours x rate; fixed monthly labour charge is prorated by attendance (minutes capped at a full 8h day).
      const units = r.reduce((s, x) => s + Math.min(480, x.minutes), 0);
      const charge = hourly ? Math.round((minutes * rate) / 60) : days ? Math.round((rate * units) / (480 * days)) : 0;
      return { id: w.id, name: w.name, present, partial, absent, minutes, charge };
    });
    return { rows, days, total: rows.reduce((s, r) => s + r.charge, 0), hourly, rate };
  }, [all, site.locationId, site.placed, site.contract, month]);

  const sum = (k: "present" | "partial" | "absent" | "minutes") => data.rows.reduce((s, r) => s + r[k], 0);

  const exportCsv = () => {
    const lines = ["Worker,Site,Client,Month,Days present,Partial days,Absences,Hours,Charge KD", ...data.rows.map((r) => [r.name, site.location?.name, site.client?.name, month, r.present, r.partial, r.absent, (r.minutes / 60).toFixed(2), formatKD(r.charge, { symbol: false })].map((v) => `"${v ?? ""}"`).join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `attendance-summary-${site.locationId}-${month}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Monthly Attendance Summary" description={site.location ? `${site.location.name}, ${site.client?.name ?? ""}` : undefined} />
      {!site.locked && (
        <Select value={site.locationId} onChange={(e) => site.setSite(e.target.value)} aria-label="Site" className="h-12 text-base">
          {site.sites.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      )}
      <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" className="h-12 text-base">
        {MONTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <KpiGrid>
        <KpiCard label="Working days recorded" value={data.days} />
        <KpiCard label="Total hours" value={fmtMinutes(sum("minutes"))} />
        <KpiCard label="Absences" value={sum("absent")} tone={sum("absent") > 5 ? "warn" : "default"} />
        <KpiCard label={data.hourly ? "Hourly revenue" : "Prorated labour charge"} value={formatKD(data.total)} hint={site.contract ? `${site.contract.contractNo}: ${data.hourly ? `${formatKD(data.rate)} per hour` : `${formatKD(data.rate)} per head per month`}` : undefined} />
      </KpiGrid>
      <StatusBadge tone="info">{data.hourly ? "Drives revenue: hours x hourly rate" : "Fixed monthly charge prorated by attendance"}</StatusBadge>
      <ul className="space-y-2">
        {data.rows.map((r) => (
          <li key={r.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-baseline justify-between"><p className="font-semibold">{r.name}</p><p className="text-sm tabular-nums">{formatKD(r.charge)}</p></div>
            <p className="mt-1 text-sm text-muted-foreground">{r.present} present, {r.partial} partial, {r.absent} absent, {fmtMinutes(r.minutes)}</p>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="h-12 w-full text-base" onClick={exportCsv}><Download /> Export for invoice reconciliation</Button>
    </div>
  );
}
