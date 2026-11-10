"use client";

import { useMemo, useState } from "react";
import { Plus, Repeat, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select } from "@/components/app/fields";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { contracts } from "@/data/core";
import { fmtDate, overlaps, TODAY } from "@/lib/dates";
import { assignmentConflicts } from "@/data/ops/conflicts";
import { contractInForce } from "@/data/ops/revenue";
import { assignments, audit, logAudit } from "@/data/ops/store";
import type { Assignment } from "@/data/ops/types";
import type { ScreenProps } from "../types";
import { AssignmentForm } from "./AssignmentForm";
import { Notice, ReasonSheet, useActor, useNames } from "./shared";

const stateOf = (a: Assignment) => (a.to && a.to < TODAY ? "ended" : a.from > TODAY ? "upcoming" : "current");

export default function AssignmentsScreen({ readOnly, editedBy }: ScreenProps) {
  const names = useNames();
  const actor = useActor();
  const all = assignments.useAll();
  const cons = contracts.useAll();
  const auditLog = audit.useAll().filter((a) => a.entity === "assignment");
  const [form, setForm] = useState<{ a: Assignment | null; sub: boolean } | null>(null);
  const [ending, setEnding] = useState<Assignment | null>(null);
  const [endDate, setEndDate] = useState(TODAY);
  const [client, setClient] = useState("");
  const [state, setState] = useState("");
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [resolveW, setResolveW] = useState("");
  const [resolveD, setResolveD] = useState(TODAY);

  const conflictIds = useMemo(() => new Set(all.filter((a) => assignmentConflicts(all, a).length).map((a) => a.id)), [all]);
  const rows = all.filter((a) => (!client || a.clientId === client) && (!state || stateOf(a) === state) && (!onlyConflicts || conflictIds.has(a.id))).sort((a, b) => b.from.localeCompare(a.from));
  const inEffect = resolveW ? all.filter((a) => a.workerId === resolveW && overlaps(a.from, a.to, resolveD, resolveD)) : [];

  const cols: Column<Assignment>[] = [
    { key: "worker", header: "Worker", value: (a) => names.worker(a.workerId), cell: (a) => <span className="font-medium">{names.worker(a.workerId)}</span> },
    { key: "client", header: "Client", value: (a) => names.client(a.clientId) },
    { key: "place", header: "Store / site", value: (a) => a.place ?? "" },
    { key: "vehicle", header: "Vehicle", value: (a) => (a.vehicleId ? names.plate(a.vehicleId) : "") },
    { key: "from", header: "From", cell: (a) => fmtDate(a.from) },
    { key: "to", header: "To (inclusive)", value: (a) => a.to ?? "", cell: (a) => (a.to ? fmtDate(a.to) : "Open") },
    { key: "shift", header: "Shift" },
    { key: "kind", header: "Type", cell: (a) => a.kind === "substitution" ? <StatusBadge tone="info">Covers {names.worker(a.substitutesWorkerId)}</StatusBadge> : "Regular" },
    { key: "owner", header: "Contract-owning co.", value: (a) => a.ownerCompanyId, cell: (a) => (a.ownerCompanyId === "cmp-ithc" ? "ITHC Logistics" : a.ownerCompanyId) },
    { key: "state", header: "State", value: stateOf, cell: (a) => <StatusBadge tone={stateOf(a) === "current" ? "good" : stateOf(a) === "ended" ? "neutral" : "info"}>{stateOf(a)}</StatusBadge> },
    { key: "flag", header: "Flags", value: (a) => (conflictIds.has(a.id) ? "overlap" : ""), cell: (a) => (conflictIds.has(a.id) ? <StatusBadge tone="bad">Overlap</StatusBadge> : null) },
    ...(!readOnly ? [{ key: "act", header: "", sortable: false, cell: (a: Assignment) => (!a.to || a.to >= TODAY ? <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setEnding(a); setEndDate(TODAY); }}><StopCircle /> End</Button> : null) }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assignments"
        description="Driver-to-client assignments are time-bounded records with inclusive end dates."
        actions={!readOnly && <><Button variant="outline" onClick={() => setForm({ a: null, sub: true })}><Repeat /> Substitution</Button><Button onClick={() => setForm({ a: null, sub: false })}><Plus /> New assignment</Button></>}
      />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {conflictIds.size > 0 && <Notice tone="warn">{conflictIds.size} assignment(s) overlap another (same worker, or one vehicle for two workers in the same window). Overlaps are shown, never auto-resolved.</Notice>}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <Field label="Which assignment applied to…"><Select value={resolveW} onChange={(e) => setResolveW(e.target.value)} className="w-56"><option value="">Select worker</option>{names.workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
        <Field label="…on date"><Input type="date" value={resolveD} onChange={(e) => setResolveD(e.target.value)} className="w-40" /></Field>
        <div className="text-sm">
          {resolveW && (inEffect.length === 0 ? <span className="text-muted-foreground">No assignment in effect on that date.</span> : inEffect.map((a) => (
            <div key={a.id}>Payroll and revenue use <b>{names.client(a.clientId)}</b>, contract {contractInForce(cons, a.clientId, resolveD)?.contractNo ?? "none"} v{contractInForce(cons, a.clientId, resolveD)?.version ?? "-"} ({a.kind}).</div>
          )))}
        </div>
      </div>
      <DataTable
        rows={rows} columns={cols} exportName="assignments" onRowClick={(a) => setForm({ a, sub: a.kind === "substitution" })} pageSize={15}
        filters={<>
          <Select value={client} onChange={(e) => setClient(e.target.value)} className="w-40"><option value="">All clients</option>{names.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select value={state} onChange={(e) => setState(e.target.value)} className="w-36"><option value="">All states</option><option>current</option><option>ended</option><option>upcoming</option></Select>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={onlyConflicts} onChange={(e) => setOnlyConflicts(e.target.checked)} /> Overlaps only</label>
        </>}
        rowClassName={(a) => (conflictIds.has(a.id) ? "bg-red-50/70" : undefined)}
      />
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Assignment audit trail</h2>
        {auditLog.length === 0 ? <p className="text-sm text-muted-foreground">No mutations yet.</p> : (
          <ul className="space-y-1 text-sm">{[...auditLog].reverse().slice(0, 8).map((a) => <li key={a.id}><span className="text-muted-foreground">{a.at}</span> · {a.actor} · <b>{a.action}</b> {a.entityId} · {a.detail}{a.reason ? ` · reason: ${a.reason}` : ""}</li>)}</ul>
        )}
      </div>
      {form && !readOnly && <AssignmentForm key={form.a?.id ?? "new"} open onClose={() => setForm(null)} initial={form.a} substitution={form.sub} />}
      {ending && (
        <ReasonSheet open onOpenChange={(o) => !o && setEnding(null)} title="End assignment" description={`${names.worker(ending.workerId)} at ${names.client(ending.clientId)}`}
          onConfirm={async (reason) => {
            if (endDate < ending.from) return;
            await assignments.save({ ...ending, to: endDate, version: ending.version + 1 });
            await logAudit({ actor, entity: "assignment", entityId: ending.id, action: "end", reason, detail: `Ended on ${endDate} (inclusive)` });
            setEnding(null);
          }}>
          <Field label="Last day (inclusive)"><Input type="date" value={endDate} min={ending.from} onChange={(e) => setEndDate(e.target.value)} /></Field>
        </ReasonSheet>
      )}
    </div>
  );
}
