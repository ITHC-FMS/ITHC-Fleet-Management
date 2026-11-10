import type { Client, Contract, Location, Vehicle, Worker } from "../entities";
import { daysBetween, TODAY } from "@/lib/dates";
import { sum, type PricedTx } from "./engine";
import type { CostRecord, RevenueTx, TcoProfile } from "./types";

export const INTERNAL_ROLES = ["handover", "service", "admin"];
/** Insurance, permit amortisation and similar carrying cost per head per month (fils). */
export const ONCOST_PER_HEAD = 30_000;
const WEIGHT: Record<string, number> = { active: 1, probation: 1 };

export interface MarginRow {
  id: string;
  kind: "worker" | "client" | "vehicle" | "contract";
  label: string;
  sub: string;
  clientId?: string;
  workerId?: string;
  revenue: number;
  cost: number;
  housing: number;
  transport: number;
  margin: number;
}
export interface MarginModel {
  month: string;
  workers: MarginRow[];
  clients: MarginRow[];
  vehicles: MarginRow[];
  contracts: MarginRow[];
  driverVehicle: Map<string, string>;
}

export interface Inputs {
  workers: Worker[]; vehicles: Vehicle[]; locations: Location[]; clients: Client[]; contracts: Contract[];
  priced: PricedTx[]; costs: CostRecord[];
}

const inMonth = (d: string, month: string) => d.startsWith(month);
const costOf = (costs: CostRecord[], month: string, target: CostRecord["target"], refId?: string) =>
  sum(costs.filter((c) => inMonth(c.date, month) && c.target === target && (refId === undefined || c.refId === refId)).map((c) => c.amount));

export function driverVehicleMap(workers: Worker[], vehicles: Vehicle[]) {
  const pool = vehicles.filter((v) => v.type !== "transport" && v.status === "in_service");
  const m = new Map<string, string>();
  workers.filter((w) => w.roles.includes("driver")).forEach((w, i) => { if (pool.length) m.set(w.id, pool[i % pool.length].id); });
  return m;
}

