"use client";

import { useState, type ReactNode } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { adminAudit, type AdminAuditEntry } from "@/data/admin";
import { useSession } from "@/lib/auth";

/** Name of the signed-in demo user, for audit "who". */
export function useActor() {
  const s = useSession();
  return s?.name ?? "Mariam Al-Hajri";
}

export function Notice({ tone = "info", children }: { tone?: "info" | "good" | "bad" | "warn"; children: ReactNode }) {
  const cls = {
    info: "border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    good: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    bad: "border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200",
    warn: "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  }[tone];
  return <div role={tone === "bad" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function Section({ title, hint, children, actions }: { title: string; hint?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Message helper: a transient banner state. */
export function useBanner() {
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null);
  return { msg, ok: (text: string) => setMsg({ tone: "good", text }), err: (text: string) => setMsg({ tone: "bad", text }), clear: () => setMsg(null) };
}

/** Audit trail table, optionally filtered to an entity kind and id. */
export function AuditTrail({ entity, entityId }: { entity?: AdminAuditEntry["entity"]; entityId?: string }) {
  const all = adminAudit.useAll();
  const rows = all
    .filter((a) => (!entity || a.entity === entity) && (!entityId || a.entityId === entityId))
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const cols: Column<AdminAuditEntry>[] = [
    { key: "at", header: "When" },
    { key: "actor", header: "User" },
    { key: "entity", header: "Entity", cell: (r) => <StatusBadge>{r.entity}</StatusBadge> },
    { key: "entityId", header: "Record" },
    { key: "action", header: "Action" },
    { key: "detail", header: "Detail", className: "min-w-64 whitespace-normal" },
    { key: "reason", header: "Reason", className: "min-w-48 whitespace-normal" },
  ];
  return <DataTable rows={rows} columns={cols} exportName={`audit-${entity ?? "all"}`} searchPlaceholder="Search audit entries" empty="No audit entries." />;
}

/** Optimistic lock: true when the stored record still has the version the form was opened with. */
export const stillCurrent = (stored: { version: number } | undefined, openedAt: number) => !!stored && stored.version === openedAt;
export const CONFLICT = "This record was changed by someone else since you opened it. Close the form and reopen it to see the latest version.";
