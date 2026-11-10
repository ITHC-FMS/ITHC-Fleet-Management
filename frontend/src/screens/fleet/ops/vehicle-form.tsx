"use client";

import { useState } from "react";
import { locations as locationsCol, vehicles as vehiclesCol } from "@/data/core";
import type { AssignmentMode, OwnershipType, Vehicle, VehicleStatus } from "@/data/entities";
import { costSchedules, holdingMonthly, incidents, leaseLinks, lessorContracts, logAudit, serviceJobs, type CostSchedule } from "@/data/fleet";
import { companies } from "@/data/core";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { formatKD, parseKD } from "@/lib/money";
import { useActor } from "../_shared/hooks";

const kd = (n?: number) => (n === undefined ? "" : (n / 1000).toFixed(3));

interface Draft {
  plate: string; type: Vehicle["type"]; make: string; model: string; year: string; ownership: OwnershipType; mode: AssignmentMode;
  homeLocationId: string; status: VehicleStatus; odometerKm: string; contractId: string; reason: string;
  monthlyCharge: string; returnConditions: string; purchasePrice: string; residual: string; lifeMonths: string; deposit: string; instalment: string; termMonths: string;
}

function toDraft(v: Vehicle | null, s: CostSchedule | undefined, contractId: string): Draft {
  return {
    plate: v?.plate ?? "", type: v?.type ?? "car", make: v?.make ?? "", model: v?.model ?? "", year: String(v?.year ?? 2025), ownership: v?.ownership ?? "cash",
    mode: v?.mode ?? "pooled", homeLocationId: v?.homeLocationId ?? "loc-desk1", status: v?.status ?? "in_service", odometerKm: String(v?.odometerKm ?? 0), contractId, reason: "",
    monthlyCharge: kd(s?.monthlyCharge ?? v?.monthlyCost), returnConditions: s?.returnConditions ?? "", purchasePrice: kd(s?.purchasePrice), residual: kd(s?.residual), lifeMonths: String(s?.lifeMonths ?? 60),
    deposit: kd(s?.deposit), instalment: kd(s?.instalment), termMonths: String(s?.termMonths ?? 48),
  };
}

