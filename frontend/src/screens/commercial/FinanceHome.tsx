"use client";

import Link from "next/link";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { approvals, cashCollections, invoiceRecon, signedOpps } from "@/data/commercial";
import { latestVersion, revenueByContractNo, sum } from "@/data/commercial/engine";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "../types";
import { useInputs } from "./model";
import { Card2, Section } from "./ui";

export default function FinanceHome({ role }: ScreenProps) {
  const inp = useInputs();
  const recon = invoiceRecon.useAll(), cash = cashCollections.useAll(), sig = signedOpps.useAll(), apr = approvals.useAll();
  const month = TODAY.slice(0, 7);
  const byContract = revenueByContractNo(inp.priced, month);
  const clientName = (id: string) => inp.clients.find((c) => c.id === id)?.name ?? id;
  const nos = [...new Set(inp.contracts.map((c) => c.contractNo))];
  const ending = nos.map((no) => latestVersion(inp.contracts, no)!).filter((v) => v.validTo && daysBetween(TODAY, v.validTo) >= 0 && daysBetween(TODAY, v.validTo) <= 180);
  const shortfalls = sum(cash.filter((c) => c.date.startsWith(month) && c.handedOver !== null).map((c) => Math.max(0, c.collected - c.handedOver!)));
  const awaiting = sig.filter((s) => s.status === "awaiting_contract");
  const pending = apr.filter((a) => a.status === "pending");
  const unrec = recon.filter((r) => r.status !== "reconciled");
  return (
    <div className="space-y-4">
      <PageHeader title="Commercial Overview" description="Revenue, reconciliation, cash and contracts at a glance. Revenue is month to date." />
      <KpiGrid>
        <KpiCard label={`Revenue ${month} (to date)`} value={formatKD(sum([...byContract.values()]))} />
        <KpiCard label="Unreconciled invoices" value={unrec.length} tone={unrec.length ? "warn" : "good"} hint={`${formatKD(sum(unrec.map((r) => r.invoiced)))} invoiced`} />
        <KpiCard label="Cash shortfalls this month" value={formatKD(shortfalls)} tone={shortfalls ? "bad" : "good"} />
        <KpiCard label="Signed, no contract" value={awaiting.length} tone={awaiting.length ? "warn" : "good"} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card2><Section title="Revenue this month per contract" actions={<Link className="text-sm text-primary underline" href={`/${role}/revenue`}>Revenue engine</Link>}>
          <table className="w-full text-sm"><tbody>{nos.map((no) => { const v = latestVersion(inp.contracts, no)!; return <tr key={no} className="border-t"><td className="py-1.5">{no}</td><td>{clientName(v.clientId)}</td><td className="text-xs text-muted-foreground">v{v.version}</td><td className="text-end tabular-nums">{formatKD(byContract.get(no) ?? 0)}</td></tr>; })}</tbody></table>
        </Section></Card2>
        <Card2><Section title="Contracts ending within 180 days" actions={<Link className="text-sm text-primary underline" href={`/${role}/contracts`}>Contracts</Link>}>
          {ending.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : <ul className="space-y-1 text-sm">{ending.map((v) => <li key={v.id} className="flex justify-between"><span>{v.contractNo} ({clientName(v.clientId)})</span><span>{fmtDate(v.validTo)} ({daysBetween(TODAY, v.validTo!)} days)</span></li>)}</ul>}
        </Section></Card2>
        <Card2><Section title="Signed opportunities waiting for a contract" actions={<Link className="text-sm text-primary underline" href={`/${role}/signed`}>Signed</Link>}>
          <ul className="space-y-1 text-sm">{awaiting.map((s) => <li key={s.id} className="flex justify-between"><span>{s.name}</span><span className="text-muted-foreground">starts {fmtDate(s.startDate)}</span></li>)}</ul>
        </Section></Card2>
        <Card2><Section title="Approvals waiting with the CEO">
          {pending.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : <ul className="space-y-1 text-sm">{pending.map((a) => <li key={a.id} className="flex justify-between"><span>{a.opportunity}</span><StatusBadge tone="warn">{a.heads} seats</StatusBadge></li>)}</ul>}
        </Section></Card2>
      </div>
    </div>
  );
}
