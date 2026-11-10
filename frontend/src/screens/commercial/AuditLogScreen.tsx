"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Input, Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { auditLog, type AuditEntry } from "@/data/commercial";

const ACTION_TONE = { create: "good", update: "info", delete: "bad", approve: "good", decline: "bad", override: "warn", reopen: "warn" } as const;

export default function AuditLogScreen() {
  const all = auditLog.useAll();
  const [type, setType] = useState("");
  const [role, setRole] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<AuditEntry | null>(null);
  const uniq = (f: (e: AuditEntry) => string) => [...new Set(all.map(f))].sort();
  const rows = all.filter((e) => (!type || e.entityType === type) && (!role || e.role === role) && (!action || e.action === action) && (!from || e.at.slice(0, 10) >= from) && (!to || e.at.slice(0, 10) <= to));
  const cols: Column<AuditEntry>[] = [
    { key: "at", header: "When" }, { key: "user", header: "User", value: (e) => `${e.user} (${e.role})` },
    { key: "entity", header: "Entity", value: (e) => `${e.entityType} ${e.entityLabel}`, cell: (e) => <div><div className="text-xs text-muted-foreground">{prettify(e.entityType)} {e.entityId}</div>{e.entityLabel}</div> },
    { key: "action", header: "Action", cell: (e) => <StatusBadge tone={ACTION_TONE[e.action]}>{e.action}</StatusBadge> },
    { key: "summary", header: "Change" }, { key: "reason", header: "Reason" },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Audit Log" description="Who changed what, when and why. Entries are append-only." />
      <DataTable rows={rows} columns={cols} exportName="audit-log" onRowClick={setSel} searchPlaceholder="Search user, entity, reason…"
        filters={<>
          <Select className="w-40" value={type} onChange={(e) => setType(e.target.value)} aria-label="Entity type"><option value="">All entities</option>{uniq((e) => e.entityType).map((x) => <option key={x} value={x}>{prettify(x)}</option>)}</Select>
          <Select className="w-36" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="">All roles</option>{uniq((e) => e.role).map((x) => <option key={x}>{x}</option>)}</Select>
          <Select className="w-32" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action"><option value="">All actions</option>{uniq((e) => e.action).map((x) => <option key={x}>{x}</option>)}</Select>
          <Input className="w-36" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <Input className="w-36" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </>} />
      <FormSheet open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={sel ? `${prettify(sel.entityType)}: ${sel.entityLabel}` : ""} description={sel ? `${sel.at} by ${sel.user} (${sel.role})` : ""} hideSubmit>
        {sel && (
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Change</dt><dd>{sel.summary}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Reason</dt><dd>{sel.reason}</dd></div>
            <div className="grid grid-cols-2 gap-2"><div className="rounded border p-2"><dt className="text-xs text-muted-foreground">Before</dt><dd>{sel.before ?? "-"}</dd></div><div className="rounded border p-2"><dt className="text-xs text-muted-foreground">After</dt><dd>{sel.after ?? "-"}</dd></div></div>
            <div><dt className="text-xs text-muted-foreground">Record</dt><dd>{sel.entityType} {sel.entityId}</dd></div>
          </dl>
        )}
      </FormSheet>
    </div>
  );
}
