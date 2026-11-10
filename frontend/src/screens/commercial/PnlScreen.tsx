"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Select } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { Tabs } from "@/components/app/tabs";
import { companies } from "@/data/core";
import { sum } from "@/data/commercial/engine";
import { dailyPnl, monthLabel, monthlyPnl, monthsList, type PnlRow } from "@/data/commercial/margin";
import { fmtDate } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import { useSession } from "@/lib/auth";
import type { ScreenProps } from "../types";
import { useInputs } from "./model";
import { Bars, Card2, MonthSelect, Money, Notice, Section } from "./ui";

type R = PnlRow & { id: string };
const cols = (k: string, fmt: (s: string) => string): Column<R>[] => [
  { key: "key", header: k, cell: (r) => fmt(r.key) },
  { key: "revenue", header: "Revenue (KD)", align: "end", cell: (r) => formatKD(r.revenue, { symbol: false }) },
  { key: "pay", header: "Pay (KD)", align: "end", cell: (r) => formatKD(r.pay, { symbol: false }) },
  { key: "housing", header: "Housing (KD)", align: "end", cell: (r) => formatKD(r.housing, { symbol: false }) },
  { key: "vehicles", header: "Vehicles (KD)", align: "end", cell: (r) => formatKD(r.vehicles, { symbol: false }) },
  { key: "other", header: "Other costs (KD)", align: "end", cell: (r) => formatKD(r.other, { symbol: false }) },
  { key: "cost", header: "Cost (KD)", align: "end", cell: (r) => formatKD(r.cost, { symbol: false }) },
  { key: "margin", header: "Margin (KD)", align: "end", cell: (r) => <Money v={r.margin} className="font-medium" /> },
];

export default function PnlScreen({ role }: ScreenProps) {
  void role;
  const inp = useInputs();
  const user = useSession();
  const co = companies.useAll().filter((c) => c.kind === "operating" && (!user || user.companyIds.includes(c.id)));
  const [month, setMonth] = useState("2026-11");
  const [company, setCompany] = useState("all");
  const monthly = useMemo(() => monthsList.map((m): R => ({ ...monthlyPnl(inp, m), id: m })), [inp]);
  const daily = useMemo(() => dailyPnl(inp, month).map((d): R => ({ ...d, id: d.key })), [inp, month]);
  const cur = monthly.find((m) => m.key === month)!;
  return (
    <div className="space-y-4">
      <PageHeader title="Group P&L" description="Revenue, cost and margin for the whole business. Company scope follows the user's access."
        actions={<>
          <Select className="w-52" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company"><option value="all">Group (all my companies)</option>{co.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <MonthSelect value={month} onChange={setMonth} />
        </>} />
      <KpiGrid>
        <KpiCard label={`Revenue ${monthLabel(month)}`} value={formatKD(cur.revenue)} />
        <KpiCard label="Cost" value={formatKD(cur.cost)} />
        <KpiCard label="Margin" value={formatKD(cur.margin)} tone={cur.margin < 0 ? "bad" : "good"} />
        <KpiCard label="Margin %" value={cur.revenue ? `${((cur.margin * 100) / cur.revenue).toFixed(1)}%` : "-"} />
      </KpiGrid>
      <Tabs tabs={[
        { id: "monthly", label: "Monthly", content: (
          <div className="space-y-4">
            <Card2><Section title="Margin by month"><Bars rows={monthly.map((m) => ({ label: monthLabel(m.key), value: m.margin }))} /></Section></Card2>
            <DataTable rows={monthly} columns={cols("Month", monthLabel)} exportName="group-pnl-monthly" pageSize={12} />
          </div>) },
        { id: "daily", label: `Daily, ${monthLabel(month)}`, content: (
          <div className="space-y-3">
            <Notice>Monthly revenue lines (fixed labour) are spread evenly across the days; fixed pay, housing and vehicle costs are spread evenly; recorded costs fall on their own date. Total for the days shown: <b>{formatKD(sum(daily.map((d) => d.margin)))}</b> margin.</Notice>
            <DataTable rows={daily} columns={cols("Date", fmtDate)} exportName={`group-pnl-daily-${month}`} pageSize={31} empty="No days elapsed in this month yet." />
          </div>) },
      ]} />
      <p className="text-xs text-muted-foreground">The model carries a company dimension; today the group has one operating company, so Group and ITHC Logistics show the same figures. A second company would appear in the selector automatically.</p>
    </div>
  );
}
