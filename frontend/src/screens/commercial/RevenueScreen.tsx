"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, toneFor } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { clients, contracts, workers } from "@/data/core";
import { invoiceRecon, revenueTx, writeAudit, type RevenueTx } from "@/data/commercial";
import { batchNo, MODEL_LABEL, revenueByClient, sum, type PricedTx } from "@/data/commercial/engine";
import { fmtDate } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "../types";
import { useInputs } from "./model";
import { RevenueCalculator } from "./RevenueCalculator";
import { Card2, MonthSelect, Money, Notice, Section, useActor } from "./ui";

type TxRow = PricedTx & { id: string };
const unitOf = (p: PricedTx) => p.priced.contract?.rates.find((r) => r.key === p.tx.lineKey)?.unit ?? "order";

export default function RevenueScreen({ role, readOnly, editedBy }: ScreenProps) {
  const inp = useInputs();
  const [month, setMonth] = useState("2026-10");
  const recon = invoiceRecon.useAll();
  const ws = workers.useAll();
  const cl = clients.useAll();
  const k = contracts.useAll();
  const [ovr, setOvr] = useState<RevenueTx | null>(null);

  const monthRows = useMemo(() => inp.priced.filter((p) => p.tx.date.startsWith(month)), [inp.priced, month]);
  const byClient = revenueByClient(inp.priced, month);
  const total = sum([...byClient.values()]);
  const overrides = inp.tx.filter((t) => t.overrideReason && t.date.startsWith(month)).length;
  const open = recon.filter((r) => r.status !== "reconciled").length;
  const clientName = (id?: string) => cl.find((c) => c.id === id)?.name ?? "-";

  const txCols: Column<TxRow>[] = [
    { key: "date", header: "Date", value: (p) => p.tx.date, cell: (p) => fmtDate(p.tx.date) },
    { key: "client", header: "Client", value: (p) => clientName(p.clientId) },
    { key: "contract", header: "Contract version", value: (p) => `${p.tx.contractNo} v${p.priced.contract?.version ?? "-"}`, cell: (p) => (p.priced.contract ? `${p.tx.contractNo} v${p.priced.contract.version}` : <StatusBadge tone="bad">no version in force</StatusBadge>) },
    { key: "line", header: "Line / batch", value: (p) => p.tx.lineKey ?? `${p.tx.batch} ${p.tx.vehicleType ?? ""}`, cell: (p) => (p.tx.lineKey ? p.tx.lineKey : <span>{p.tx.batch} <span className="text-muted-foreground">({p.tx.vehicleType})</span>{p.tx.overrideReason && <StatusBadge tone="warn" className="ms-1">override</StatusBadge>}</span>) },
    { key: "qty", header: "Qty", align: "end", value: (p) => p.tx.qty, cell: (p) => `${p.tx.qty} ${unitOf(p)}` },
    { key: "amount", header: "Revenue (KD)", align: "end", value: (p) => p.priced.amount, cell: (p) => formatKD(p.priced.amount, { symbol: false }) },
  ];

  const clientRows = [...new Set(k.map((c) => c.clientId))].map((cid) => {
    const rows = monthRows.filter((p) => p.clientId === cid);
    const versions = [...new Set(rows.map((p) => `${p.tx.contractNo} v${p.priced.contract?.version}`))];
    const rec = recon.find((r) => r.clientId === cid && r.period === month);
    return { id: cid, name: clientName(cid), model: MODEL_LABEL[k.find((c) => c.clientId === cid)!.pricingModel], versions: versions.join(", ") || "-", revenue: byClient.get(cid) ?? 0, tx: rows.length, status: rec?.status ?? (rows.length ? "no invoice yet" : "-") };
  });
  const clientCols: Column<(typeof clientRows)[number]>[] = [
    { key: "name", header: "Client" }, { key: "model", header: "Pricing model" }, { key: "versions", header: "Contract version(s) used" },
    { key: "period", header: "Period", value: () => month }, { key: "tx", header: "Transactions", align: "end" },
    { key: "revenue", header: "Revenue (KD)", align: "end", cell: (r) => formatKD(r.revenue, { symbol: false }) },
    { key: "status", header: "Status", cell: (r) => <StatusBadge tone={toneFor(r.status === "no invoice yet" ? "pending" : r.status)}>{r.status}</StatusBadge> },
  ];

  // Talabat batch panel
  const tlb = monthRows.filter((p) => p.tx.batch);
  const batchRows = [...new Set(tlb.map((p) => p.tx.batch!))].sort().map((b) => {
    const rows = tlb.filter((p) => p.tx.batch === b);
    return { id: b, qty: sum(rows.map((p) => p.tx.qty)), revenue: sum(rows.map((p) => p.priced.amount)), perOrder: rows[0] ? Math.round(rows[0].priced.amount / rows[0].tx.qty) : 0 };
  });
  const live = ["Batch 1", "Batch 2", "Batch 3"].map((b) => ({ b, n: ws.filter((w) => w.currentClientId === "cli-talabat" && w.batch === b).length }));
  const overrideRows = inp.priced.filter((p) => p.tx.overrideReason);

  return (
    <div className="space-y-4">
      <PageHeader title="Revenue Engine" description="Client revenue computed from the contract configuration in force on each transaction date." actions={<MonthSelect value={month} onChange={setMonth} />} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label={`Revenue ${month}`} value={formatKD(total)} />
        <KpiCard label="Unreconciled invoices" value={open} tone={open ? "warn" : "good"} hint="All periods" />
        <KpiCard label="Batch overrides this month" value={overrides} tone={overrides ? "warn" : "default"} />
        <KpiCard label="Priced transactions" value={monthRows.length} />
      </KpiGrid>
      <Tabs tabs={[
        { id: "clients", label: "By client", content: <DataTable rows={clientRows} columns={clientCols} exportName={`revenue-${month}`} pageSize={10} /> },
        { id: "tx", label: "Transactions", content: <DataTable rows={monthRows.map((p): TxRow => ({ ...p, id: p.tx.id }))} columns={txCols} exportName={`transactions-${month}`} onRowClick={!readOnly ? (p) => p.tx.batch && setOvr(p.tx) : undefined} searchPlaceholder="Search transactions…" /> },
        { id: "talabat", label: "Talabat batches", content: (
          <div className="space-y-4">
            <Notice>Each order carries a batch snapshot taken when it was placed. Changing a rider&apos;s batch later (or a contract rate) never rewrites priced history; only a logged manual override does.</Notice>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card2><Section title={`Snapshot by batch, ${month}`}>
                <table className="w-full text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="text-start">Batch</th><th className="text-end">Orders</th><th className="text-end">Revenue / order</th><th className="text-end">Revenue</th></tr></thead>
                  <tbody>{batchRows.map((b) => <tr key={b.id} className="border-t"><td className="py-1">{b.id}</td><td className="text-end tabular-nums">{b.qty}</td><td className="text-end tabular-nums">{formatKD(b.perOrder)}</td><td className="text-end tabular-nums">{formatKD(b.revenue)}</td></tr>)}</tbody></table>
              </Section></Card2>
              <Card2><Section title="Riders by current batch (live, not used for history)">
                <ul className="text-sm">{live.map((l) => <li key={l.b} className="flex justify-between border-t py-1"><span>{l.b}</span><span className="tabular-nums">{l.n} riders</span></li>)}</ul>
              </Section></Card2>
            </div>
            <Section title="Manual batch overrides (audited)">
              <ul className="space-y-1 text-sm">
                {overrideRows.map((p) => <li key={p.tx.id} className="rounded border px-3 py-2">{fmtDate(p.tx.date)}: {p.tx.batchOriginal} to {p.tx.batch} ({p.tx.qty} orders, {formatKD(p.priced.amount)}) by {p.tx.overrideBy}. <i>{p.tx.overrideReason}</i></li>)}
                {!overrideRows.length && <li className="text-muted-foreground">No overrides.</li>}
              </ul>
              {!readOnly && <p className="text-xs text-muted-foreground">To override, open a Talabat transaction in the Transactions tab.</p>}
            </Section>
          </div>) },
        { id: "calc", label: "Calculator", content: <RevenueCalculator /> },
        { id: "recon", label: "Reconciliation", content: (
          <DataTable rows={recon.filter((r) => r.period === month).map((r) => { const comp = byClient.get(r.clientId) ?? 0; return { ...r, computed: comp, variance: r.invoiced - comp }; })} exportName={`reconciliation-${month}`}
            columns={[
              { key: "client", header: "Client", value: (r) => clientName(r.clientId) },
              { key: "computed", header: "Computed (KD)", align: "end", cell: (r) => formatKD(r.computed, { symbol: false }) },
              { key: "invoiced", header: "Invoiced (KD)", align: "end", cell: (r) => formatKD(r.invoiced, { symbol: false }) },
              { key: "variance", header: "Variance (KD)", align: "end", cell: (r) => <Money v={r.variance} /> },
              { key: "status", header: "Status", cell: (r) => <StatusBadge tone={toneFor(r.status)}>{r.status}</StatusBadge> },
            ]} empty="No invoices recorded for this period. Reconcile on the Client Invoice Reconciliation page." />) },
      ]} />
      {ovr && <OverrideSheet tx={ovr} role={role} onClose={() => setOvr(null)} />}
    </div>
  );
}

