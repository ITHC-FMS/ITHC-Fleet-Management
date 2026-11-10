"use client";

import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { locations as locationsCol, vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import type { Vehicle } from "@/data/entities";
import { assignmentActive, costSchedules, docState, fmtStamp, fuelTxns, leaseLinks, logAudit, serviceJobs, vehicleAssignments, fleetAudit } from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Select, Textarea } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, prettify, toneFor } from "@/components/app/status-badge";
import { fmtDate } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { useVehicleFacts, type VehicleFacts } from "../_shared/facts";
import { useActor } from "../_shared/hooks";
import { VehicleForm } from "./vehicle-form";

export default function VehiclesScreen({ readOnly, editedBy }: ScreenProps) {
  const facts = useVehicleFacts();
  const locs = locationsCol.useAll();
  const [own, setOwn] = useState("");
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<{ vehicle: Vehicle | null } | null>(null);
  const [importing, setImporting] = useState(false);
  const locName = (id: string) => locs.find((l) => l.id === id)?.name.replace(/^Handover /, "") ?? id;

  const rows = useMemo(() => facts.filter((f) => (!own || f.vehicle.ownership === own) && (!mode || f.vehicle.mode === mode) && (!status || f.vehicle.status === status)).map((f) => ({ ...f, id: f.vehicle.id })), [facts, own, mode, status]);
  const sel = facts.find((f) => f.vehicle.id === selected);
  const inService = facts.filter((f) => f.vehicle.status === "in_service");
  const avgByOwn = (o: string) => { const l = inService.filter((f) => f.vehicle.ownership === o); return l.length ? Math.round(l.reduce((s, f) => s + f.holding, 0) / l.length) : 0; };

  const cols: Column<(typeof rows)[number]>[] = [
    { key: "plate", header: "Registration", value: (r) => r.vehicle.plate, cell: (r) => <span className="font-medium">{r.vehicle.plate}</span> },
    { key: "type", header: "Type", value: (r) => r.vehicle.type },
    { key: "veh", header: "Vehicle", value: (r) => `${r.vehicle.make} ${r.vehicle.model} ${r.vehicle.year}` },
    { key: "own", header: "Ownership", value: (r) => r.vehicle.ownership, cell: (r) => prettify(r.vehicle.ownership) },
    { key: "mode", header: "Mode", value: (r) => r.vehicle.mode, cell: (r) => <StatusBadge tone="info">{r.vehicle.mode}</StatusBadge> },
    { key: "home", header: "Home location", value: (r) => locName(r.vehicle.homeLocationId) },
    { key: "status", header: "Status", value: (r) => r.vehicle.status, cell: (r) => <StatusBadge tone={toneFor(r.vehicle.status)}>{prettify(r.vehicle.status)}</StatusBadge> },
    { key: "lessor", header: "Lessor contract", value: (r) => (r.contract ? `${r.vehicle.lessor} ${r.contract.contractNo}` : ""), cell: (r) => (r.contract ? <span>{r.vehicle.lessor} · {r.contract.contractNo} v{r.contract.contractVersion}</span> : "—") },
    { key: "assign", header: "Assignable", value: (r) => (r.assignable.ok ? "yes" : "no"), cell: (r) => (r.assignable.ok ? <StatusBadge tone="good">Yes</StatusBadge> : <span title={r.assignable.reason}><StatusBadge tone="bad">No</StatusBadge></span>) },
    { key: "docs", header: "Documents", value: (r) => r.docIssues, cell: (r) => (r.docIssues ? <StatusBadge tone="warn">{r.docIssues} expiring or expired</StatusBadge> : <StatusBadge tone="good">OK</StatusBadge>) },
    { key: "hold", header: "Cost / month", align: "end", value: (r) => r.holding, cell: (r) => formatKD(r.holding) },
    { key: "total", header: "All-in / month", align: "end", value: (r) => r.total, cell: (r) => formatKD(r.total) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={readOnly ? "Vehicles (read-only)" : "Vehicles"}
        description="Vehicle register with ownership type, assignment mode, cost schedule and home location."
        actions={!readOnly && (<><Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import</Button><Button onClick={() => setForm({ vehicle: null })}><Plus /> Add vehicle</Button></>)}
      />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Vehicles" value={facts.length} hint={`${inService.length} in service`} />
        <KpiCard label="Cost / month, rented" value={formatKD(avgByOwn("rented"))} hint="Average per vehicle, common basis" />
        <KpiCard label="Cost / month, cash" value={formatKD(avgByOwn("cash"))} hint="(price − residual) ÷ life" />
        <KpiCard label="Cost / month, financed" value={formatKD(avgByOwn("financed"))} hint="Instalment + deposit ÷ term" />
      </KpiGrid>
      <DataTable
        rows={rows}
        columns={cols}
        exportName="vehicles"
        searchPlaceholder="Search registration, make, lessor…"
        onRowClick={(r) => setSelected(r.id)}
        filters={(
          <>
            <Select className="w-36" value={own} onChange={(e) => setOwn(e.target.value)}><option value="">All ownership</option><option value="rented">Rented</option><option value="cash">Cash</option><option value="financed">Financed</option></Select>
            <Select className="w-36" value={mode} onChange={(e) => setMode(e.target.value)}><option value="">All modes</option><option value="pooled">Pooled</option><option value="dedicated">Dedicated</option><option value="transport">Transport</option></Select>
            <Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All status</option><option value="in_service">In service</option><option value="under_repair">Under repair</option><option value="off_fleet">Off fleet</option></Select>
          </>
        )}
      />
      {sel && (
        <FormSheet open onOpenChange={(o) => !o && setSelected(null)} title={`${sel.vehicle.plate} · ${sel.vehicle.make} ${sel.vehicle.model}`} description={`Version ${sel.vehicle.version}`} hideSubmit wide>
          <VehicleDetail f={sel} locName={locName} />
          {!readOnly && <Button type="button" onClick={() => { setForm({ vehicle: sel.vehicle }); setSelected(null); }}>Edit vehicle</Button>}
        </FormSheet>
      )}
      {form && <VehicleForm key={form.vehicle?.id ?? "new"} open onOpenChange={(o) => !o && setForm(null)} vehicle={form.vehicle} />}
      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b py-1.5 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-end font-medium">{v}</span></div>;
}

function VehicleDetail({ f, locName }: { f: VehicleFacts; locName: (id: string) => string }) {
  const v = f.vehicle;
  const people = workersCol.useAll();
  const assignments = vehicleAssignments.useAll().filter((a) => a.vehicleId === v.id && assignmentActive(a));
  const jobs = serviceJobs.useAll().filter((j) => j.vehicleId === v.id);
  const fuel = fuelTxns.useAll().filter((x) => x.vehicleId === v.id);
  const audit = fleetAudit.useAll().filter((a) => a.entity === "Vehicle" && a.entityId === v.id).slice(-4).reverse();
  const s = f.schedule;
  const name = (id: string) => people.find((w) => w.id === id)?.name ?? id;
  return (
    <div className="space-y-4">
      <div>
        <Row k="Ownership" v={prettify(v.ownership)} />
        <Row k="Assignment mode" v={v.mode} />
        <Row k="Home location" v={locName(v.homeLocationId)} />
        <Row k="Status" v={<StatusBadge tone={toneFor(v.status)}>{prettify(v.status)}</StatusBadge>} />
        <Row k="Odometer" v={`${v.odometerKm.toLocaleString("en-US")} km`} />
        <Row k="Assignable" v={f.assignable.ok ? "Yes" : f.assignable.reason} />
        {f.contract && <Row k="Lessor contract" v={`${v.lessor} · ${f.contract.contractNo} v${f.contract.contractVersion} (${fmtDate(f.contract.start)} to ${fmtDate(f.contract.end)})`} />}
      </div>
      <div>
        <p className="mb-1 font-medium">Cost schedule</p>
        {s?.ownership === "rented" && (<><Row k="Recurring charge" v={formatKD(s.monthlyCharge ?? 0)} /><Row k="Return conditions" v={s.returnConditions || "—"} /></>)}
        {s?.ownership === "cash" && (<><Row k="Purchase price" v={formatKD(s.purchasePrice ?? 0)} /><Row k="Residual / life" v={`${formatKD(s.residual ?? 0)} over ${s.lifeMonths} months`} /></>)}
        {s?.ownership === "financed" && (<><Row k="Deposit" v={formatKD(s.deposit ?? 0)} /><Row k="Instalment / term" v={`${formatKD(s.instalment ?? 0)} × ${s.termMonths} months`} /></>)}
        <Row k="Holding cost per month (common basis)" v={formatKD(f.holding)} />
        <Row k="Running cost per month (fuel + service)" v={formatKD(f.running)} />
        <Row k="All-in cost per month" v={<b>{formatKD(f.total)}</b>} />
      </div>
      <div>
        <p className="mb-1 font-medium">Current assignments</p>
        {assignments.length ? assignments.map((a) => <Row key={a.id} k={name(a.workerId)} v={`${fmtDate(a.from)} to ${a.to ? fmtDate(a.to) : "open"}`} />) : <p className="text-sm text-muted-foreground">None today.</p>}
      </div>
      <div>
        <p className="mb-1 font-medium">Documents</p>
        {f.docs.filter((d) => d.status === "current").map((d) => <Row key={d.id} k={prettify(d.type)} v={<>{fmtDate(d.expires)} <StatusBadge tone={docState(d) === "valid" ? "good" : docState(d) === "expiring" ? "warn" : "bad"}>{docState(d)}</StatusBadge></>} />)}
      </div>
      <div>
        <p className="mb-1 font-medium">Fuel and service</p>
        <Row k="Fuel transactions" v={`${fuel.length} · ${formatKD(fuel.reduce((x, t) => x + t.costFils, 0))}`} />
        <Row k="Service jobs" v={`${jobs.length} · ${formatKD(jobs.reduce((x, j) => x + j.costFils, 0))}`} />
      </div>
      {audit.length > 0 && <div><p className="mb-1 font-medium">Recent audit</p>{audit.map((a) => <Row key={a.id} k={fmtStamp(a.at)} v={`${a.action}: ${a.detail}`} />)}</div>}
    </div>
  );
}

const HEAD = "plate,type,make,model,year,ownership,mode,home_location_id,monthly_cost_kd,odometer_km";
function ImportSheet({ onClose }: { onClose: () => void }) {
  const actor = useActor();
  const [text, setText] = useState(`${HEAD}\n12/34567,car,Toyota,Corolla,2025,cash,pooled,loc-desk1,110.000,1200\n`);
  const [done, setDone] = useState("");
  const locIds = locationsCol.useAll().map((l) => l.id);
  const existing = vehiclesCol.useAll().map((v) => v.plate.toUpperCase());

  const parsed = useMemo(() => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const body = lines[0]?.toLowerCase().startsWith("plate") ? lines.slice(1) : lines;
    const seen = new Set<string>();
    return body.map((line, i) => {
      const [plate, type, make, model, year, ownership, mode, home, cost, odo] = line.split(",").map((x) => x.trim());
      const errs: string[] = [];
      if (!plate) errs.push("plate missing");
      else if (existing.includes(plate.toUpperCase()) || seen.has(plate.toUpperCase())) errs.push("duplicate plate");
      seen.add((plate ?? "").toUpperCase());
      if (!["car", "bike", "transport"].includes(type)) errs.push("type");
      if (!["rented", "cash", "financed"].includes(ownership)) errs.push("ownership");
      if (!["pooled", "dedicated", "transport"].includes(mode)) errs.push("mode");
      if (!locIds.includes(home)) errs.push("home location");
      const fils = parseKD(cost ?? "");
      if (!(fils > 0)) errs.push("cost");
      const yr = Number(year);
      if (!(yr >= 2000 && yr <= 2027)) errs.push("year");
      return { line: i + 1, plate, type, make, model, year: yr, ownership, mode, home, fils, odo: Number(odo) || 0, errs };
    });
  }, [text, existing, locIds]);
  const ok = parsed.filter((p) => p.errs.length === 0);

  const run = async () => {
    for (const p of ok) {
      const id = vehiclesCol.nextId("veh");
      await vehiclesCol.save({ id, plate: p.plate, type: p.type as Vehicle["type"], make: p.make, model: p.model, year: p.year, ownership: p.ownership as Vehicle["ownership"], mode: p.mode as Vehicle["mode"], homeLocationId: p.home, status: "in_service", monthlyCost: p.fils, odometerKm: p.odo, version: 1 });
      await costSchedules.save(p.ownership === "rented" ? { id, ownership: "rented", monthlyCharge: p.fils } : p.ownership === "cash" ? { id, ownership: "cash", purchasePrice: p.fils * 75, residual: p.fils * 15, lifeMonths: 60 } : { id, ownership: "financed", instalment: p.fils, deposit: 0, termMonths: 48 });
      if (p.ownership === "rented") await leaseLinks.save({ id, contractId: "" });
    }
    await logAudit(actor.name, "Vehicle", "import", "Imported", `${ok.length} vehicles imported from spreadsheet`);
    setDone(`${ok.length} vehicle${ok.length === 1 ? "" : "s"} imported. Leased rows must be linked to a lessor contract by editing the vehicle.`);
  };

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Import vehicles from spreadsheet" description="Paste rows copied from the spreadsheet (CSV)." onSubmit={run} submitLabel={`Import ${ok.length} valid row${ok.length === 1 ? "" : "s"}`} wide hideSubmit={!!done}>
      <Field label={`Columns: ${HEAD}`}><Textarea rows={8} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <div className="space-y-1 text-sm">
        {parsed.map((p) => <p key={p.line} className={p.errs.length ? "text-red-700" : "text-emerald-700"}>Row {p.line}: {p.plate || "(no plate)"} {p.errs.length ? `invalid: ${p.errs.join(", ")}` : "ready"}</p>)}
      </div>
      {done && <p className="rounded-md bg-emerald-100 p-2 text-sm text-emerald-800">{done}</p>}
    </FormSheet>
  );
}
