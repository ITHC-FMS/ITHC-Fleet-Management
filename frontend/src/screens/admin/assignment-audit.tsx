"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Input, Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { clients, vehicles, workers } from "@/data/core";
import { assignmentAudit, type AssignmentAuditEntry } from "@/data/admin";
import { fmtDate } from "@/lib/dates";
import { Notice } from "./shared";

const TYPE: Record<AssignmentAuditEntry["type"], string> = {
  driver_client: "Driver-client", driver_vehicle: "Driver-vehicle", labour_placement: "Labour placement", housing_occupancy: "Housing occupancy",
};

export default function AssignmentAuditScreen() {
  const entries = assignmentAudit.useAll();
  const ws = workers.useAll();
  const vs = vehicles.useAll();
  const cs = clients.useAll();
  const [f, setF] = useState({ worker: "", vehicle: "", client: "", from: "", to: "", type: "" });
  const [sel, setSel] = useState<AssignmentAuditEntry | null>(null);
  const wName = (id?: string) => ws.find((w) => w.id === id)?.name;
  const vPlate = (id?: string) => vs.find((v) => v.id === id)?.plate;

  const rows = useMemo(() => entries.filter((e) =>
    (!f.worker || e.workerId === f.worker) && (!f.vehicle || e.vehicleId === f.vehicle) && (!f.client || e.clientId === f.client) &&
    (!f.type || e.type === f.type) && (!f.from || e.at.slice(0, 10) >= f.from) && (!f.to || e.at.slice(0, 10) <= f.to),
  ).sort((a, b) => b.at.localeCompare(a.at)), [entries, f]);

  const cols: Column<AssignmentAuditEntry>[] = [
    { key: "at", header: "When" },
    { key: "user", header: "User" },
    { key: "type", header: "Type", value: (e) => TYPE[e.type], cell: (e) => <StatusBadge tone="info">{TYPE[e.type]}</StatusBadge> },
    { key: "who", header: "Worker / vehicle", value: (e) => [wName(e.workerId), vPlate(e.vehicleId)].filter(Boolean).join(" / ") },
    { key: "client", header: "Client", value: (e) => cs.find((c) => c.id === e.clientId)?.name ?? "—" },
    { key: "change", header: "Change", className: "min-w-72 whitespace-normal" },
    { key: "period", header: "Payroll period", value: (e) => `${e.payrollPeriod}${e.periodClosed ? " (closed)" : ""}`, cell: (e) => e.periodClosed ? <StatusBadge tone="warn">{e.payrollPeriod} closed</StatusBadge> : <span>{e.payrollPeriod}</span> },
    { key: "reason", header: "Reason", className: "min-w-48 whitespace-normal" },
  ];
  const retro = entries.filter((e) => e.periodClosed).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Assignment Audit Log" description="Every change to a driver-client, driver-vehicle, labour placement or housing occupancy assignment." />
      <KpiGrid>
        <KpiCard label="Entries" value={entries.length} />
        <KpiCard label="Shown" value={rows.length} />
        <KpiCard label="Touching a closed period" value={retro} tone={retro ? "warn" : "default"} hint="Corrections posted forward, closed payroll untouched" />
        <KpiCard label="Users" value={new Set(entries.map((e) => e.user)).size} />
      </KpiGrid>
      <DataTable
        rows={rows} columns={cols} onRowClick={setSel} exportName="assignment-audit" searchPlaceholder="Search the log"
        rowClassName={(e) => (e.periodClosed ? "bg-amber-50/50 dark:bg-amber-950/20" : undefined)}
        filters={<>
          <Select className="w-44" aria-label="Worker" value={f.worker} onChange={(e) => setF({ ...f, worker: e.target.value })}><option value="">All workers</option>{ws.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.id})</option>)}</Select>
          <Select className="w-36" aria-label="Vehicle" value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })}><option value="">All vehicles</option>{vs.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}</Select>
          <Select className="w-36" aria-label="Client" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })}><option value="">All clients</option>{cs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select className="w-40" aria-label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">All types</option>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Input className="w-36" type="date" aria-label="From" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          <Input className="w-36" type="date" aria-label="To" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </>}
      />
      <FormSheet open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={sel ? TYPE[sel.type] : ""} description={sel?.at} hideSubmit>
        {sel && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{sel.change}</p>
            <dl className="grid grid-cols-2 gap-2">
              <div><dt className="text-xs text-muted-foreground">Changed by</dt><dd>{sel.user}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Reason</dt><dd>{sel.reason}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Effective from</dt><dd>{fmtDate(sel.effectiveFrom)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Effective to (inclusive)</dt><dd>{sel.effectiveTo ? fmtDate(sel.effectiveTo) : "Open ended"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Worker</dt><dd>{wName(sel.workerId) ?? "—"} {sel.workerId}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Vehicle</dt><dd>{vPlate(sel.vehicleId) ?? "—"}</dd></div>
            </dl>
            {sel.periodClosed && <Notice tone="warn">Payroll period {sel.payrollPeriod} is closed. {sel.handling}</Notice>}
          </div>
        )}
      </FormSheet>
    </div>
  );
}
