"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { workerStates } from "@/data/commercial";
import type { MarginRow } from "@/data/commercial/margin";
import { daysBetween, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "../types";
import { useMarginModel } from "./model";
import { MonthSelect, Money } from "./ui";

type Row = MarginRow & { days: number };

export default function LossMakingScreen({ role }: ScreenProps) {
  const [month, setMonth] = useState("2026-10");
  const [sel, setSel] = useState<Row | null>(null);
  const m = useMarginModel(month);
  const states = workerStates.useAll();
  const rows: Row[] = m.workers.filter((w) => w.margin < 0).map((w) => ({ ...w, days: daysBetween(states.find((s) => s.id === w.id)?.since ?? TODAY, TODAY) }));
  const cols: Column<Row>[] = [
    { key: "label", header: "Worker" }, { key: "sub", header: "Client / state" },
    { key: "margin", header: "Monthly contribution (KD)", align: "end", cell: (r) => <Money v={r.margin} /> },
    { key: "days", header: "Days in state", align: "end", cell: (r) => <StatusBadge tone={r.days > 45 ? "bad" : r.days > 21 ? "warn" : "neutral"}>{r.days} days</StatusBadge> },
  ];
  const loss = rows.reduce((a, r) => a + r.margin, 0);
  const margin = sel;
  const canLink = role === "ceo" || role === "admin";
  return (
    <div className="space-y-4">
      <PageHeader title="Loss-making Workers" description="Heads whose monthly contribution is negative after housing, transport and carrying costs." actions={<MonthSelect value={month} onChange={setMonth} />} />
      <KpiGrid>
        <KpiCard label="Loss-making heads" value={rows.length} tone="bad" hint={`of ${m.workers.length} in the margin report`} />
        <KpiCard label="Combined monthly loss" value={formatKD(loss)} tone="bad" />
        <KpiCard label="In state over 45 days" value={rows.filter((r) => r.days > 45).length} tone="warn" />
        <KpiCard label="Bench heads in list" value={rows.filter((r) => !r.clientId).length} />
      </KpiGrid>
      <DataTable rows={rows} columns={cols} exportName={`loss-making-${month}`} onRowClick={setSel} />
      <FormSheet open={!!margin} onOpenChange={(o) => !o && setSel(null)} title={margin ? `Margin: ${margin.label}` : ""} description={margin?.sub} hideSubmit>
        {margin && (
          <div className="space-y-3 text-sm">
            {[["Revenue", margin.revenue], ["Pay and carrying cost", -margin.cost], ["Housing", -margin.housing], ["Transport / vehicle", -margin.transport], ["Contribution", margin.margin]].map(([l, v]) => (
              <div key={l as string} className="flex justify-between border-b py-1"><span>{l as string}</span><Money v={v as number} /></div>
            ))}
            <p className="text-muted-foreground">{margin.days} days in current state.</p>
            {canLink && <Link className="text-primary underline" href={`/${role}/margin`}>Open the full margin-per-worker report</Link>}
          </div>
        )}
      </FormSheet>
    </div>
  );
}
