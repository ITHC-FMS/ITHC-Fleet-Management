"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, toneFor } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { Button } from "@/components/ui/button";
import { clients, workers } from "@/data/core";
import { cashCollections, writeAudit, type CashCollection } from "@/data/commercial";
import { sum } from "@/data/commercial/engine";
import { fmtDate, TODAY } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import type { ScreenProps } from "../types";
import { Money, Notice, useActor } from "./ui";

const short = (c: CashCollection) => (c.handedOver === null ? 0 : Math.max(0, c.collected - c.handedOver));

export default function CashScreen({ role, readOnly, editedBy }: ScreenProps) {
  const rows = cashCollections.useAll(), ws = workers.useAll(), cl = clients.useAll();
  const [platform, setPlatform] = useState("");
  const [only, setOnly] = useState("");
  const [sel, setSel] = useState<CashCollection | "new" | null>(null);
  const driver = (id: string) => ws.find((w) => w.id === id)?.name ?? id;
  const plat = (id: string) => cl.find((c) => c.id === id)?.name ?? id;
  const shown = rows.filter((r) => (!platform || r.clientId === platform) && (only === "" || (only === "short" ? short(r) > 0 : only === "open" ? r.handedOver === null : r.deduction === "queued")));
  const month = TODAY.slice(0, 7);
  const cols: Column<CashCollection>[] = [
    { key: "date", header: "Date", cell: (r) => fmtDate(r.date) },
    { key: "driver", header: "Driver", value: (r) => driver(r.workerId) }, { key: "plat", header: "Platform", value: (r) => plat(r.clientId) },
    { key: "collected", header: "Collected (KD)", align: "end", cell: (r) => formatKD(r.collected, { symbol: false }) },
    { key: "handed", header: "Handed over (KD)", align: "end", value: (r) => r.handedOver ?? -1, cell: (r) => (r.handedOver === null ? <StatusBadge tone="warn">awaiting</StatusBadge> : formatKD(r.handedOver, { symbol: false })) },
    { key: "short", header: "Shortfall (KD)", align: "end", value: short, cell: (r) => (short(r) ? <Money v={-short(r)} /> : "0.000") },
    { key: "ded", header: "Payroll deduction", value: (r) => r.deduction, cell: (r) => (r.deduction === "none" ? "-" : <StatusBadge tone={r.deduction === "waived" ? "neutral" : toneFor(r.deduction === "deducted" ? "done" : "pending")}>{r.deduction} {r.payrollPeriod}</StatusBadge>) },
  ];
  const byPlat = [...new Set(rows.map((r) => r.clientId))].map((id) => {
    const rs = rows.filter((r) => r.clientId === id);
    return { id, name: plat(id), n: rs.length, collected: sum(rs.map((r) => r.collected)), handed: sum(rs.map((r) => r.handedOver ?? 0)), sf: sum(rs.map(short)) };
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Cash Collection" description="Cash on delivery collected per driver per day, what was handed over, and the shortfall." actions={!readOnly && <Button onClick={() => setSel("new")}><Plus /> Record collection</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Collected today" value={formatKD(sum(rows.filter((r) => r.date === TODAY).map((r) => r.collected)))} />
        <KpiCard label="Awaiting hand-over" value={rows.filter((r) => r.handedOver === null).length} tone="warn" />
        <KpiCard label="Shortfall this month" value={formatKD(sum(rows.filter((r) => r.date.startsWith(month)).map(short)))} tone="bad" />
        <KpiCard label="Queued for payroll" value={formatKD(sum(rows.filter((r) => r.deduction === "queued").map(short)))} hint="Deduction in the November run" />
      </KpiGrid>
      <Tabs tabs={[
        { id: "rows", label: "Collections", content: (
          <DataTable rows={shown} columns={cols} exportName="cash-collection" onRowClick={!readOnly ? setSel : undefined} pageSize={20}
            filters={<>
              <Select className="w-40" value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform"><option value="">All platforms</option>{[...new Set(rows.map((r) => r.clientId))].map((id) => <option key={id} value={id}>{plat(id)}</option>)}</Select>
              <Select className="w-44" value={only} onChange={(e) => setOnly(e.target.value)} aria-label="Show"><option value="">All rows</option><option value="short">With shortfall</option><option value="open">Awaiting hand-over</option><option value="queued">Queued for payroll</option></Select>
            </>} />) },
        { id: "plat", label: "Per platform", content: (
          <DataTable rows={byPlat} exportName="cash-per-platform" pageSize={10} columns={[
            { key: "name", header: "Platform" }, { key: "n", header: "Collections", align: "end" },
            { key: "collected", header: "Collected (KD)", align: "end", cell: (r) => formatKD(r.collected, { symbol: false }) },
            { key: "handed", header: "Handed over (KD)", align: "end", cell: (r) => formatKD(r.handed, { symbol: false }) },
            { key: "sf", header: "Shortfall (KD)", align: "end", cell: (r) => <Money v={-r.sf} /> },
          ]} />) },
      ]} />
      {sel && <CashSheet key={typeof sel === "string" ? sel : sel.id} row={sel} role={role} onClose={() => setSel(null)} />}
    </div>
  );
}

function CashSheet({ row, role, onClose }: { row: CashCollection | "new"; role: string; onClose: () => void }) {
  const actor = useActor();
  const ws = workers.useAll(), cl = clients.useAll();
  const isNew = row === "new";
  const cur = isNew ? undefined : row;
  const drivers = ws.filter((w) => w.roles.includes("driver") && w.currentClientId);
  const [f, setF] = useState({
    date: cur?.date ?? TODAY, workerId: cur?.workerId ?? drivers[0]?.id ?? "", collected: cur ? (cur.collected / 1000).toFixed(3) : "", handed: cur?.handedOver === null || !cur ? "" : (cur.handedOver / 1000).toFixed(3), reason: "",
  });
  const [loaded] = useState(cur?.version ?? 0);
  const [err, setErr] = useState("");
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const closed = cur?.deduction === "deducted";
  const submit = async (waive = false) => {
    const live = cur ? cashCollections.getSync(cur.id) : undefined;
    if (cur && (!live || live.version !== loaded)) return setErr("Conflict: this row was changed by someone else. Close and reopen.");
    if (closed) return setErr("The payroll period is closed. A correction must go through a payroll reopen with a reason.");
    const collected = parseKD(f.collected);
    const handed = f.handed.trim() === "" ? null : parseKD(f.handed);
    if (!Number.isFinite(collected) || collected <= 0) return setErr("Enter the amount collected in KD.");
    if (handed !== null && (!Number.isFinite(handed) || handed < 0)) return setErr("Handed-over amount is invalid.");
    if (handed !== null && handed > collected) return setErr("Handed over cannot exceed collected.");
    if (waive && !f.reason.trim()) return setErr("A reason is required to waive a deduction.");
    const worker = ws.find((w) => w.id === f.workerId);
    const sf = handed === null ? 0 : collected - handed;
    const next: CashCollection = {
      id: cur?.id ?? cashCollections.nextId("csh"), date: f.date, workerId: f.workerId, clientId: worker?.currentClientId ?? cur?.clientId ?? "", collected, handedOver: handed,
      deduction: waive ? "waived" : sf > 0 ? "queued" : "none", payrollPeriod: sf > 0 || waive ? f.date.slice(0, 7) : undefined, note: cur?.note, version: (cur?.version ?? 0) + 1,
    };
    await cashCollections.save(next);
    if (sf > 0 || waive) await writeAudit({ user: actor.name, role, entityType: "cash_collection", entityId: next.id, entityLabel: `${worker?.name ?? ""} ${f.date}`, action: waive ? "update" : isNew ? "create" : "update", summary: waive ? `Shortfall ${formatKD(sf)} waived` : `Shortfall ${formatKD(sf)} queued as payroll deduction`, reason: f.reason.trim() || "Automatic: shortfall on hand-over" });
    onClose();
  };
  const sfNow = f.handed.trim() === "" ? 0 : Math.max(0, (parseKD(f.collected) || 0) - (parseKD(f.handed) || 0));
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={isNew ? "Record collection" : "Hand-over"} description={cur ? `${ws.find((w) => w.id === cur.workerId)?.name}, ${cl.find((c) => c.id === cur.clientId)?.name}` : undefined} onSubmit={() => submit(false)}>
      {err && <Notice tone="bad">{err}</Notice>}
      {closed && <Notice tone="warn">This shortfall was deducted in the {cur?.payrollPeriod} payroll, which is closed.</Notice>}
      {isNew && <Field label="Driver"><Select value={f.workerId} onChange={(e) => set({ workerId: e.target.value })}>{drivers.map((w) => <option key={w.id} value={w.id}>{w.name} ({cl.find((c) => c.id === w.currentClientId)?.name})</option>)}</Select></Field>}
      <Field label="Date"><Input type="date" value={f.date} max={TODAY} onChange={(e) => set({ date: e.target.value })} disabled={!isNew} /></Field>
      <Field label="Collected (KD)"><Input inputMode="decimal" value={f.collected} onChange={(e) => set({ collected: e.target.value })} /></Field>
      <Field label="Handed over (KD)" hint="Leave blank until the driver hands the cash over."><Input inputMode="decimal" value={f.handed} onChange={(e) => set({ handed: e.target.value })} /></Field>
      {sfNow > 0 && <Notice tone="warn">Shortfall {formatKD(sfNow)} will be queued as a payroll deduction for {f.date.slice(0, 7)}.</Notice>}
      {!isNew && sfNow > 0 && (
        <>
          <Field label="Reason (needed only to waive)"><Textarea value={f.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
          <Button type="button" variant="outline" onClick={() => submit(true)}>Waive deduction</Button>
        </>
      )}
    </FormSheet>
  );
}
