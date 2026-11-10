"use client";

import { Download, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Select } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { auditMany, importJobs, stamp, type ImportJob, type ImportSheet } from "@/data/admin";
import { formatKD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Notice, Section, useActor } from "../shared";
import { apply, mapRows, primeExisting, validate, type Row, type Validation } from "./engine";
import { SPECS, autoMap, parseCsv, specOf, toCsv } from "./specs";

const STEPS = ["Upload", "Map columns", "Validate and preview", "Apply and reconcile"];
const money = (spec: ReturnType<typeof specOf>, n: number) => (spec.amountKey ? formatKD(n) : String(n));

export function ImportWizard({ jobs, onClose }: { jobs: ImportJob[]; onClose: () => void }) {
  const actor = useActor();
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState<ImportSheet>("workers");
  const [file, setFile] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [body, setBody] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [val, setVal] = useState<Validation | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [jobId, setJobId] = useState("");
  const [done, setDone] = useState<{ applied: number } | null>(null);
  const [err, setErr] = useState("");
  const spec = specOf(sheet);

  const committed = new Set(jobs.filter((j) => j.status === "committed").map((j) => j.sheet));
  const missing = SPECS.filter((s) => s.tier < spec.tier && !committed.has(s.id));

  const load = (text: string, name: string) => {
    const t = parseCsv(text);
    if (t.length < 2) return setErr("The file has no data rows.");
    setErr(""); setFile(name); setHeader(t[0]); setBody(t.slice(1)); setMap(autoMap(spec, t[0])); setVal(null); setDone(null); setStep(1);
  };
  const useSample = () => load(toCsv(spec.sample()), `${spec.id}_sample.csv`);
  const onFile = async (f?: File) => {
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) return setErr("Demo mode reads CSV only. In Excel use Save As > CSV, then upload the CSV.");
    load(await f.text(), f.name);
  };

  const unmapped = spec.fields.filter((f) => f.required && !map[f.key]);
  const runValidate = async () => {
    await primeExisting();
    const mapped = mapRows(spec, header, body, map);
    const v = validate(spec, mapped);
    setRows(mapped); setVal(v); setStep(2);
    const id = jobId || `imp-${String(Math.max(0, ...jobs.map((j) => Number(j.id.split("-").pop()) || 0)) + 1).padStart(4, "0")}`;
    setJobId(id);
    const total = spec.amountKey ? v.amountTotal + v.rejectedTotal : mapped.length;
    await importJobs.save({
      id, sheet, fileName: file, uploadedAt: stamp(), sourceRows: mapped.length, validRows: v.valid.length, errorRows: v.errors.length, sourceTotal: total,
      appliedTotal: 0, appliedRows: 0, status: "validated", errors: v.errors, openingBalances: sheet === "advances" ? v.amountTotal : undefined, version: 1,
    });
  };

  const errorReport = () => {
    if (!val) return;
    const cols = spec.fields.map((f) => f.key);
    const out = [["source_row", "key", "problems", ...cols], ...val.errors.map((e) => [String(e.row), e.key, e.messages.join("; "), ...cols.map((c) => e.raw[c] ?? "")])];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(out)], { type: "text/csv" }));
    a.download = `${spec.id}-error-report.csv`;
    a.click();
  };

  const commit = async () => {
    if (!val || missing.length) return;
    const res = await apply(sheet, val.valid);
    const total = spec.amountKey ? val.amountTotal + val.rejectedTotal : rows.length;
    await importJobs.save({
      id: jobId, sheet, fileName: file, uploadedAt: stamp(), sourceRows: rows.length, validRows: val.valid.length, errorRows: val.errors.length, sourceTotal: total,
      appliedTotal: spec.amountKey ? val.amountTotal : res.applied, appliedRows: res.applied, status: "committed", errors: val.errors,
      openingBalances: sheet === "advances" ? val.amountTotal : undefined, version: 2,
    });
    await auditMany([
      { actor, entity: "import", entityId: jobId, action: "Go-live load applied", detail: `${spec.label}: ${res.applied} applied, ${val.errors.length} rejected from ${file}` },
      ...res.keys.map((k) => ({ actor, entity: "import" as const, entityId: jobId, action: `Imported ${spec.label.toLowerCase()} record`, detail: k })),
    ]);
    setDone({ applied: res.applied });
    setStep(3);
  };

  const preview = useMemo(() => rows.slice(0, 12), [rows]);
  const errRows = new Set(val?.errors.map((e) => e.row));

  return (
    <Section title="New import" actions={<Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}>
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => <li key={s} className={cn("rounded-full border px-3 py-1", i === step ? "bg-foreground text-background" : i < step ? "bg-muted" : "text-muted-foreground")}>{i + 1}. {s}</li>)}
      </ol>
      {err && <Notice tone="bad">{err}</Notice>}

      {step === 0 && (
        <div className="space-y-3">
          <Select value={sheet} onChange={(e) => setSheet(e.target.value as ImportSheet)} aria-label="Sheet">
            {SPECS.map((s) => <option key={s.id} value={s.id}>{s.tier}. {s.label}{committed.has(s.id) ? " (loaded)" : ""}</option>)}
          </Select>
          {missing.length > 0 && <Notice tone="warn">Load order: {missing.map((m) => m.label).join(", ")} must be applied before this sheet can be applied. You can still upload and validate it.</Notice>}
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted"><Upload className="size-4" />Upload CSV<input type="file" accept=".csv,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} /></label>
            <Button variant="outline" onClick={useSample}>Use sample file ({spec.label})</Button>
          </div>
          <p className="text-xs text-muted-foreground">Expected columns: {spec.fields.map((f) => f.label + (f.required ? "*" : "")).join(", ")}</p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm">{file}: {body.length} rows, {header.length} columns. {Object.keys(map).length} of {spec.fields.length} fields matched automatically.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {spec.fields.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span>{f.label}{f.required && <span className="text-red-600"> *</span>}</span>
                <Select className="w-48" value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value })}>
                  <option value="">Not mapped</option>{header.map((h) => <option key={h}>{h}</option>)}
                </Select>
              </label>
            ))}
          </div>
          {unmapped.length > 0 && <Notice tone="warn">Map the required fields: {unmapped.map((f) => f.label).join(", ")}</Notice>}
          <div className="flex gap-2"><Button variant="outline" onClick={() => setStep(0)}>Back</Button><Button disabled={unmapped.length > 0} onClick={runValidate}>Validate</Button></div>
        </div>
      )}

      {step === 2 && val && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge>{rows.length} rows read</StatusBadge><StatusBadge tone="good">{val.valid.length} valid</StatusBadge>
            <StatusBadge tone={val.errors.length ? "bad" : "good"}>{val.errors.length} with errors</StatusBadge>
            {val.updates > 0 && <StatusBadge tone="info">{val.updates} will update existing records</StatusBadge>}
          </div>
          <Notice>Nothing is saved yet. Valid rows are written only when you apply; rows with errors are never applied and can be fixed in the source file and re-uploaded.</Notice>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs"><thead className="bg-muted/50"><tr><th className="px-2 py-1 text-start">Row</th>{spec.fields.map((f) => <th key={f.key} className="px-2 py-1 text-start">{f.label}</th>)}</tr></thead>
              <tbody>{preview.map((r, i) => <tr key={i} className={cn("border-t", errRows.has(i + 2) && "bg-red-50 dark:bg-red-950/30")}><td className="px-2 py-1">{i + 2}</td>{spec.fields.map((f) => <td key={f.key} className="px-2 py-1">{r[f.key]}</td>)}</tr>)}</tbody></table>
          </div>
          <p className="text-xs text-muted-foreground">First {preview.length} rows shown.</p>
          {val.errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><h3 className="text-sm font-medium">Error report</h3><Button size="sm" variant="outline" onClick={errorReport}><Download /> Download error report</Button></div>
              <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border text-sm">{val.errors.map((e) => <li key={e.row} className="px-3 py-1.5"><span className="font-medium">Row {e.row}</span> ({e.key}): {e.messages.join("; ")}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Back to mapping</Button>
            <Button variant="outline" onClick={() => { setStep(0); setVal(null); }}>Upload a corrected file</Button>
            <Button disabled={val.valid.length === 0 || missing.length > 0} onClick={commit}>Apply {val.valid.length} valid rows</Button>
          </div>
          {missing.length > 0 && <Notice tone="warn">Cannot apply yet: load {missing.map((m) => m.label).join(", ")} first.</Notice>}
        </div>
      )}

      {step === 3 && val && done && (
        <div className="space-y-3">
          <Notice tone="good">Applied {done.applied} rows to {spec.destination === "core" ? "the live workers/vehicles records" : "the staging area (destination module not connected in the demo)"}; {val.errors.length} rows rejected. Every imported record has an audit entry.</Notice>
          <Reconciliation job={{ sourceRows: rows.length, validRows: val.valid.length, errorRows: val.errors.length, sourceTotal: spec.amountKey ? val.amountTotal + val.rejectedTotal : rows.length, appliedTotal: spec.amountKey ? val.amountTotal : done.applied }} sheet={sheet} />
          <Button variant="outline" onClick={() => { setStep(0); setVal(null); setDone(null); setJobId(""); }}>Load another sheet</Button>
        </div>
      )}
    </Section>
  );
}

