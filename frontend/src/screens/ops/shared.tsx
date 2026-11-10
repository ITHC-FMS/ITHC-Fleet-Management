"use client";

import { useMemo, useState, type ReactNode } from "react";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Textarea } from "@/components/app/fields";
import { useSession } from "@/lib/auth";
import { clients, vehicles } from "@/data/core";
import { useById } from "@/components/app/lookup";
import { useWorkerView } from "@/data/ops/store";
import { cn } from "@/lib/utils";

export const useActor = () => useSession()?.name ?? "Demo user";

/** Name lookups used by almost every table. */
export function useNames() {
  const ws = useWorkerView();
  const cs = clients.useAll();
  const vs = vehicles.useAll();
  const wById = useById(ws), cById = useById(cs), vById = useById(vs);
  return useMemo(() => ({
    workers: ws, clients: cs, vehicles: vs,
    worker: (id?: string) => (id ? wById.get(id)?.name ?? id : "—"),
    client: (id?: string) => (id ? cById.get(id)?.name ?? id : "—"),
    plate: (id?: string) => (id ? vById.get(id)?.plate ?? id : "—"),
    wById, cById, vById,
  }), [ws, cs, vs, wById, cById, vById]);
}

export function downloadFile(name: string, content: string, mime = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
export const csvOf = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

/** Minimal CSV/TSV parser with quoted fields. */
export function parseDelimited(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = first.includes("\t") ? "\t" : first.split(";").length > first.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((c) => c.trim())) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "bad" | "good" | "info"; children: ReactNode }) {
  const t = { warn: "border-amber-300 bg-amber-50 text-amber-900", bad: "border-red-300 bg-red-50 text-red-900", good: "border-emerald-300 bg-emerald-50 text-emerald-900", info: "border-sky-300 bg-sky-50 text-sky-900" }[tone];
  return <div className={cn("rounded-md border px-3 py-2 text-sm", t)}>{children}</div>;
}

/** Slide-over that demands a free-text reason before it will submit (audit-logged actions). */
export function ReasonSheet({ open, onOpenChange, title, description, submitLabel, onConfirm, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; submitLabel?: string;
  onConfirm: (reason: string) => void | Promise<void>; children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  return (
    <FormSheet
      open={open} onOpenChange={(o) => { if (!o) { setReason(""); setErr(""); } onOpenChange(o); }}
      title={title} description={description} submitLabel={submitLabel ?? "Confirm"}
      onSubmit={async () => {
        if (reason.trim().length < 5) return setErr("A reason of at least 5 characters is required.");
        await onConfirm(reason.trim());
        setReason(""); setErr("");
      }}
    >
      {children}
      <Field label="Reason (mandatory, written to the audit log)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this change being made?" /></Field>
      {err && <Notice tone="bad">{err}</Notice>}
    </FormSheet>
  );
}

export const chipBtn = "rounded-md border px-2 py-1 text-xs hover:bg-muted";
export const lbl = "text-xs text-muted-foreground";
