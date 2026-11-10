import type { Vehicle, Worker, OwnershipType } from "@/data/entities";
import { addDays, daysBetween, overlaps, TODAY, type BizDate } from "@/lib/dates";
import { dateOf, hoursBetween } from "./time";
import type {
  CostSchedule, FuelTransaction, HandoverEvent, LeaseLink, LessorContract, VehicleAssignment, VehicleDocument, TransportRoute, DeskUser, Stamp,
} from "./types";

/** A desk sits inside a building; vehicles homed at the building are visible at its desk. */
export const DESK_BUILDING: Record<string, string> = { "loc-desk1": "loc-hq" };
export const deskSees = (deskId: string, homeLocationId: string) => homeLocationId === deskId || DESK_BUILDING[deskId] === homeLocationId;
export const deskOfVehicle = (v: Vehicle) => (v.homeLocationId === "loc-hq" ? "loc-desk1" : v.homeLocationId);

export const NON_ASSIGNABLE_WORKER = ["blocked", "terminated", "absconded", "inactive"];
export const canDrive = (w: Worker) => w.roles.includes("driver") && !NON_ASSIGNABLE_WORKER.includes(w.status);
export const onDuty = (w: Worker) => canDrive(w) && !["sick_leave", "annual_leave"].includes(w.status);

// ---------- lessor contracts ----------
export const contractValid = (c: LessorContract | undefined, on: BizDate = TODAY) =>
  !!c && c.status === "active" && c.start <= on && on <= c.end;
export const contractState = (c: LessorContract, on: BizDate = TODAY): "expired" | "expiring" | "active" | "superseded" | "future" =>
  c.status === "superseded" ? "superseded" : c.end < on ? "expired" : c.start > on ? "future" : daysBetween(on, c.end) <= 60 ? "expiring" : "active";

export function leaseContractOf(v: Vehicle, links: LeaseLink[], contracts: LessorContract[]) {
  const l = links.find((x) => x.id === v.id);
  return l ? contracts.find((c) => c.id === l.contractId) : undefined;
}
/** In-house (cash/financed) or on a valid lessor contract, and in service. */
export function assignability(v: Vehicle, links: LeaseLink[], contracts: LessorContract[]): { ok: boolean; reason?: string } {
  if (v.status !== "in_service") return { ok: false, reason: v.status === "under_repair" ? "Vehicle is under repair" : "Vehicle is off fleet" };
  if (v.ownership !== "rented") return { ok: true };
  const c = leaseContractOf(v, links, contracts);
  if (!c) return { ok: false, reason: "Leased vehicle has no lessor contract" };
  if (!contractValid(c)) return { ok: false, reason: `Lessor contract ${c.contractNo} v${c.contractVersion} is not valid (${c.start} to ${c.end})` };
  return { ok: true };
}

// ---------- cost on a common basis ----------
export function holdingMonthly(s: CostSchedule | undefined, ownership: OwnershipType, fallback: number): number {
  if (!s) return fallback;
  if (ownership === "rented") return s.monthlyCharge ?? fallback;
  if (ownership === "cash") return s.lifeMonths ? Math.round(((s.purchasePrice ?? 0) - (s.residual ?? 0)) / s.lifeMonths) : fallback;
  return s.termMonths ? Math.round((s.instalment ?? 0) + (s.deposit ?? 0) / s.termMonths) : fallback;
}
export const capitalOf = (s: CostSchedule | undefined) => (s && s.ownership !== "rented" ? s.purchasePrice ?? 0 : 0);

// ---------- handover state ----------
const byAt = (a: HandoverEvent, b: HandoverEvent) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1);
export function lastEventByVehicle(events: HandoverEvent[]): Map<string, HandoverEvent> {
  const m = new Map<string, HandoverEvent>();
  for (const e of [...events].filter((x) => x.sync !== "held").sort(byAt)) m.set(e.vehicleId, e);
  return m;
}
export const holderOf = (e?: HandoverEvent) => (e && e.direction === "issue" ? e.driverId : undefined);

