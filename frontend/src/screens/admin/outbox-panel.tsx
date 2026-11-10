"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { StatusBadge } from "@/components/app/status-badge";
import { emailOutbox, type OutboxEmail } from "@/data/admin";
import { Notice } from "./shared";

/** Simulated email outbox: nothing is really sent in demo mode. */
export function OutboxPanel({ kind, role }: { kind?: OutboxEmail["kind"]; role?: string }) {
  const all = emailOutbox.useAll();
  const rows = all
    .filter((e) => (!kind || e.kind === kind) && (!role || e.recipientRole === role))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id.localeCompare(a.id));
  const [open, setOpen] = useState<OutboxEmail | null>(null);
  const cols: Column<OutboxEmail>[] = [
    { key: "sentAt", header: "Sent" },
    { key: "to", header: "To" },
    { key: "kind", header: "Type", cell: (r) => <StatusBadge tone={r.kind === "alert" ? "warn" : "info"}>{r.kind}</StatusBadge> },
    { key: "subject", header: "Subject", className: "min-w-64 whitespace-normal" },
    { key: "status", header: "Status", cell: (r) => <StatusBadge>{r.status === "simulated_sent" ? "Sent (simulated)" : "Queued"}</StatusBadge> },
  ];
  return (
    <div className="space-y-3">
      <Notice>Demo mode: emails are not delivered. This outbox shows exactly what the live system would send.</Notice>
      <DataTable rows={rows} columns={cols} onRowClick={setOpen} exportName="email-outbox" searchPlaceholder="Search emails" empty="No emails in the outbox." />
      <FormSheet open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.subject ?? ""} description={open ? `To ${open.to}, ${open.sentAt}` : undefined} hideSubmit>
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{open?.body}</pre>
      </FormSheet>
    </div>
  );
}
