"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { tcoProfiles } from "@/data/commercial";
import { sum } from "@/data/commercial/engine";
import { buildTco, type TcoRow } from "@/data/commercial/margin";
import { addDays, fmtDate } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import { useInputs } from "./model";
import { Notice } from "./ui";

export default function TcoScreen() {
  const inp = useInputs();
  const profiles = tcoProfiles.useAll();
  const rows = buildTco(inp.vehicles, profiles, inp.costs);
  const [own, setOwn] = useState("");
  const [sel, setSel] = useState<TcoRow | null>(null);
  const shown = rows.filter((r) => !own || r.vehicle.ownership === own);
  const avg = (o: string) => { const x = rows.filter((r) => r.vehicle.ownership === o && r.vehicle.type !== "transport"); return x.length ? Math.round(sum(x.map((r) => r.perMonth)) / x.length) : 0; };
  const cols: Column<TcoRow>[] = [
    { key: "veh", header: "Vehicle", value: (r) => `${r.vehicle.plate} ${r.vehicle.make} ${r.vehicle.model}` },
    { key: "own", header: "Ownership", value: (r) => r.vehicle.ownership, cell: (r) => <StatusBadge tone={r.vehicle.ownership === "rented" ? "info" : r.vehicle.ownership === "cash" ? "good" : "warn"}>{r.vehicle.ownership}</StatusBadge> },
    { key: "m", header: "Monthly cost (KD)", align: "end", value: (r) => r.vehicle.monthlyCost, cell: (r) => formatKD(r.vehicle.monthlyCost, { symbol: false }) },
    { key: "base", header: "Ownership cost to date (KD)", align: "end", value: (r) => r.base, cell: (r) => formatKD(r.base, { symbol: false }) },
    { key: "maint", header: "Maintenance (KD)", align: "end", value: (r) => r.maintenance, cell: (r) => formatKD(r.maintenance, { symbol: false }) },
    { key: "fuel", header: "Fuel (KD)", align: "end", value: (r) => r.fuel, cell: (r) => formatKD(r.fuel, { symbol: false }) },
    { key: "total", header: "Total (KD)", align: "end", value: (r) => r.total, cell: (r) => <b>{formatKD(r.total, { symbol: false })}</b> },
    { key: "pm", header: "Per month (KD)", align: "end", value: (r) => r.perMonth, cell: (r) => formatKD(r.perMonth, { symbol: false }) },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Vehicle Total Cost of Ownership" description="Total cost of each vehicle by ownership type, comparable on a per-month basis." />
      <KpiGrid>
        <KpiCard label="Rented, avg per month" value={formatKD(avg("rented"))} />
        <KpiCard label="Cash purchased, avg per month" value={formatKD(avg("cash"))} />
        <KpiCard label="Financed, avg per month" value={formatKD(avg("financed"))} />
        <KpiCard label="Financed balance outstanding" value={formatKD(sum(rows.map((r) => r.outstanding)))} hint="Liens open until settled" />
      </KpiGrid>
      <DataTable rows={shown} columns={cols} exportName="vehicle-tco" onRowClick={setSel} filters={<Select className="w-40" value={own} onChange={(e) => setOwn(e.target.value)} aria-label="Ownership"><option value="">All ownership</option><option value="rented">Rented</option><option value="cash">Cash purchased</option><option value="financed">Financed</option></Select>} />
      {sel && <TcoDetail key={sel.id} row={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

const Box = ({ l, v }: { l: string; v: string }) => <div className="rounded border p-2"><div className="text-xs text-muted-foreground">{l}</div><b>{v}</b></div>;

function TcoDetail({ row, onClose }: { row: TcoRow; onClose: () => void }) {
  const p = row.profile, v = row.vehicle;
  const interest = p.instalment * p.termMonths - p.principal;
  const lienEnd = addDays(p.startDate, p.termMonths * 30);
  return (
    <FormSheet wide open onOpenChange={(o) => !o && onClose()} title={`${v.plate}: ${v.make} ${v.model}`} description={`${v.ownership}, in service ${row.months} months since ${fmtDate(p.startDate)}`} hideSubmit>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Box l={row.label} v={formatKD(row.base)} />
        <Box l="Maintenance + fuel (recorded)" v={formatKD(row.maintenance + row.fuel)} />
        <Box l="Total to date" v={formatKD(row.total)} />
        <Box l="Per month" v={formatKD(row.perMonth)} />
      </div>
      {v.ownership === "rented" && <Notice>Rented from {v.lessor}: recurring charge {formatKD(v.monthlyCost)} per month. Return conditions: {p.returnConditions}.</Notice>}
      {v.ownership === "cash" && <Notice>Cash purchased: capital outlay {formatKD(p.purchasePrice)}, depreciated straight-line over {p.lifeMonths} months to {p.residualPct}% residual, plus maintenance.</Notice>}
      {v.ownership === "financed" && <Notice>Financed: {p.termMonths} instalments of {formatKD(p.instalment)}; interest over the term {formatKD(interest)}; balance outstanding {formatKD(row.outstanding)}. Lien with {p.lienHolder || "the lender"} until settled (about {fmtDate(lienEnd)}).</Notice>}
    </FormSheet>
  );
}