// ---------- assignments ----------
export function assignmentConflicts(list: VehicleAssignment[], vehicles: Vehicle[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, msg: string) => out.set(id, [...(out.get(id) ?? []), msg]);
  const vById = new Map(vehicles.map((v) => [v.id, v]));
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!overlaps(a.from, a.to, b.from, b.to)) continue;
      const va = vById.get(a.vehicleId), vb = vById.get(b.vehicleId);
      if (a.vehicleId === b.vehicleId && a.workerId !== b.workerId && va?.mode === "dedicated") {
        add(a.id, `Dedicated vehicle also assigned to ${b.workerId} (${b.id})`);
        add(b.id, `Dedicated vehicle also assigned to ${a.workerId} (${a.id})`);
      }
      if (a.vehicleId === b.vehicleId && a.workerId === b.workerId) {
        add(a.id, `Duplicate period for the same worker (${b.id})`);
        add(b.id, `Duplicate period for the same worker (${a.id})`);
      }
      if (a.workerId === b.workerId && a.vehicleId !== b.vehicleId && va?.mode === "dedicated" && vb?.mode === "dedicated") {
        add(a.id, `Worker also has dedicated ${vb.plate} (${b.id})`);
        add(b.id, `Worker also has dedicated ${va.plate} (${a.id})`);
      }
    }
  return out;
}
export const assignmentActive = (a: VehicleAssignment, on: BizDate = TODAY) => a.from <= on && (a.to === null || on <= a.to);

// ---------- fuel ----------
export const TANK_L: Record<string, number> = { car: 55, bike: 14, transport: 80 };
export const BASE_L100: Record<string, number> = { car: 9, bike: 3.5, transport: 14 };
export const PRICE_BAND = [190, 260]; // fils per litre

