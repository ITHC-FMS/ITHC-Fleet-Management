import type { Contract, Worker } from "../entities";
import { roundDiv } from "./payroll-engine";
import { segmentDays } from "./statuses";
import { overlaps } from "@/lib/dates";
import { monthEnd, monthStart } from "./dates";
import type { Assignment, Order, StatusSegment } from "./types";

export function contractInForce(contracts: Contract[], clientId: string, date: string): Contract | undefined {
  return contracts
    .filter((c) => c.clientId === clientId && c.status !== "draft" && c.validFrom <= date && (c.validTo === null || c.validTo >= date))
    .sort((a, b) => b.version - a.version)[0];
}
const rate = (c: Contract | undefined, key: string) => c?.rates.find((r) => r.key === key)?.amount ?? 0;

/** Marketplace achievement fee follows the batch snapshotted on the order. */
export function revenueForOrder(o: Order, worker: Worker | undefined, contracts: Contract[]): number {
  const c = contractInForce(contracts, o.clientId, o.date);
  if (!c) return 0;
  if (o.kind === "store") return o.orders * rate(c, worker?.vehicleTypes?.[0] === "bike" ? "bike" : "car");
  const ach = o.batch === "Batch 1" ? rate(c, "ach_b1") : o.batch === "Batch 2" ? rate(c, "ach_b2") : 0;
  return (o.pickups + o.dropoffs) * (rate(c, "admin_fee") + rate(c, "ops_fee") + ach);
}

export interface RevenueCtx { orders: Order[]; contracts: Contract[]; workers: Worker[]; assignments: Assignment[]; segments: StatusSegment[] }

/** Revenue per client and month: orders priced on the version in force, plus attendance-driven labour charges. */
export function clientRevenue(clientId: string, month: string, ctx: RevenueCtx): number {
  const wById = new Map(ctx.workers.map((w) => [w.id, w]));
  let total = 0;
  for (const o of ctx.orders) if (o.clientId === clientId && o.date.startsWith(month)) total += revenueForOrder(o, wById.get(o.workerId), ctx.contracts);
  const c = contractInForce(ctx.contracts, clientId, monthEnd(month));
  if (c && (c.pricingModel === "fixed_labour" || c.pricingModel === "hourly")) {
    const seen = new Set<string>();
    for (const a of ctx.assignments) {
      if (a.clientId !== clientId || a.kind !== "regular" || seen.has(a.workerId) || !overlaps(a.from, a.to, monthStart(month), monthEnd(month))) continue;
      seen.add(a.workerId);
      const days = segmentDays(ctx.segments, a.workerId, month).filter((s) => s.status === "active" || s.status === "probation").reduce((x, s) => x + s.days, 0);
      total += c.pricingModel === "fixed_labour" ? roundDiv(rate(c, "monthly") * Math.min(days, 26), 26) : days * 8 * rate(c, "hour");
    }
  }
  return total;
}
