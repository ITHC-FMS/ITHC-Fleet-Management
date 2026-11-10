"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, toneFor } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { clients } from "@/data/core";
import { invoiceRecon, writeAudit, type InvoiceRecon } from "@/data/commercial";
import { revenueByClient, sum } from "@/data/commercial/engine";
import { monthLabel, monthsList } from "@/data/commercial/margin";
import { formatKD, parseKD } from "@/lib/money";
import { useInputs } from "./model";
import { Money, Notice, Section, useActor } from "./ui";

interface Row { id: string; rec?: InvoiceRecon; clientId: string; period: string; computed: number; invoiced: number | null; variance: number | null; status: string }

export default function ReconciliationScreen({ role }: { role: string }) {
  const recon = invoiceRecon.useAll(), cl = clients.useAll();
  const inp = useInputs();
  const [client, setClient] = useState("");
  const [status, setStatus] = useState("");
  const [sel, setSel] = useState<Row | null>(null);
  const name = (id: string) => cl.find((c) => c.id === id)?.name ?? id;

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const period of monthsList.filter((m) => m <= "2026-10")) {
      const rev = revenueByClient(inp.priced, period);
      for (const [clientId, computed] of rev) {
        const rec = recon.find((r) => r.clientId === clientId && r.period === period);
        out.push({ id: `${clientId}|${period}`, rec, clientId, period, computed, invoiced: rec?.invoiced ?? null, variance: rec ? rec.invoiced - computed : null, status: rec?.status ?? "not invoiced" });
      }
    }
    return out.sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : a.clientId.localeCompare(b.clientId)));
  }, [inp.priced, recon]);

  const shown = rows.filter((r) => (!client || r.clientId === client) && (!status || r.status === status));
  const cols: Column<Row>[] = [
    { key: "client", header: "Client", value: (r) => name(r.clientId) }, { key: "period", header: "Period", cell: (r) => monthLabel(r.period) },
    { key: "computed", header: "Computed (KD)", align: "end", cell: (r) => formatKD(r.computed, { symbol: false }) },
    { key: "invoiced", header: "Invoiced (KD)", align: "end", value: (r) => r.invoiced ?? -1, cell: (r) => (r.invoiced === null ? "-" : formatKD(r.invoiced, { symbol: false })) },
    { key: "variance", header: "Variance (KD)", align: "end", value: (r) => r.variance ?? 0, cell: (r) => (r.variance === null ? "-" : <Money v={r.variance} />) },
    { key: "status", header: "Status", cell: (r) => <StatusBadge tone={r.status === "not invoiced" ? "warn" : toneFor(r.status)}>{r.status}</StatusBadge> },
  ];
  const leakage = sum(rows.filter((r) => r.variance !== null && r.variance < 0 && r.status !== "reconciled").map((r) => r.variance!));
  // attendance summary for hourly and labour-supply invoices
  const att = useMemo(() => {
    const o: { id: string; client: string; month: string; unit: string; qty: number }[] = [];
    for (const m of monthsList) for (const p of inp.priced) {
      if (!p.tx.date.startsWith(m) || !p.tx.lineKey || !["hour", "monthly"].includes(p.tx.lineKey)) continue;
      const key = `${p.clientId}|${m}|${p.tx.lineKey}`;
      const e = o.find((x) => x.id === key);
      if (e) e.qty += p.tx.qty; else o.push({ id: key, client: name(p.clientId ?? ""), month: m, unit: p.tx.lineKey === "hour" ? "hours worked" : "head-months (prorated by attendance)", qty: p.tx.qty });
    }
    return o.sort((a, b) => (a.month < b.month ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inp.priced, cl]);

  return (
    <div className="space-y-4">
      <PageHeader title="Client Invoice Reconciliation" description="Computed revenue (contract version in force on each transaction date) against what was invoiced." />
      <KpiGrid>
        <KpiCard label="Periods to reconcile" value={rows.filter((r) => r.status !== "reconciled").length} tone="warn" />
        <KpiCard label="Under-invoiced, unresolved" value={formatKD(leakage)} tone={leakage < 0 ? "bad" : "good"} hint="Revenue leakage" />
        <KpiCard label="Reconciled" value={rows.filter((r) => r.status === "reconciled").length} tone="good" />
        <KpiCard label="Disputed" value={rows.filter((r) => r.status === "disputed").length} tone="bad" />
      </KpiGrid>
      <Tabs tabs={[
        { id: "rec", label: "Reconciliation", content: (
          <DataTable rows={shown} columns={cols} exportName="invoice-reconciliation" onRowClick={setSel}
            filters={<>
              <Select className="w-44" value={client} onChange={(e) => setClient(e.target.value)} aria-label="Client"><option value="">All clients</option>{cl.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option>{["not invoiced", "open", "disputed", "reconciled"].map((s) => <option key={s}>{s}</option>)}</Select>
            </>} />) },
        { id: "att", label: "Attendance summary", content: (
          <Section title="Attendance feeding hourly and labour-supply invoices">
            <DataTable rows={att} exportName="attendance-summary" pageSize={12} columns={[{ key: "client", header: "Client / site" }, { key: "month", header: "Month", cell: (r) => monthLabel(r.month) }, { key: "unit", header: "Basis" }, { key: "qty", header: "Quantity", align: "end", cell: (r) => r.qty.toFixed(2) }]} />
          </Section>) },
      ]} />
      {sel && <ReconSheet key={sel.id} row={sel} role={role} onClose={() => setSel(null)} name={name(sel.clientId)} />}
    </div>
  );
}

function ReconSheet({ row, role, onClose, name }: { row: Row; role: string; onClose: () => void; name: string }) {
  const actor = useActor();
  const [inv, setInv] = useState(row.invoiced === null ? "" : (row.invoiced / 1000).toFixed(3));
  const [st, setSt] = useState<InvoiceRecon["status"]>(row.rec?.status ?? "open");
  const [note, setNote] = useState(row.rec?.note ?? "");
  const [loaded] = useState(row.rec?.version ?? 0);
  const [err, setErr] = useState("");
  const submit = async () => {
    const invoiced = parseKD(inv);
    if (!Number.isFinite(invoiced) || invoiced < 0) return setErr("Enter the invoiced amount in KD.");
    const live = row.rec && invoiceRecon.getSync(row.rec.id);
    if (row.rec && (!live || live.version !== loaded)) return setErr("Conflict: changed by someone else. Close and reopen.");
    if (st === "reconciled" && invoiced !== row.computed && !note.trim()) return setErr("Reconciling with a variance needs an explanatory note.");
    const next: InvoiceRecon = { id: row.rec?.id ?? invoiceRecon.nextId("rec"), clientId: row.clientId, period: row.period, invoiced, status: st, note: note.trim() || undefined, reconciledBy: st === "reconciled" ? actor.name : undefined, version: (row.rec?.version ?? 0) + 1 };
    await invoiceRecon.save(next);
    await writeAudit({ user: actor.name, role, entityType: "reconciliation", entityId: next.id, entityLabel: `${name} ${row.period}`, action: "update", summary: `Invoice ${formatKD(invoiced)} vs computed ${formatKD(row.computed)}, marked ${st}`, reason: note.trim() || "Matches computed revenue" });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={`${name}, ${monthLabel(row.period)}`} description={`Computed revenue ${formatKD(row.computed)}`} onSubmit={submit}>
      {err && <Notice tone="bad">{err}</Notice>}
      <Field label="Invoiced (KD)"><Input inputMode="decimal" value={inv} onChange={(e) => setInv(e.target.value)} /></Field>
      <Field label="Status"><Select value={st} onChange={(e) => setSt(e.target.value as InvoiceRecon["status"])}><option value="open">Open</option><option value="disputed">Disputed</option><option value="reconciled">Reconciled</option></Select></Field>
      <Field label="Note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </FormSheet>
  );
}