export function buildMargin(inp: Inputs, month: string): MarginModel {
  const { workers, vehicles, locations, clients, contracts, priced, costs } = inp;
  const staff = workers.filter((w) => !w.roles.some((r) => INTERNAL_ROLES.includes(r)) && w.status !== "terminated");
  const driverVehicle = driverVehicleMap(workers, vehicles);

  // revenue by client
  const clientRev = new Map<string, number>();
  for (const p of priced) if (inMonth(p.tx.date, month) && p.clientId) clientRev.set(p.clientId, (clientRev.get(p.clientId) ?? 0) + p.priced.amount);

  // housing per head (monthly cost + property-attributed costs, split across occupants)
  const occupants = new Map<string, number>();
  workers.forEach((w) => w.housingLocationId && occupants.set(w.housingLocationId, (occupants.get(w.housingLocationId) ?? 0) + 1));
  const housingPerHead = (locId?: string) => {
    if (!locId) return 0;
    const loc = locations.find((l) => l.id === locId);
    const total = (loc?.monthlyCost ?? 0) + costOf(costs, month, "property", locId);
    return Math.round(total / Math.max(1, occupants.get(locId) ?? 1));
  };

  // vehicles
  const vehCost = (v: Vehicle) => v.monthlyCost + costOf(costs, month, "vehicle", v.id);
  const driversOn = new Map<string, number>();
  driverVehicle.forEach((vid) => driversOn.set(vid, (driversOn.get(vid) ?? 0) + 1));
  const transportVans = vehicles.filter((v) => v.type === "transport");
  const nonDriverPlaced = staff.filter((w) => !w.roles.includes("driver") && w.currentClientId);
  const sharedTransportPerHead = Math.round(sum(transportVans.map(vehCost)) / Math.max(1, nonDriverPlaced.length));

  // revenue weights per client
  const weightSum = new Map<string, number>();
  staff.forEach((w) => w.currentClientId && weightSum.set(w.currentClientId, (weightSum.get(w.currentClientId) ?? 0) + (WEIGHT[w.status] ?? 0)));

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name ?? "Bench";
  const workerRows: MarginRow[] = staff.map((w) => {
    const wt = WEIGHT[w.status] ?? 0;
    const revenue = w.currentClientId && wt ? Math.round(((clientRev.get(w.currentClientId) ?? 0) * wt) / (weightSum.get(w.currentClientId) || 1)) : 0;
    const vid = driverVehicle.get(w.id);
    const veh = vehicles.find((v) => v.id === vid);
    const transport = veh ? Math.round(vehCost(veh) / (driversOn.get(veh.id) ?? 1)) : w.currentClientId ? sharedTransportPerHead : 0;
    const cost = w.baseSalary + w.overtimeComponent + ONCOST_PER_HEAD + costOf(costs, month, "worker", w.id);
    const housing = housingPerHead(w.housingLocationId);
    return { id: w.id, kind: "worker", label: w.name, sub: `${clientName(w.currentClientId)} · ${w.status.replace(/_/g, " ")}`, clientId: w.currentClientId, workerId: w.id, revenue, cost, housing, transport, margin: revenue - cost - housing - transport };
  });

  const agg = (id: string, kind: MarginRow["kind"], label: string, sub: string, rows: MarginRow[], extraCost = 0, revenueOverride?: number, clientId?: string): MarginRow => {
    const revenue = revenueOverride ?? sum(rows.map((r) => r.revenue));
    const cost = sum(rows.map((r) => r.cost)) + extraCost;
    const housing = sum(rows.map((r) => r.housing));
    const transport = sum(rows.map((r) => r.transport));
    return { id, kind, label, sub, clientId, revenue, cost, housing, transport, margin: revenue - cost - housing - transport };
  };

  const clientRows = clients.map((c) => {
    const rows = workerRows.filter((r) => r.clientId === c.id);
    return agg(c.id, "client", c.name, `${c.model} · ${rows.length} heads`, rows, costOf(costs, month, "client", c.id), clientRev.get(c.id) ?? 0, c.id);
  });
  const benchRows = workerRows.filter((r) => !r.clientId);
  if (benchRows.length) clientRows.push(agg("bench", "client", "Bench (unplaced)", `${benchRows.length} heads, no revenue`, benchRows));

  const contractNos = [...new Set(contracts.map((c) => c.contractNo))];
  const contractRows = contractNos.map((no) => {
    const latest = contracts.filter((c) => c.contractNo === no).sort((a, b) => b.version - a.version)[0];
    const cr = clientRows.find((r) => r.id === latest.clientId);
    const sameClient = contractNos.filter((n) => contracts.find((c) => c.contractNo === n)?.clientId === latest.clientId);
    const rev = sum(priced.filter((p) => p.tx.contractNo === no && inMonth(p.tx.date, month)).map((p) => p.priced.amount));
    const share = sameClient.length > 1 && cr && cr.revenue ? rev / cr.revenue : 1 / sameClient.length;
    return {
      id: no, kind: "contract" as const, label: no, sub: `${clientName(latest.clientId)} · v${latest.version}`, clientId: latest.clientId,
      revenue: rev, cost: Math.round((cr?.cost ?? 0) * share), housing: Math.round((cr?.housing ?? 0) * share), transport: Math.round((cr?.transport ?? 0) * share),
      margin: rev - Math.round((cr?.cost ?? 0) * share) - Math.round((cr?.housing ?? 0) * share) - Math.round((cr?.transport ?? 0) * share),
    };
  });

  const vehicleRows = vehicles.map((v) => {
    const dids = [...driverVehicle.entries()].filter(([, vid]) => vid === v.id).map(([wid]) => wid);
    const rows = workerRows.filter((r) => r.workerId && dids.includes(r.workerId));
    const row = agg(v.id, "vehicle", v.plate, `${v.make} ${v.model} · ${v.ownership} · ${rows.length} driver${rows.length === 1 ? "" : "s"}`, rows);
    if (!rows.length) { row.transport = vehCost(v); row.margin = -vehCost(v); }
    return row;
  });

  return { month, workers: workerRows, clients: clientRows, vehicles: vehicleRows, contracts: contractRows, driverVehicle };
}

/* ---------------- P&L ---------------- */
export interface PnlRow { key: string; revenue: number; pay: number; housing: number; vehicles: number; other: number; cost: number; margin: number }

