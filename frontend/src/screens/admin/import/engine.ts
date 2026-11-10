import { clients, vehicles, workers, type Vehicle, type Worker, type WorkerRole } from "@/data/core";
import type { ImportErrorRow, ImportSheet } from "@/data/admin";
import { makeUsername } from "../users";
import { kdFils, type SheetSpec } from "./specs";

export type Row = Record<string, string>;

/** Apply the column mapping to raw source rows. */
export function mapRows(spec: SheetSpec, header: string[], body: string[][], map: Record<string, string>): Row[] {
  return body.map((cells) => {
    const r: Row = {};
    for (const f of spec.fields) {
      const col = map[f.key] ? header.indexOf(map[f.key]) : -1;
      r[f.key] = col >= 0 ? (cells[col] ?? "").trim() : "";
    }
    return r;
  });
}

export interface Validation { valid: Row[]; errors: ImportErrorRow[]; updates: number; amountTotal: number; rejectedTotal: number }

const ownershipOf = (v: string): Vehicle["ownership"] => {
  const s = v.toLowerCase();
  if (["leased", "rented", "lease", "rent"].includes(s)) return "rented";
  if (["financed", "finance", "loan"].includes(s)) return "financed";
  return "cash"; // ITHC-owned vehicles are prefilled as in-house (cash)
};

/** Validate every row: required, formats, duplicates inside the file and cross-field rules. Nothing is saved. */
export function validate(spec: SheetSpec, rows: Row[]): Validation {
  const seen = new Map<string, number>();
  const rider = new Map<string, number>();
  const valid: Row[] = [];
  const errors: ImportErrorRow[] = [];
  let updates = 0, amountTotal = 0, rejectedTotal = 0;
  rows.forEach((r, i) => {
    const n = i + 2; // spreadsheet row (header is row 1)
    const msgs: string[] = [];
    for (const f of spec.fields) {
      const v = r[f.key];
      if (!v) { if (f.required) msgs.push(`${f.label} is required`); continue; }
      const m = f.check?.(v, r);
      if (m) msgs.push(m);
    }
    const key = r[spec.uniqueKey];
    if (key) {
      if (seen.has(key) && spec.id !== "assignments" && spec.id !== "stays" && spec.id !== "advances") msgs.push(`Duplicate ${spec.uniqueKey.replace("_", " ")} ${key} (also row ${seen.get(key)})`);
      else if (!seen.has(key)) seen.set(key, n);
    }
    if (spec.id === "workers") {
      if (r.role?.toLowerCase() === "driver" && !r.licence_no) msgs.push("Licence number is required for a driver");
      if (r.rider_id) { if (rider.has(r.rider_id)) msgs.push(`Duplicate rider id ${r.rider_id} (also row ${rider.get(r.rider_id)})`); else rider.set(r.rider_id, n); }
      if (r.client && !clients.getSync(clientId(r.client) ?? "")) msgs.push(`Unknown client "${r.client}"`);
    }
    if (spec.id === "vehicles" && ownershipOf(r.ownership ?? "") === "rented" && !r.lessor) msgs.push("A leased vehicle needs a lessor");
    const amt = spec.amountKey && r[spec.amountKey] ? kdFils(r[spec.amountKey]) : 0;
    if (spec.id === "vehicles" && r.monthly_cost_kd && amt < 0) msgs.push("Monthly cost cannot be negative");
    if (msgs.length) { errors.push({ row: n, key: key || r.name || r.plate || `row ${n}`, messages: msgs, raw: r }); rejectedTotal += amt; }
    else {
      valid.push(r); amountTotal += amt;
      if ((spec.id === "workers" && existingByCivil(r.civil_id)) || (spec.id === "vehicles" && existingByPlate(r.plate))) updates++;
    }
  });
  return { valid, errors, updates, amountTotal, rejectedTotal };
}

let cache: { w: Worker[]; v: Vehicle[] } = { w: [], v: [] };
export async function primeExisting() { cache = { w: await workers.list(), v: await vehicles.list() }; }
const existingByCivil = (c: string) => cache.w.find((w) => w.civilId === c);
const existingByPlate = (p: string) => cache.v.find((v) => v.plate === p);

function clientId(name: string) {
  const n = name.toLowerCase();
  return ({ americana: "cli-americana", talabat: "cli-talabat", keeta: "cli-keeta", "alshaya warehouse": "cli-alshaya", "bean & brew cafés": "cli-bean" } as Record<string, string>)[n];
}

/** Write valid rows. Workers and vehicles upsert into the core collections (matched by civil ID / plate so a repeat load updates rather than duplicates). */
export async function apply(sheet: ImportSheet, valid: Row[]): Promise<{ applied: number; keys: string[] }> {
  await primeExisting();
  if (sheet === "workers") {
    let list = cache.w;
    const out: Worker[] = [];
    for (const r of valid) {
      const prev = existingByCivil(r.civil_id);
      const maxId = Math.max(0, ...list.map((w) => Number(w.id.split("-").pop())), ...out.map((w) => Number(w.id.split("-").pop())));
      const id = prev?.id ?? `wrk-${String(maxId + 1).padStart(4, "0")}`;
      const [first, ...rest] = r.name.split(/\s+/);
      const role = r.role.toLowerCase() as WorkerRole;
      out.push({
        id, username: prev?.username ?? makeUsername(first, rest.join(" "), []).replace(/-\d+$/, `-${id.split("-").pop()}`),
        name: r.name, nationality: r.nationality || prev?.nationality || "", roles: [role], status: prev?.status ?? "active", employingCompany: "cmp-ithc",
        joiningDate: r.joining_date, phone: r.phone, civilId: r.civil_id, passportNo: r.passport_no || undefined,
        licenceNo: r.licence_no || undefined, riderId: r.rider_id || undefined, vehicleTypes: role === "driver" ? prev?.vehicleTypes ?? ["bike"] : undefined,
        baseSalary: kdFils(r.base_salary_kd), overtimeComponent: role === "driver" ? 40_000 : 0, currentClientId: clientId(r.client), version: (prev?.version ?? 0) + 1,
      });
      list = [...list.filter((w) => w.id !== id), out[out.length - 1]];
    }
    await workers.saveMany(out);
    return { applied: out.length, keys: out.map((w) => `${w.id} ${w.name}`) };
  }
  if (sheet === "vehicles") {
    const out: Vehicle[] = [];
    for (const r of valid) {
      const prev = existingByPlate(r.plate);
      const maxId = Math.max(0, ...cache.v.map((v) => Number(v.id.split("-").pop())), ...out.map((v) => Number(v.id.split("-").pop())));
      const type = r.type.toLowerCase() as Vehicle["type"];
      const ownership = ownershipOf(r.ownership);
      out.push({
        id: prev?.id ?? `veh-${String(maxId + 1).padStart(4, "0")}`, plate: r.plate, type, make: r.make, model: r.model, year: Number(r.year), ownership,
        mode: type === "bike" ? "dedicated" : type === "transport" ? "transport" : "pooled", homeLocationId: /2/.test(r.home_desk) ? "loc-desk2" : "loc-desk1",
        status: prev?.status ?? "in_service", monthlyCost: kdFils(r.monthly_cost_kd), odometerKm: Number(r.odometer_km) || 0,
        lessor: ownership === "rented" ? r.lessor : undefined, version: (prev?.version ?? 0) + 1,
      });
    }
    await vehicles.saveMany(out);
    return { applied: out.length, keys: out.map((v) => `${v.id} ${v.plate}`) };
  }
  return { applied: valid.length, keys: valid.map((r) => r[Object.keys(r)[0]] || "row") };
}