export function fuelAnomalies(txns: FuelTransaction[], vehicles: Vehicle[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, m: string) => out.set(id, [...(out.get(id) ?? []), m]);
  const vById = new Map(vehicles.map((v) => [v.id, v]));
  const sorted = [...txns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
  const prev = new Map<string, FuelTransaction>();
  const sameDay = new Map<string, string>();
  for (const t of sorted) {
    const v = vById.get(t.vehicleId);
    const type = v?.type ?? "car";
    if (t.litres > (TANK_L[type] ?? 55)) add(t.id, `${t.litres} L exceeds tank capacity (${TANK_L[type]} L)`);
    const ppl = t.litres > 0 ? t.costFils / t.litres : 0;
    if (ppl && (ppl < PRICE_BAND[0] || ppl > PRICE_BAND[1])) add(t.id, `Price ${Math.round(ppl)} fils/L outside ${PRICE_BAND[0]} to ${PRICE_BAND[1]}`);
    const k = `${t.vehicleId}|${t.date}`;
    if (sameDay.has(k)) { add(t.id, "Second fill on the same day"); add(sameDay.get(k)!, "Second fill on the same day"); }
    else sameDay.set(k, t.id);
    const p = prev.get(t.vehicleId);
    if (p && t.odometerKm && p.odometerKm && t.odometerKm > p.odometerKm) {
      const l100 = (t.litres / (t.odometerKm - p.odometerKm)) * 100;
      if (l100 > (BASE_L100[type] ?? 9) * 1.6) add(t.id, `${l100.toFixed(1)} L/100km is over 1.6x the ${type} norm`);
    } else if (p && t.odometerKm && p.odometerKm && t.odometerKm < p.odometerKm) add(t.id, "Odometer lower than previous fill");
    if (!t.handoverId && v?.mode === "pooled") add(t.id, "No handover event linked for a pooled vehicle");
    prev.set(t.vehicleId, t);
  }
  return out;
}

export function consumptionL100(txns: FuelTransaction[], vehicleId: string): number | null {
  const t = txns.filter((x) => x.vehicleId === vehicleId && x.odometerKm).sort((a, b) => (a.odometerKm! - b.odometerKm!));
  if (t.length < 2) return null;
  const km = t[t.length - 1].odometerKm! - t[0].odometerKm!;
  const litres = t.slice(1).reduce((s, x) => s + x.litres, 0);
  return km > 0 ? (litres / km) * 100 : null;
}

// ---------- documents ----------
export const docState = (d: VehicleDocument, on: BizDate = TODAY): "expired" | "expiring" | "valid" | "superseded" =>
  d.status === "superseded" ? "superseded" : d.expires < on ? "expired" : daysBetween(on, d.expires) <= 30 ? "expiring" : "valid";

// ---------- desk users ----------
export const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").toUpperCase();
export function generateUsername(name: string, users: DeskUser[], existingUsernames: string[] = []): string {
  const base = name.trim().toLowerCase().split(/\s+/).map((p) => p.replace(/[^a-z]/g, "")).filter(Boolean).join(".");
  const nums = [...users.map((u) => u.username), ...existingUsernames].map((u) => Number(u.split("-").pop())).filter(Number.isFinite);
  const next = Math.max(100, ...nums) + 1;
  return `${base}-${String(next).padStart(4, "0")}`;
}
export const isLatinName = (s: string) => /^[A-Za-z][A-Za-z' .-]*$/.test(s.trim());

// ---------- transport ----------
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export function routeConflicts(routes: TransportRoute[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, m: string) => out.set(id, [...(out.get(id) ?? []), m]);
  const live = routes.filter((r) => r.status !== "suspended");
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const aS = toMin(a.departs), aE = aS + a.durationMin, bS = toMin(b.departs), bE = bS + b.durationMin;
      if (!(aS < bE && bS < aE)) continue;
      if (a.vehicleId === b.vehicleId) { add(a.id, `Vehicle double-booked with ${b.name}`); add(b.id, `Vehicle double-booked with ${a.name}`); }
      if (a.driverId === b.driverId) { add(a.id, `Driver double-booked with ${b.name}`); add(b.id, `Driver double-booked with ${a.name}`); }
    }
  return out;
}

// ---------- utilisation ----------
export const WINDOW_DAYS = 28;
export const windowStart = () => addDays(TODAY, -(WINDOW_DAYS - 1));
export const AVAIL_PER_DAY = { pooled: 24, dedicated: 12, transport: 16 } as const;

export interface UtilRow {
  vehicle: Vehicle;
  used: number;
  available: number;
  pct: number;
  desk: string;
}

/** Used hours: pooled = out time between issue and return events; dedicated = assigned days x average daily hours. */
export function utilisation(vehicles: Vehicle[], events: HandoverEvent[], assignments: VehicleAssignment[], routes: TransportRoute[], now: Stamp): UtilRow[] {
  const ws = windowStart();
  const wsStamp = `${ws}T00:00`;
  const byV = new Map<string, HandoverEvent[]>();
  for (const e of events) if (e.sync !== "held") byV.set(e.vehicleId, [...(byV.get(e.vehicleId) ?? []), e]);
  return vehicles.filter((v) => v.status !== "off_fleet").map((v) => {
    let used = 0;
    if (v.mode === "pooled") {
      const evs = (byV.get(v.id) ?? []).sort(byAt);
      let open: HandoverEvent | null = null;
      for (const e of evs) {
        if (e.direction === "issue") open = e;
        else if (open) {
          const s = open.at < wsStamp ? wsStamp : open.at;
          if (e.at > s) used += hoursBetween(s, e.at);
          open = null;
        }
      }
      if (open) used += hoursBetween(open.at < wsStamp ? wsStamp : open.at, now);
    } else if (v.mode === "dedicated") {
      for (const a of assignments.filter((x) => x.vehicleId === v.id)) {
        const s = a.from < ws ? ws : a.from, e = a.to === null || a.to > TODAY ? TODAY : a.to;
        if (e >= s) used += (daysBetween(s, e) + 1) * (a.avgDailyHours ?? 9);
      }
    } else {
      const rs = routes.filter((r) => r.vehicleId === v.id && r.status === "active");
      used = rs.reduce((s, r) => s + (r.durationMin / 60) * 2 * WINDOW_DAYS * (5 / 7), 0);
    }
    const available = AVAIL_PER_DAY[v.mode] * WINDOW_DAYS;
    return { vehicle: v, used, available, pct: available ? Math.min(100, (used / available) * 100) : 0, desk: deskOfVehicle(v) };
  });
}

/** Number of this desk's pooled cars out at the same moment: the level that covers 95% of days in the window. */
export function peakConcurrent(events: HandoverEvent[], vehicleIds: Set<string>, now: Stamp): number {
  void now;
  const open = new Map<string, boolean>();
  const sorted = [...events].filter((e) => vehicleIds.has(e.vehicleId) && e.sync !== "held" && e.at >= `${windowStart()}T00:00`).sort(byAt);
  const daily = new Map<string, number>();
  let cur = 0;
  for (const e of sorted) {
    if (e.direction === "issue" && !open.get(e.vehicleId)) { cur++; open.set(e.vehicleId, true); }
    else if (e.direction === "return" && open.get(e.vehicleId)) { cur--; open.set(e.vehicleId, false); }
    const d = dateOf(e.at);
    daily.set(d, Math.max(daily.get(d) ?? 0, cur));
  }
  const vals = [...daily.values()].sort((a, b) => a - b);
  if (!vals.length) return 0;
  return vals[Math.min(vals.length - 1, Math.ceil(vals.length * 0.95) - 1)];
}
export { dateOf };