export const daysInMonth = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
/** Days of the month already elapsed in the demo (full month for past months). */
export const daysElapsed = (month: string) => (month === TODAY.slice(0, 7) ? Number(TODAY.slice(8, 10)) - 1 : month > TODAY.slice(0, 7) ? 0 : daysInMonth(month));

export function monthlyPnl(inp: Inputs, month: string): PnlRow {
  const { workers, vehicles, locations, priced, costs } = inp;
  const frac = daysElapsed(month) / daysInMonth(month);
  const revenue = sum(priced.filter((p) => inMonth(p.tx.date, month)).map((p) => p.priced.amount));
  const pay = Math.round(frac * sum(workers.filter((w) => w.status !== "terminated").map((w) => w.baseSalary + w.overtimeComponent + ONCOST_PER_HEAD)));
  const housing = Math.round(frac * sum(locations.filter((l) => l.kind === "housing").map((l) => l.monthlyCost ?? 0)));
  const veh = Math.round(frac * sum(vehicles.filter((v) => v.status !== "off_fleet").map((v) => v.monthlyCost)));
  const other = sum(costs.filter((c) => inMonth(c.date, month)).map((c) => c.amount));
  const cost = pay + housing + veh + other;
  return { key: month, revenue, pay, housing, vehicles: veh, other, cost, margin: revenue - cost };
}

export function dailyPnl(inp: Inputs, month: string): PnlRow[] {
  const n = daysInMonth(month);
  const m = monthlyPnl({ ...inp }, month);
  const fixedPerDay = (m.pay + m.housing + m.vehicles) / Math.max(1, daysElapsed(month));
  const out: PnlRow[] = [];
  for (let d = 1; d <= daysElapsed(month) && d <= n; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    let revenue = 0;
    for (const p of inp.priced) {
      if (p.tx.period === "day" && p.tx.date === date) revenue += p.priced.amount;
      else if (p.tx.period === "month" && inMonth(p.tx.date, month)) revenue += p.priced.amount / n;
    }
    revenue = Math.round(revenue);
    const other = sum(inp.costs.filter((c) => c.date === date).map((c) => c.amount));
    const fixed = Math.round(fixedPerDay);
    out.push({ key: date, revenue, pay: Math.round((m.pay / Math.max(1, daysElapsed(month)))), housing: Math.round(m.housing / Math.max(1, daysElapsed(month))), vehicles: Math.round(m.vehicles / Math.max(1, daysElapsed(month))), other, cost: fixed + other, margin: revenue - fixed - other });
  }
  return out;
}

/* ---------------- TCO ---------------- */
export interface TcoRow {
  id: string; vehicle: Vehicle; profile: TcoProfile; months: number;
  base: number; maintenance: number; fuel: number; total: number; perMonth: number;
  outstanding: number; label: string;
}
export function buildTco(vehicles: Vehicle[], profiles: TcoProfile[], costs: CostRecord[]): TcoRow[] {
  return vehicles.map((v) => {
    const p = profiles.find((x) => x.id === v.id)!;
    const months = Math.max(1, Math.round(daysBetween(p.startDate, TODAY) / 30));
    const maintenance = sum(costs.filter((c) => c.target === "vehicle" && c.refId === v.id && c.type === "maintenance").map((c) => c.amount));
    const fuel = sum(costs.filter((c) => c.target === "vehicle" && c.refId === v.id && c.type === "fuel").map((c) => c.amount));
    let base = 0, outstanding = 0, label = "";
    if (v.ownership === "rented") { base = v.monthlyCost * months; label = "Recurring rental charge"; }
    else if (v.ownership === "cash") {
      const dep = Math.round(((p.purchasePrice * (100 - p.residualPct)) / 100 / p.lifeMonths) * Math.min(months, p.lifeMonths));
      base = dep; label = "Depreciation to date"; outstanding = 0;
    } else {
      const paid = Math.min(months, p.termMonths);
      base = p.instalment * paid; outstanding = p.instalment * (p.termMonths - paid); label = "Instalments paid";
    }
    const total = base + maintenance + fuel;
    return { id: v.id, vehicle: v, profile: p, months, base, maintenance, fuel, total, perMonth: Math.round(total / months), outstanding, label };
  });
}

export const monthsList = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
export const monthLabel = (m: string) => {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}${m === TODAY.slice(0, 7) ? " (to date)" : ""}`;
};
export type { RevenueTx };