function OverrideSheet({ tx, role, onClose }: { tx: RevenueTx; role: string; onClose: () => void }) {
  const actor = useActor();
  const [batch, setBatch] = useState(batchNo(tx.batch) ?? "1");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const submit = async () => {
    if (`Batch ${batch}` === tx.batch) return setErr("Choose a different batch.");
    if (reason.trim().length < 8) return setErr("A reason of at least 8 characters is mandatory.");
    await revenueTx.save({ ...tx, batchOriginal: tx.batchOriginal ?? tx.batch, batch: `Batch ${batch}`, overrideReason: reason.trim(), overrideBy: actor.name });
    await writeAudit({ user: actor.name, role, entityType: "batch_override", entityId: tx.id, entityLabel: `${tx.contractNo} ${tx.date}`, action: "override", summary: `Batch override for ${tx.qty} orders on ${tx.date}`, reason: reason.trim(), before: tx.batch, after: `Batch ${batch}` });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Override batch" description={`${tx.contractNo}, ${fmtDate(tx.date)}, ${tx.qty} orders. Priced against the contract version in force on that date.`} onSubmit={submit} submitLabel="Apply override">
      {err && <Notice tone="bad">{err}</Notice>}
      <Field label="New batch"><Select value={batch} onChange={(e) => setBatch(e.target.value)}>{["1", "2", "3"].map((b) => <option key={b} value={b}>Batch {b}</option>)}</Select></Field>
      <Field label="Reason (mandatory, written to audit log)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </FormSheet>
  );
}