export function Reconciliation({ job, sheet }: { job: Pick<ImportJob, "sourceRows" | "validRows" | "errorRows" | "sourceTotal" | "appliedTotal">; sheet: ImportSheet }) {
  const spec = specOf(sheet);
  const countOk = job.validRows + job.errorRows === job.sourceRows;
  const rejected = job.sourceTotal - job.appliedTotal;
  return (
    <table className="w-full max-w-xl text-sm">
      <thead><tr className="text-start text-xs text-muted-foreground"><th className="py-1 text-start">Reconciliation</th><th className="text-end">Count</th>{spec.amountKey && <th className="text-end">Total (KD)</th>}</tr></thead>
      <tbody>
        <tr className="border-t"><td className="py-1">Source sheet</td><td className="text-end tabular-nums">{job.sourceRows}</td>{spec.amountKey && <td className="text-end tabular-nums">{formatKD(job.sourceTotal)}</td>}</tr>
        <tr className="border-t"><td className="py-1">Applied</td><td className="text-end tabular-nums">{job.validRows}</td>{spec.amountKey && <td className="text-end tabular-nums">{formatKD(job.appliedTotal)}</td>}</tr>
        <tr className="border-t"><td className="py-1">Rejected (error rows)</td><td className="text-end tabular-nums">{job.errorRows}</td>{spec.amountKey && <td className="text-end tabular-nums">{formatKD(rejected)}</td>}</tr>
        <tr className="border-t font-medium"><td className="py-1">Applied + rejected = source</td><td className="text-end">{countOk ? "Yes" : "No"}</td>{spec.amountKey && <td className="text-end">{money(spec, job.appliedTotal + rejected) === money(spec, job.sourceTotal) ? "Yes" : "No"}</td>}</tr>
      </tbody>
    </table>
  );
}
