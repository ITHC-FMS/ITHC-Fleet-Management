import { addDays, overlaps } from "@/lib/dates";
import type { Contract, Location, Vehicle, Worker } from "../entities";
import { daysInMonth, dowOf, eachDay, monthEnd, monthStart, timeToMin } from "./dates";
import { roundDiv } from "./payroll-engine";
import { contractInForce, revenueForOrder } from "./revenue";
import { segmentDays } from "./statuses";
import type { Assignment, Order, PayrollEntry, Shift, StatusSegment } from "./types";

export const volume = (o: Order) => (o.kind === "store" ? o.orders : o.pickups + o.dropoffs);

/* ---- daily productivity with comparison windows ---- */
export type Window = "prev_day" | "same_weekday" | "avg7";
export function productivity(orders: Order[], date: string, win: Window) {
  const by = (d: string) => { const m = new Map<string, number>(); for (const o of orders) if (o.date === d) m.set(o.workerId, (m.get(o.workerId) ?? 0) + volume(o)); return m; };
  const today = by(date);
  const cmpDays = win === "prev_day" ? [addDays(date, -1)] : win === "same_weekday" ? [addDays(date, -7)] : Array.from({ length: 7 }, (_, i) => addDays(date, -(i + 1)));
  const cmp = cmpDays.map(by);
  return [...today].map(([workerId, v]) => {
    const vals = cmp.map((m) => m.get(workerId)).filter((x): x is number => x !== undefined);
    const base = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { id: workerId, workerId, volume: v, base, delta: base ? ((v - base) / base) * 100 : null };
  });
}

/* ---- vehicle utilisation ---- */
export function utilisation(shifts: Shift[], vehicles: Vehicle[], from: string, to: string) {
  const days = eachDay(from, to).length;
  const rows = vehicles.map((v) => {
    const s = shifts.filter((x) => x.vehicleId === v.id && x.date >= from && x.date <= to);
    const dayCount = new Set(s.map((x) => x.date)).size;
    const hours = s.reduce((a, x) => a + (timeToMin(x.plannedEnd) - timeToMin(x.plannedStart)) / 60, 0);
    return { id: v.id, vehicle: v, daysUsed: dayCount, hours, pct: (dayCount / days) * 100 };
  });
  const groups = new Map<string, { n: number; pct: number; cost: number }>();
  for (const r of rows) { const g = groups.get(r.vehicle.ownership) ?? { n: 0, pct: 0, cost: 0 }; g.n++; g.pct += r.pct; g.cost += r.vehicle.monthlyCost; groups.set(r.vehicle.ownership, g); }
  return { rows, byOwnership: [...groups].map(([ownership, g]) => ({ id: ownership, ownership, vehicles: g.n, avgPct: g.pct / g.n, avgCost: Math.round(g.cost / g.n) })) };
}

/* ---- margin net of housing and transport per head ---- */
export interface MarginCtx { workers: Worker[]; orders: Order[]; contracts: Contract[]; assignments: Assignment[]; segments: StatusSegment[]; vehicles: Vehicle[]; locations: Location[]; entries: PayrollEntry[] }
export interface MarginRow { id: string; workerId: string; clientId: string; contractNo: string; vehicleId: string; revenue: number; pay: number; housing: number; vehicleCost: number; transport: number; margin: number }

