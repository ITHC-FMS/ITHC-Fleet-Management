"use client";

import { Plus, Upload } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { prettify, StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { clients, locations, vehicles, workers } from "@/data/core";
import { costRecords, writeAudit, type CostRecord, type CostTarget, type CostType } from "@/data/commercial";
import { COST_TYPES } from "@/data/commercial/seed";
import { sum } from "@/data/commercial/engine";
import { fmtDate, TODAY } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import { Notice, useActor } from "./ui";

const TARGETS: CostTarget[] = ["vehicle", "worker", "client", "property", "company"];

export default function CostsScreen({ role }: { role: string }) {
  const rows = costRecords.useAll();
  const vs = vehicles.useAll(), ws = workers.useAll(), cl = clients.useAll(), ls = locations.useAll();
  const [type, setType] = useState(""), [target, setTarget] = useState(""), [month, setMonth] = useState("");
  const [sel, setSel] = useState<CostRecord | "new" | null>(null);
  const [imp, setImp] = useState(false);
  const refName = (c: CostRecord) => c.target === "vehicle" ? vs.find((v) => v.id === c.refId)?.plate : c.target === "worker" ? ws.find((w) => w.id === c.refId)?.name : c.target === "client" ? cl.find((x) => x.id === c.refId)?.name : c.target === "property" ? ls.find((l) => l.id === c.refId)?.name : "ITHC Logistics";
  const shown = rows.filter((r) => (!type || r.type === type) && (!target || r.target === target) && (!month || r.date.startsWith(month))).sort((a, b) => (a.date < b.date ? 1 : -1));
  const cols: Column<CostRecord>[] = [
    { key: "date", header: "Date", cell: (r) => fmtDate(r.date) }, { key: "type", header: "Type", cell: (r) => prettify(r.type) },
    { key: "attr", header: "Attributed to", value: (r) => `${r.target}: ${refName(r) ?? r.refId}`, cell: (r) => <span><StatusBadge className="me-1">{r.target}</StatusBadge>{refName(r) ?? r.refId}</span> },
    { key: "amount", header: "Amount (KD)", align: "end", cell: (r) => formatKD(r.amount, { symbol: false }) }, { key: "notes", header: "Notes" },
  ];
  const mo = TODAY.slice(0, 7);
  return (
    <div className="space-y-4">
      <PageHeader title="Costs" description="Operational costs attributed to a vehicle, worker, client, property or the company. They feed margin and TCO."
        actions={<><Button variant="outline" onClick={() => setImp(true)}><Upload /> Import</Button><Button onClick={() => setSel("new")}><Plus /> Add cost</Button></>} />
      <KpiGrid>
        <KpiCard label="Costs this month" value={formatKD(sum(rows.filter((r) => r.date.startsWith(mo)).map((r) => r.amount)))} />
        <KpiCard label="Vehicle-attributed (all)" value={formatKD(sum(rows.filter((r) => r.target === "vehicle").map((r) => r.amount)))} />
        <KpiCard label="Fines borne by company" value={formatKD(sum(rows.filter((r) => r.type === "fine").map((r) => r.amount)))} tone="warn" />
        <KpiCard label="Records" value={rows.length} />
      </KpiGrid>
      <DataTable rows={shown} columns={cols} exportName="costs" onRowClick={setSel} pageSize={20}
        filters={<>
          <Select className="w-40" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">All types</option>{COST_TYPES.map((t) => <option key={t} value={t}>{prettify(t)}</option>)}</Select>
          <Select className="w-36" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Attribution"><option value="">All targets</option>{TARGETS.map((t) => <option key={t}>{t}</option>)}</Select>
          <Input className="w-36" type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
        </>} />
      {sel && <CostSheet key={typeof sel === "string" ? sel : sel.id} row={sel} role={role} onClose={() => setSel(null)} />}
      {imp && <ImportSheet role={role} onClose={() => setImp(false)} />}
    </div>
  );
}

function RefSelect({ target, value, onChange }: { target: CostTarget; value: string; onChange: (v: string) => void }) {
  const vs = vehicles.useAll(), ws = workers.useAll(), cl = clients.useAll(), ls = locations.useAll();
  if (target === "company") return <Input disabled value="ITHC Logistics (whole company)" />;
  const opts: [string, string][] = target === "vehicle" ? vs.map((v) => [v.id, `${v.plate} ${v.make} ${v.model}`]) : target === "worker" ? ws.map((w) => [w.id, `${w.name} (${w.username})`]) : target === "client" ? cl.map((c) => [c.id, c.name]) : ls.filter((l) => l.kind === "housing" || l.kind === "operating_building").map((l) => [l.id, l.name]);
  return <Select value={value} onChange={(e) => onChange(e.target.value)}><option value="">Select…</option>{opts.map(([i, l]) => <option key={i} value={i}>{l}</option>)}</Select>;
}

function CostSheet({ row, role, onClose }: { row: CostRecord | "new"; role: string; onClose: () => void }) {
  const actor = useActor();
  const cur = row === "new" ? undefined : row;
  const [f, setF] = useState({ date: cur?.date ?? TODAY, type: cur?.type ?? ("maintenance" as CostType), target: cur?.target ?? ("vehicle" as CostTarget), refId: cur?.refId ?? "", amount: cur ? (cur.amount / 1000).toFixed(3) : "", notes: cur?.notes ?? "" });
  const [err, setErr] = useState("");
  const submit = async () => {
    const amount = parseKD(f.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setErr("Enter a positive amount in KD.");
    if (f.target !== "company" && !f.refId) return setErr("Choose what the cost is attributed to.");
    if (f.date > TODAY) return setErr("The cost date cannot be in the future.");
    const next: CostRecord = { id: cur?.id ?? costRecords.nextId("cst"), date: f.date, type: f.type, target: f.target, refId: f.target === "company" ? "" : f.refId, amount, notes: f.notes.trim() || undefined };
    await costRecords.save(next);
    await writeAudit({ user: actor.name, role, entityType: "cost", entityId: next.id, entityLabel: `${prettify(next.type)} ${formatKD(amount)}`, action: cur ? "update" : "create", summary: `${prettify(next.type)} attributed to ${next.target}`, reason: f.notes.trim() || "Cost entry", before: cur ? formatKD(cur.amount) : undefined, after: cur ? formatKD(amount) : undefined });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={cur ? "Edit cost" : "Add cost"} onSubmit={submit}>
      {err && <Notice tone="bad">{err}</Notice>}
      <Field label="Date"><Input type="date" value={f.date} max={TODAY} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      <Field label="Cost type" hint="Recurring rental and instalment charges come from the vehicle's monthly cost; use those types here only for extra charges."><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as CostType })}>{COST_TYPES.map((t) => <option key={t} value={t}>{prettify(t)}</option>)}</Select></Field>
      <Field label="Attributed to"><Select value={f.target} onChange={(e) => setF({ ...f, target: e.target.value as CostTarget, refId: "" })}>{TARGETS.map((t) => <option key={t} value={t}>{prettify(t)}</option>)}</Select></Field>
      <Field label="Record"><RefSelect target={f.target} value={f.refId} onChange={(v) => setF({ ...f, refId: v })} /></Field>
      <Field label="Amount (KD)"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
      <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </FormSheet>
  );
}

