"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { Tabs } from "@/components/app/tabs";
import { sum } from "@/data/commercial/engine";
import { buildTco, type MarginRow } from "@/data/commercial/margin";
import { tcoProfiles } from "@/data/commercial";
import { formatKD } from "@/lib/money";
import { useInputs, useMarginModel } from "./model";
import { Card2, MonthSelect, Money, Section } from "./ui";

export const marginColumns = (labelHeader: string): Column<MarginRow>[] => [
  { key: "label", header: labelHeader, cell: (r) => <div><div className="font-medium">{r.label}</div><div className="text-xs text-muted-foreground">{r.sub}</div></div>, value: (r) => `${r.label} ${r.sub}` },
  { key: "revenue", header: "Revenue (KD)", align: "end", cell: (r) => formatKD(r.revenue, { symbol: false }) },
  { key: "cost", header: "Cost (KD)", align: "end", cell: (r) => formatKD(r.cost, { symbol: false }) },
  { key: "housing", header: "Housing (KD)", align: "end", cell: (r) => formatKD(r.housing, { symbol: false }) },
  { key: "transport", header: "Transport (KD)", align: "end", cell: (r) => formatKD(r.transport, { symbol: false }) },
  { key: "margin", header: "Margin (KD)", align: "end", cell: (r) => <Money v={r.margin} className="font-medium" /> },
];

export default function MarginScreen() {
  const [month, setMonth] = useState("2026-10");
  const m = useMarginModel(month);
  const inp = useInputs();
  const profiles = tcoProfiles.useAll();
  const tco = buildTco(inp.vehicles, profiles, inp.costs);
  const neg = () => (r: MarginRow) => (r.margin < 0 ? "bg-red-50/60 dark:bg-red-950/20" : undefined);
  const tabs = [
    { id: "worker", label: "Per worker", rows: m.workers, h: "Worker" },
    { id: "client", label: "Per client", rows: m.clients, h: "Client" },
    { id: "vehicle", label: "Per vehicle", rows: m.vehicles, h: "Vehicle" },
    { id: "contract", label: "Per contract", rows: m.contracts, h: "Contract" },
  ];
  const own = (["rented", "cash", "financed"] as const).map((o) => {
    const rows = tco.filter((t) => t.vehicle.ownership === o && t.vehicle.type !== "transport");
    return { o, n: rows.length, avg: rows.length ? Math.round(sum(rows.map((t) => t.perMonth)) / rows.length) : 0 };
  });
  const total = sum(m.clients.map((c) => c.margin));
  return (
    <div className="space-y-4">
      <PageHeader title="Margin Reports" description="Margin net of housing and transport cost per head, from revenue engine output and attributed cost records." actions={<MonthSelect value={month} onChange={setMonth} />} />
      <KpiGrid>
        <KpiCard label="Revenue" value={formatKD(sum(m.clients.map((c) => c.revenue)))} />
        <KpiCard label="Margin (placed + bench)" value={formatKD(total)} tone={total < 0 ? "bad" : "good"} />
        <KpiCard label="Loss-making workers" value={m.workers.filter((w) => w.margin < 0).length} tone="warn" hint={`of ${m.workers.length}`} />
        <KpiCard label="Loss-making vehicles" value={m.vehicles.filter((v) => v.margin < 0).length} tone="warn" hint={`of ${m.vehicles.length}`} />
      </KpiGrid>
      <Tabs tabs={tabs.map((t) => ({
        id: t.id, label: t.label,
        content: (
          <div className="space-y-4">
            <DataTable rows={t.rows} columns={marginColumns(t.h)} exportName={`margin-${t.id}-${month}`} rowClassName={neg()} />
            {t.id === "vehicle" && (
              <Card2><Section title="Monthly cost per vehicle, common basis across ownership types (average, TCO to date)">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {own.map((x) => <div key={x.o} className="rounded border p-3"><div className="text-xs capitalize text-muted-foreground">{x.o} ({x.n} vehicles)</div><div className="text-lg font-semibold tabular-nums">{formatKD(x.avg)}</div></div>)}
                </div>
              </Section></Card2>
            )}
            <p className="text-xs text-muted-foreground">Cost = base pay, overtime, insurance and permit carrying cost, plus costs attributed to the worker or client. Vehicle margin is the revenue of its drivers less their pay, housing and vehicle cost. Revenue is allocated to active and probation workers of the client; others earn nothing in the month.</p>
          </div>
        ),
      }))} />
    </div>
  );
}