export function marginRows(c: MarginCtx, month: string): MarginRow[] {
  const from = monthStart(month), to = monthEnd(month);
  const live = c.workers.filter((w) => segmentDays(c.segments, w.id, month).some((s) => s.days > 0));
  const housingHeads = new Map<string, number>();
  for (const w of live) if (w.housingLocationId) housingHeads.set(w.housingLocationId, (housingHeads.get(w.housingLocationId) ?? 0) + 1);
  const transport = c.vehicles.filter((v) => v.type === "transport").reduce((a, v) => a + v.monthlyCost, 0);
  const placed = live.filter((w) => !w.roles.includes("driver") && !w.roles.includes("handover") && !w.roles.includes("service"));
  const vehicleUsers = new Map<string, Set<string>>();
  for (const a of c.assignments) if (a.vehicleId && overlaps(a.from, a.to, from, to)) vehicleUsers.set(a.vehicleId, (vehicleUsers.get(a.vehicleId) ?? new Set()).add(a.workerId));
  return live.map((w) => {
    const asg = c.assignments.filter((a) => a.workerId === w.id && a.kind === "regular" && overlaps(a.from, a.to, from, to)).sort((x, y) => y.from.localeCompare(x.from))[0];
    const clientId = asg?.clientId ?? w.currentClientId ?? "none";
    let revenue = c.orders.filter((o) => o.workerId === w.id && o.date.startsWith(month)).reduce((a, o) => a + revenueForOrder(o, w, c.contracts), 0);
    const con = contractInForce(c.contracts, clientId, to);
    if (con && (con.pricingModel === "fixed_labour" || con.pricingModel === "hourly")) {
      const d = segmentDays(c.segments, w.id, month).filter((s) => s.status === "active" || s.status === "probation").reduce((a, s) => a + s.days, 0);
      const r = con.rates[0]?.amount ?? 0;
      revenue += con.pricingModel === "fixed_labour" ? roundDiv(r * Math.min(d, 26), 26) : d * 8 * r;
    }
    const pay = c.entries.find((e) => e.workerId === w.id && e.periodId === `pp-${month}`)?.result.gross ?? 0;
    const hl = w.housingLocationId ? c.locations.find((l) => l.id === w.housingLocationId) : undefined;
    const housing = hl?.monthlyCost && w.housingLocationId ? Math.round(hl.monthlyCost / (housingHeads.get(w.housingLocationId) ?? 1)) : 0;
    const veh = asg?.vehicleId ? c.vehicles.find((v) => v.id === asg.vehicleId) : undefined;
    const vehicleCost = veh ? Math.round(veh.monthlyCost / (vehicleUsers.get(veh.id)?.size || 1)) : 0;
    const tr = placed.some((p) => p.id === w.id) && placed.length ? Math.round(transport / placed.length) : 0;
    return { id: w.id, workerId: w.id, clientId, contractNo: con?.contractNo ?? "—", vehicleId: asg?.vehicleId ?? "none", revenue, pay, housing, vehicleCost, transport: tr, margin: revenue - pay - housing - vehicleCost - tr };
  });
}

/* ---- housing ---- */
export const HOUSING_CAPACITY: Record<string, number> = { "loc-h1": 24, "loc-h2": 30, "loc-h3": 16 };

/* ---- attendance per site ---- */
export function attendance(workers: Worker[], assignments: Assignment[], segments: StatusSegment[], month: string) {
  const g = new Map<string, { clientId: string; site: string; heads: number; present: number; leave: number; unpaid: number }>();
  for (const w of workers) {
    const a = assignments.find((x) => x.workerId === w.id && x.kind === "regular" && !w.roles.includes("driver") && overlaps(x.from, x.to, monthStart(month), monthEnd(month)));
    if (!a) continue;
    const key = `${a.clientId}|${a.place}`;
    const row = g.get(key) ?? { clientId: a.clientId, site: a.place ?? "—", heads: 0, present: 0, leave: 0, unpaid: 0 };
    row.heads++;
    for (const s of segmentDays(segments, w.id, month)) {
      if (s.status === "active" || s.status === "probation" || s.status === "training") row.present += s.days;
      else if (s.status === "sick_leave" || s.status === "annual_leave") row.leave += s.days;
      else row.unpaid += s.days;
    }
    g.set(key, row);
  }
  return [...g].map(([id, r]) => ({ id, ...r, pct: r.heads ? (r.present / (r.heads * daysInMonth(month))) * 100 : 0 }));
}

/* ---- trends ---- */
export function trends(orders: Order[], endDate: string) {
  const dow = Array.from({ length: 7 }, () => ({ total: 0, days: new Set<string>() }));
  for (const o of orders) if (o.date <= endDate && o.date > addDays(endDate, -56)) { const d = dowOf(o.date); dow[d].total += volume(o); dow[d].days.add(o.date); }
  const weeks = Array.from({ length: 6 }, (_, i) => { const to = addDays(endDate, -7 * i), from = addDays(to, -6); return { from, to, total: orders.filter((o) => o.date >= from && o.date <= to).reduce((a, o) => a + volume(o), 0) }; }).reverse();
  return { dow: dow.map((d) => (d.days.size ? d.total / d.days.size : 0)), weeks };
}