function ImportSheet({ role, onClose }: { role: string; onClose: () => void }) {
  const actor = useActor();
  const [text, setText] = useState("date,type,target,ref,amount_kd,notes\n2026-11-05,maintenance,vehicle,veh-0004,35.500,Wiper replacement\n");
  const [err, setErr] = useState("");
  const submit = async () => {
    const lines = text.trim().split(/\r?\n/).slice(1).filter(Boolean);
    const out: CostRecord[] = [];
    const base = Number((costRecords.nextId("cst")).split("-").pop());
    for (const [i, line] of lines.entries()) {
      const [date, type, target, ref, amt, ...notes] = line.split(",").map((x) => x.trim());
      const amount = parseKD(amt ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !COST_TYPES.includes(type as CostType) || !TARGETS.includes(target as CostTarget) || !Number.isFinite(amount) || amount <= 0) return setErr(`Row ${i + 2} is invalid: ${line}`);
      out.push({ id: `cst-${String(base + i).padStart(4, "0")}`, date, type: type as CostType, target: target as CostTarget, refId: ref ?? "", amount, notes: notes.join(",") || undefined });
    }
    if (!out.length) return setErr("No rows to import.");
    await costRecords.saveMany(out);
    await writeAudit({ user: actor.name, role, entityType: "cost", entityId: "import", entityLabel: "Spreadsheet import", action: "create", summary: `${out.length} cost rows imported`, reason: "Bulk import from spreadsheet" });
    onClose();
  };
  return (
    <FormSheet wide open onOpenChange={(o) => !o && onClose()} title="Import costs" description="Paste rows copied from a spreadsheet as CSV. Types: rental_charge, instalment, maintenance, fuel, fine, accommodation, insurance, other. Targets: vehicle, worker, client, property, company." onSubmit={submit} submitLabel="Import rows">
      {err && <Notice tone="bad">{err}</Notice>}
      <input type="file" accept=".csv,text/csv,text/plain" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
      <Textarea className="min-h-56 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
    </FormSheet>
  );
}
