"use client";

import { Check, Circle } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { importJobs, type ImportJob } from "@/data/admin";
import { formatKD } from "@/lib/money";
import { ImportWizard, Reconciliation } from "./import/wizard";
import { SPECS, specOf } from "./import/specs";
import { Notice, Section } from "./shared";

export default function GoLiveImportScreen() {
  const jobs = importJobs.useAll();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<ImportJob | null>(null);
  const committed = new Set(jobs.filter((j) => j.status === "committed").map((j) => j.sheet));
  const errorTotal = jobs.filter((j) => j.status !== "committed").reduce((s, j) => s + j.errorRows, 0);
  const advances = jobs.filter((j) => j.sheet === "advances" && j.status === "committed").reduce((s, j) => s + (j.openingBalances ?? 0), 0);

  const cols: Column<ImportJob>[] = [
    { key: "sheet", header: "Sheet", value: (j) => specOf(j.sheet).label },
    { key: "fileName", header: "File" },
    { key: "uploadedAt", header: "Uploaded" },
    { key: "sourceRows", header: "Rows", align: "end" },
    { key: "validRows", header: "Valid", align: "end" },
    { key: "errorRows", header: "Errors", align: "end", cell: (j) => <span className={j.errorRows ? "font-semibold text-red-600" : ""}>{j.errorRows}</span> },
    { key: "status", header: "Status", cell: (j) => <StatusBadge tone={j.status === "committed" ? "good" : j.errorRows ? "bad" : "warn"}>{j.status === "committed" ? "Applied" : j.errorRows ? "Validated, has errors" : "Validated, not applied"}</StatusBadge> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Go-Live Data Import" description="One-off load of the existing Excel sheets. Staged: upload, map, validate, preview, then apply." actions={<Button onClick={() => setOpen(true)}>Upload sheet</Button>} />
      <KpiGrid>
        <KpiCard label="Sheets applied" value={`${committed.size} / ${SPECS.length}`} />
        <KpiCard label="Rows applied" value={jobs.filter((j) => j.status === "committed").reduce((s, j) => s + j.appliedRows, 0)} />
        <KpiCard label="Open error rows" value={errorTotal} tone={errorTotal ? "bad" : "good"} />
        <KpiCard label="Opening advances" value={formatKD(advances)} hint="Balances still owed" />
      </KpiGrid>
      <Section title="Load order" hint="Each stage must be applied before the next. Documents come with workers and vehicles.">
        <ol className="grid gap-2 sm:grid-cols-3">
          {([1, 2, 3] as const).map((t) => (
            <li key={t} className="rounded-md border p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Stage {t}</p>
              {SPECS.filter((s) => s.tier === t).map((s) => <p key={s.id} className="flex items-center gap-2">{committed.has(s.id) ? <Check className="size-4 text-emerald-600" /> : <Circle className="size-4 text-muted-foreground" />}{s.label}</p>)}
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Vehicles marked ITHC-owned are prefilled as in-house (cash) vehicles.</p>
      </Section>
      {open && <ImportWizard jobs={jobs} onClose={() => setOpen(false)} />}
      <DataTable rows={[...jobs].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))} columns={cols} onRowClick={setSel} exportName="import-jobs" searchPlaceholder="Search loads" empty="No sheets uploaded yet." />
      <FormSheet open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={sel ? specOf(sel.sheet).label : ""} description={sel?.fileName} hideSubmit wide>
        {sel && (
          <div className="space-y-3">
            <Reconciliation job={sel} sheet={sel.sheet} />
            {sel.errors.length > 0 ? <ul className="divide-y rounded-lg border text-sm">{sel.errors.map((e) => <li key={e.row} className="px-3 py-1.5"><span className="font-medium">Row {e.row}</span> ({e.key}): {e.messages.join("; ")}</li>)}</ul> : <Notice tone="good">No error rows.</Notice>}
            {sel.status !== "committed" && <Notice tone="warn">Not applied. Upload the corrected sheet to repeat the load.</Notice>}
          </div>
        )}
      </FormSheet>
    </div>
  );
}
