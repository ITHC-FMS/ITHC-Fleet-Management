"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/status-badge";
import { vehicles as vehiclesCol } from "@/data/core";
import type { Vehicle } from "@/data/entities";
import { TARGETS, guessColumn, type ImportCtx, type RowResult, type TargetKey } from "@/data/ops/import-targets";
import { coreWorkersCol, fuelTx, importLogs, logAudit, orders, payConfig, payParams, plans, segments, workerExt } from "@/data/ops/store";
import { makeUsername } from "@/data/ops/worker-ops";
import type { DeductionPlan, FuelTx, Order } from "@/data/ops/types";
import { TODAY } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Notice, parseDelimited, useActor, useNames } from "./shared";

const STEPS = ["Upload", "Map columns", "Preview", "Validate", "Commit"];

export function ImportWizard({ fixedTarget }: { fixedTarget?: TargetKey }) {
  const names = useNames();
  const actor = useActor();
  const allOrders = orders.useAll(), fuel = fuelTx.useAll(), cfg = payConfig.useAll();
  const [target, setTarget] = useState<TargetKey>(fixedTarget ?? "drivers");
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("pasted.csv");
  const [map, setMap] = useState<Record<string, number>>({});
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [result, setResult] = useState<{ committed: number; rejected: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const def = TARGETS[target];

  const ctx: ImportCtx = useMemo(() => ({ workers: names.workers, vehicles: names.vehicles, clients: names.clients, orders: allOrders, fuel, deductionTypes: cfg.filter((c) => c.group === "deduction") }), [names, allOrders, fuel, cfg]);
  const table = useMemo(() => parseDelimited(text), [text]);
  const headers = table[0] ?? [];
  const body = table.slice(1);
  const mapped = useMemo(() => body.map((r) => Object.fromEntries(def.fields.map((f) => [f.key, map[f.key] >= 0 && map[f.key] !== undefined ? r[map[f.key]] ?? "" : ""]))), [body, map, def]);
  const validated: RowResult[] = useMemo(() => { const seen = new Set<string>(); return step >= 3 ? mapped.map((r) => def.validate(r, ctx, seen)) : []; }, [mapped, def, ctx, step]);
  const good = validated.filter((v) => v.errors.length === 0).length;
  const bad = validated.length - good;
  const missingRequired = def.fields.filter((f) => f.required && (map[f.key] === undefined || map[f.key] < 0));

  const load = (t: string, name: string) => { setText(t); setFileName(name); setStep(0); setResult(null); setMap({}); };
  const onFile = async (f: File | undefined) => { if (f) load(await f.text(), f.name); };
  const toMap = () => { const h = parseDelimited(text)[0] ?? []; setMap(Object.fromEntries(def.fields.map((f) => [f.key, guessColumn(f, h)]))); setStep(1); };
  const changeTarget = (t: TargetKey) => { setTarget(t); setText(""); setMap({}); setStep(0); setResult(null); };

  const commit = async () => {
    setBusy(true);
    const ok = validated.map((v, i) => ({ v, i })).filter((x) => x.v.errors.length === 0).map((x) => x.v.rec as Record<string, never>);
    if (bad > 0 && !skipInvalid) { setBusy(false); return; }
    if (target === "drivers") {
      const start = Math.max(0, ...(await coreWorkersCol.list()).map((w) => Number(w.id.split("-")[1])));
      const ws = ok.map((r, i) => { const num = start + i + 1; return { id: `wrk-${String(num).padStart(4, "0")}`, username: makeUsername(String(r.name), num), name: String(r.name).trim(), nationality: String(r.nationality || "Unknown"), roles: ["driver" as const], status: "active" as const, employingCompany: "cmp-ithc", joiningDate: String(r.jd), phone: String(r.phone || ""), civilId: r.civilId ? String(r.civilId) : undefined, passportNo: r.passportNo ? String(r.passportNo) : undefined, licenceNo: r.licenceNo ? String(r.licenceNo) : undefined, riderId: r.riderId ? String(r.riderId) : undefined, vehicleTypes: [String(r.vt) as "car" | "bike"], baseSalary: Number(r.base), overtimeComponent: Number(r.ot), version: 1 }; });
      await coreWorkersCol.saveMany(ws);
      await segments.saveMany(ws.map((w, i) => ({ id: `seg-i${start + i + 1}`, workerId: w.id, status: "active" as const, from: w.joiningDate, to: null, version: 1 })));
      await payParams.saveMany(ws.map((w) => ({ id: w.id, foodAllowance: cfg.find((c) => c.key === "food")?.defaultFils ?? 0, accommodationMax: cfg.find((c) => c.key === "accommodation")?.defaultFils ?? 0, monthlyOrderTarget: 0, incentiveRateAbove: 0, incentiveRateBelow: 0, effectiveFrom: w.joiningDate, version: 1 })));
      await workerExt.saveMany(ws.map((w) => ({ id: w.id, contractOwnerCompanyId: "cmp-ithc" })));
    } else if (target === "vehicles") {
      const start = Math.max(0, ...names.vehicles.map((v) => Number(v.id.split("-")[1])));
      await vehiclesCol.saveMany(ok.map((r, i): Vehicle => ({ id: `veh-${String(start + i + 1).padStart(4, "0")}`, plate: String(r.plate), type: String(r.type).toLowerCase() as Vehicle["type"], make: String(r.make), model: String(r.model || ""), year: Number(r.year) || 2024, ownership: String(r.own) as Vehicle["ownership"], mode: String(r.type).toLowerCase() === "bike" ? "dedicated" : "pooled", homeLocationId: "loc-desk1", status: "in_service", monthlyCost: Number(r.cost), odometerKm: Number(r.odometer) || 0, version: 1 })));
    } else if (target === "orders") {
      const start = Math.max(0, ...allOrders.map((o) => Number(o.id.split("-")[1]))) ;
      await orders.saveMany(ok.map((r, i): Order => { const base = { id: `ord-${String(start + i + 1).padStart(4, "0")}`, date: String(r.date), workerId: String(r.workerId), clientId: String(r.clientId), place: String(r.place), version: 1, enteredBy: `${actor} (import)` }; return r.marketplace ? { ...base, kind: "marketplace", pickups: Number(r.pickups), dropoffs: Number(r.dropoffs), batch: String(r.batch) } : { ...base, kind: "store", orders: Number(r.orders) }; }));
    } else if (target === "deductions") {
      const start = Math.max(0, ...(await plans.list()).map((p) => Number(p.id.split("-")[1])));
      await plans.saveMany(ok.map((r, i): DeductionPlan => ({ id: `pln-${String(start + i + 1).padStart(4, "0")}`, workerId: String(r.workerId), kind: String(r.kind), description: String(r.description), total: Number(r.total), instalment: Number(r.inst), startMonth: String(r.startMonth), issuedOn: TODAY, repayments: [], version: 1 })));
    } else {
      const start = Math.max(0, ...fuel.map((f) => Number(f.id.split("-")[1])));
      await fuelTx.saveMany(ok.map((r, i): FuelTx => ({ id: `fue-${String(start + i + 1).padStart(4, "0")}`, date: String(r.date), vehicleId: String(r.vehicleId), workerId: r.workerId ? String(r.workerId) : undefined, litres: Number(r.litres), cost: Number(r.cost), odometerKm: Number(r.odometerKm) })));
    }
    await importLogs.save({ id: importLogs.nextId("imp"), at: TODAY, target: def.label, fileName, rows: validated.length, committed: ok.length, rejected: bad, by: actor });
    await logAudit({ actor, entity: "import", entityId: target, action: "commit", detail: `${def.label}: ${ok.length} rows committed, ${bad} rejected from ${fileName}` });
    setResult({ committed: ok.length, rejected: bad });
    setBusy(false);
    setStep(4);
  };

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2 text-sm">{STEPS.map((s, i) => <li key={s} className={cn("rounded-full border px-3 py-1", i === step ? "bg-foreground text-background" : i < step ? "bg-muted" : "text-muted-foreground")}>{i + 1}. {s}</li>)}</ol>
      {step === 0 && (
        <div className="space-y-3">
          {!fixedTarget && <Field label="What are you importing?"><Select value={target} onChange={(e) => changeTarget(e.target.value as TargetKey)} className="w-60">{(Object.keys(TARGETS) as TargetKey[]).map((k) => <option key={k} value={k}>{TARGETS[k].label}</option>)}</Select></Field>}
          <Field label="Spreadsheet (CSV / TSV)" hint="Excel workbooks: save the sheet as CSV first. The first row must hold column headings."><input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="block text-sm" /></Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => load(def.sample(ctx), `${target}-workbook-sample.csv`)}>Load sample in workbook format{target === "drivers" ? " (260 drivers)" : ""}</Button>
          </div>
          <Field label="…or paste rows copied from Excel"><Textarea value={text} onChange={(e) => { setText(e.target.value); setFileName("pasted.csv"); }} className="font-mono text-xs" rows={6} /></Field>
          <Button disabled={table.length < 2} onClick={toMap}>Next: map columns</Button>
          {text && <p className="text-xs text-muted-foreground">{body.length} data rows, {headers.length} columns detected in {fileName}.</p>}
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Match each system field to a column of your file. Obvious matches are pre-selected.</p>
          <div className="grid grid-cols-2 gap-3">
            {def.fields.map((f) => (
              <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
                <Select value={map[f.key] ?? -1} onChange={(e) => setMap({ ...map, [f.key]: Number(e.target.value) })}><option value={-1}>— not in file —</option>{headers.map((h, i) => <option key={i} value={i}>{h}</option>)}</Select>
              </Field>
            ))}
          </div>
          {missingRequired.length > 0 && <Notice tone="warn">Required and not mapped: {missingRequired.map((f) => f.label).join(", ")}</Notice>}
          <div className="flex gap-2"><Button variant="ghost" onClick={() => setStep(0)}>Back</Button><Button disabled={missingRequired.length > 0} onClick={() => setStep(2)}>Next: preview</Button></div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">First {Math.min(8, mapped.length)} of {mapped.length} rows as the system will read them.</p>
          <div className="overflow-x-auto rounded border"><table className="w-full text-xs"><thead className="bg-muted/50"><tr>{def.fields.map((f) => <th key={f.key} className="px-2 py-1 text-start">{f.label}</th>)}</tr></thead>
            <tbody>{mapped.slice(0, 8).map((r, i) => <tr key={i} className="border-t">{def.fields.map((f) => <td key={f.key} className="px-2 py-1">{r[f.key]}</td>)}</tr>)}</tbody></table></div>
          <div className="flex gap-2"><Button variant="ghost" onClick={() => setStep(1)}>Back</Button><Button onClick={() => setStep(3)}>Next: validate</Button></div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3">
          <div className="flex gap-2"><StatusBadge tone="good">{good} valid</StatusBadge><StatusBadge tone={bad ? "bad" : "neutral"}>{bad} with errors</StatusBadge></div>
          {bad > 0 && (
            <div className="max-h-56 overflow-y-auto rounded border text-sm">
              {validated.map((v, i) => v.errors.length ? <div key={i} className="border-b px-3 py-1.5"><b>Row {i + 2}</b>: {v.errors.join("; ")}</div> : null)}
            </div>
          )}
          {bad > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} /> Skip rows with errors and commit the valid ones</label>}
          <div className="flex gap-2"><Button variant="ghost" onClick={() => setStep(2)}>Back</Button><Button disabled={busy || good === 0 || (bad > 0 && !skipInvalid)} onClick={commit}>Commit {good} row{good === 1 ? "" : "s"}</Button></div>
        </div>
      )}
      {step === 4 && result && (
        <div className="space-y-3">
          <Notice tone="good">Committed {result.committed} {def.label.toLowerCase()} row(s); {result.rejected} rejected. The import is in the history and the audit log.</Notice>
          <Button variant="outline" onClick={() => load("", "")}>Import another file</Button>
        </div>
      )}
    </div>
  );
}