export function VehicleForm({ open, onOpenChange, vehicle }: { open: boolean; onOpenChange: (o: boolean) => void; vehicle: Vehicle | null }) {
  const actor = useActor();
  const locs = locationsCol.useAll();
  const comps = companies.useAll();
  const contracts = lessorContracts.useAll();
  const links = leaseLinks.useAll();
  const sched = costSchedules.useAll();
  const jobs = serviceJobs.useAll();
  const incs = incidents.useAll();
  const base = vehicle ? { v: vehicle, s: sched.find((x) => x.id === vehicle.id), c: links.find((l) => l.id === vehicle.id)?.contractId ?? "" } : null;
  const [d, setD] = useState<Draft>(() => toDraft(base?.v ?? null, base?.s, base?.c ?? ""));
  const [lockedVersion] = useState(vehicle?.version);
  const [err, setErr] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const schedule = (): CostSchedule | { error: string } => {
    if (d.ownership === "rented") {
      const m = parseKD(d.monthlyCharge);
      if (!(m > 0)) return { error: "Enter the recurring monthly charge in KD." };
      return { id: "", ownership: "rented", monthlyCharge: m, returnConditions: d.returnConditions.trim() };
    }
    if (d.ownership === "cash") {
      const p = parseKD(d.purchasePrice), r = parseKD(d.residual || "0"), life = Number(d.lifeMonths);
      if (!(p > 0) || !(life > 0) || !(r >= 0) || r >= p) return { error: "Cash vehicle needs purchase price, residual below price, and life in months." };
      return { id: "", ownership: "cash", purchasePrice: p, residual: r, lifeMonths: life };
    }
    const dep = parseKD(d.deposit || "0"), ins = parseKD(d.instalment), term = Number(d.termMonths);
    if (!(ins > 0) || !(term > 0) || !(dep >= 0)) return { error: "Financed vehicle needs instalment, term in months and deposit." };
    return { id: "", ownership: "financed", deposit: dep, instalment: ins, termMonths: term };
  };

  const save = async () => {
    const plate = d.plate.trim().toUpperCase();
    if (!plate) return setErr("Registration is required.");
    const all = await vehiclesCol.list();
    if (all.some((x) => x.plate.toUpperCase() === plate && x.id !== vehicle?.id)) return setErr("Another vehicle already has this registration.");
    const year = Number(d.year);
    if (!(year >= 2000 && year <= 2027)) return setErr("Enter a valid model year.");
    if (!d.make.trim() || !d.model.trim()) return setErr("Make and model are required.");
    if ((d.type === "transport") !== (d.mode === "transport")) return setErr("Transport vehicles must use the transport assignment mode, and only they can.");
    const odo = Number(d.odometerKm);
    if (!(odo >= 0)) return setErr("Odometer must be zero or more.");
    if (d.ownership === "rented" && !d.contractId) return setErr("A leased vehicle must be linked to a lessor contract.");
    const sch = schedule();
    if ("error" in sch) return setErr(sch.error);
    if (vehicle) {
      const cur = vehiclesCol.getSync(vehicle.id);
      if (!cur || cur.version !== lockedVersion) return setErr("This vehicle was changed by someone else since you opened it. Close and reopen to see the latest version.");
      if (cur.status !== d.status) {
        if (!d.reason.trim()) return setErr("A reason is required when the status changes.");
        if (d.status === "in_service" && (jobs.some((j) => j.vehicleId === cur.id && j.status !== "returned") || incs.some((i) => i.vehicleId === cur.id && i.status !== "closed")))
          return setErr("This vehicle has an open service job or incident. Use Return to Fleet to put it back in service.");
      }
    }
    const contract = contracts.find((c) => c.id === d.contractId);
    const lessorName = d.ownership === "rented" ? comps.find((c) => c.id === contract?.lessorId)?.name : undefined;
    const id = vehicle?.id ?? vehiclesCol.nextId("veh");
    const holding = holdingMonthly({ ...sch, id }, d.ownership, 0);
    const rec: Vehicle = {
      id, plate, type: d.type, make: d.make.trim(), model: d.model.trim(), year, ownership: d.ownership, mode: d.mode, homeLocationId: d.homeLocationId,
      status: d.status, monthlyCost: holding, odometerKm: odo, lessor: lessorName, version: (vehicle?.version ?? 0) + 1,
    };
    await vehiclesCol.save(rec);
    await costSchedules.save({ ...sch, id });
    if (d.ownership === "rented") await leaseLinks.save({ id, contractId: d.contractId });
    else await leaseLinks.remove(id);
    await logAudit(actor.name, "Vehicle", id, vehicle ? "Updated" : "Created", vehicle ? `${vehicle.plate} edited (v${vehicle.version} to v${rec.version})${vehicle.status !== rec.status ? `, status ${vehicle.status} to ${rec.status}` : ""}` : `${plate} added, ${d.ownership}, ${d.mode}`, d.reason.trim() || undefined);
    setErr("");
    onOpenChange(false);
  };

  const desks = locs.filter((l) => ["handover_desk", "operating_building"].includes(l.kind));
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={vehicle ? `Edit ${vehicle.plate}` : "Add vehicle"} description={vehicle ? `Version ${vehicle.version}` : "New vehicle in the register"} onSubmit={save} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Registration"><Input value={d.plate} onChange={(e) => set("plate", e.target.value)} /></Field>
        <Field label="Type"><Select value={d.type} onChange={(e) => { const t = e.target.value as Vehicle["type"]; set("type", t); if (t === "transport") set("mode", "transport"); else if (d.mode === "transport") set("mode", t === "bike" ? "dedicated" : "pooled"); }}>
          <option value="car">Car</option><option value="bike">Bike</option><option value="transport">Transport</option></Select></Field>
        <Field label="Make"><Input value={d.make} onChange={(e) => set("make", e.target.value)} /></Field>
        <Field label="Model"><Input value={d.model} onChange={(e) => set("model", e.target.value)} /></Field>
        <Field label="Year"><Input inputMode="numeric" value={d.year} onChange={(e) => set("year", e.target.value)} /></Field>
        <Field label="Odometer (km)"><Input inputMode="numeric" value={d.odometerKm} onChange={(e) => set("odometerKm", e.target.value)} /></Field>
        <Field label="Assignment mode"><Select value={d.mode} onChange={(e) => set("mode", e.target.value as AssignmentMode)}><option value="pooled">Pooled</option><option value="dedicated">Dedicated</option><option value="transport">Transport</option></Select></Field>
        <Field label="Home location (desk)"><Select value={d.homeLocationId} onChange={(e) => set("homeLocationId", e.target.value)}>{desks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Status"><Select value={d.status} onChange={(e) => set("status", e.target.value as VehicleStatus)}><option value="in_service">In service</option><option value="under_repair">Under repair</option><option value="off_fleet">Off fleet</option></Select></Field>
        <Field label="Ownership"><Select value={d.ownership} onChange={(e) => set("ownership", e.target.value as OwnershipType)}><option value="cash">In-house (cash)</option><option value="rented">Leased (rented)</option><option value="financed">Financed (not used today)</option></Select></Field>
      </div>
      {vehicle && vehicle.status !== d.status && <Field label="Reason for status change (audit)"><Textarea value={d.reason} onChange={(e) => set("reason", e.target.value)} /></Field>}
      {d.ownership === "rented" && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Lessor and rental schedule</p>
          <Field label="Lessor contract" hint="Assignable only while the contract is valid">
            <Select value={d.contractId} onChange={(e) => set("contractId", e.target.value)}>
              <option value="">Choose contract…</option>
              {contracts.filter((c) => c.status === "active").map((c) => <option key={c.id} value={c.id}>{comps.find((x) => x.id === c.lessorId)?.name} · {c.contractNo} v{c.contractVersion} (to {c.end})</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Recurring charge per month (KD)"><Input value={d.monthlyCharge} onChange={(e) => set("monthlyCharge", e.target.value)} /></Field>
            <Field label="Return conditions"><Input value={d.returnConditions} onChange={(e) => set("returnConditions", e.target.value)} /></Field>
          </div>
        </div>
      )}
      {d.ownership === "cash" && (
        <div className="grid grid-cols-3 gap-3 rounded-lg border p-3">
          <Field label="Purchase price (KD)"><Input value={d.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} /></Field>
          <Field label="Residual value (KD)"><Input value={d.residual} onChange={(e) => set("residual", e.target.value)} /></Field>
          <Field label="Life (months)"><Input value={d.lifeMonths} onChange={(e) => set("lifeMonths", e.target.value)} /></Field>
        </div>
      )}
      {d.ownership === "financed" && (
        <div className="grid grid-cols-3 gap-3 rounded-lg border p-3">
          <Field label="Deposit (KD)"><Input value={d.deposit} onChange={(e) => set("deposit", e.target.value)} /></Field>
          <Field label="Instalment per month (KD)"><Input value={d.instalment} onChange={(e) => set("instalment", e.target.value)} /></Field>
          <Field label="Term (months)"><Input value={d.termMonths} onChange={(e) => set("termMonths", e.target.value)} /></Field>
        </div>
      )}
      {(() => { const s = schedule(); return "error" in s ? null : <p className="text-sm text-muted-foreground">Cost per month on the common basis: <b>{formatKD(holdingMonthly({ ...s, id: "x" }, d.ownership, 0))}</b> (rented: charge; cash: (price − residual) ÷ life; financed: instalment + deposit ÷ term).</p>; })()}
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}
