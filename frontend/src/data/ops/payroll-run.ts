import { overlaps } from "@/lib/dates";
import type { Contract, Worker } from "../entities";
import { daysInMonth, monthEnd, monthStart, prevMonth } from "./dates";
import { computePayroll, type PayParams } from "./payroll-engine";
import { contractInForce } from "./revenue";
import { segmentDays } from "./statuses";
import type { Assignment, DeductionPlan, EntryDeduction, Order, PayConfigItem, PayParamRec, PayrollEntry, StatusSegment } from "./types";

export interface RunContext {
  workers: Worker[]; segments: StatusSegment[]; orders: Order[]; plans: DeductionPlan[]; params: PayParamRec[];
  assignments: Assignment[]; contracts: Contract[]; config: PayConfigItem[];
}

export const periodIdOf = (month: string) => `pp-${month}`;

/* ---------- deduction plans (advances, fines, ...) ---------- */
export const planPaid = (p: DeductionPlan) => p.repayments.reduce((a, r) => a + r.amount, 0);
export const planRemaining = (p: DeductionPlan) => (p.cancelled ? 0 : p.total - planPaid(p));
export type PlanStatus = "issued" | "repaying" | "settled" | "cancelled";
export const planStatus = (p: DeductionPlan): PlanStatus => (p.cancelled ? "cancelled" : planPaid(p) === 0 ? "issued" : planRemaining(p) > 0 ? "repaying" : "settled");
/** Instalment due in `month` for a plan, ignoring repayments already recorded for that same period. */
export function planDue(p: DeductionPlan, month: string, periodId: string): number {
  if (p.cancelled || p.startMonth > month) return 0;
  const paidElsewhere = p.repayments.filter((r) => r.periodId !== periodId).reduce((a, r) => a + r.amount, 0);
  return Math.max(0, Math.min(p.instalment, p.total - paidElsewhere));
}
export const instalmentCount = (p: DeductionPlan) => Math.ceil(p.total / Math.max(1, p.instalment));

/** On approve/lock: record each plan line as a repayment (advances move issued to repaying to settled). */
export function applyRepayments(plans: DeductionPlan[], entries: PayrollEntry[], periodId: string): DeductionPlan[] {
  return plans.map((p) => {
    const lines = entries.flatMap((e) => e.input.deductions.filter((d) => d.planId === p.id));
    const amount = lines.reduce((a, d) => a + d.amount, 0);
    const base = p.repayments.filter((r) => r.periodId !== periodId);
    return amount > 0 ? { ...p, repayments: [...base, { periodId, amount }], version: p.version + 1 } : { ...p, repayments: base };
  });
}
export const revertRepayments = (plans: DeductionPlan[], periodId: string): DeductionPlan[] =>
  plans.map((p) => (p.repayments.some((r) => r.periodId === periodId) ? { ...p, repayments: p.repayments.filter((r) => r.periodId !== periodId), version: p.version + 1 } : p));

/* ---------- parameters ---------- */
export function paramsFor(worker: Worker, rec: PayParamRec | undefined, config: PayConfigItem[]): PayParams {
  const def = (key: string) => config.find((c) => c.group === "allowance" && c.key === key)?.defaultFils ?? 0;
  return {
    foodAllowance: rec?.foodAllowance ?? def("food"),
    accommodationMax: rec?.accommodationMax ?? def("accommodation"),
    monthlyOrderTarget: rec?.monthlyOrderTarget ?? 0,
    incentiveRateAbove: rec?.incentiveRateAbove ?? 0,
    incentiveRateBelow: rec?.incentiveRateBelow ?? 0,
    marketplace: rec?.marketplace,
  };
}

/* ---------- transition indicator ---------- */
export function detectTransition(workerId: string, month: string, assignments: Assignment[], contracts: Contract[]): string | null {
  const a = assignments
    .filter((x) => x.workerId === workerId && x.kind === "regular" && overlaps(x.from, x.to, monthStart(month), monthEnd(month)))
    .sort((x, y) => x.from.localeCompare(y.from));
  const clients = [...new Set(a.map((x) => x.clientId))];
  if (clients.length > 1) return `Client changed in period: ${clients.join(" → ").replace(/cli-/g, "")}`;
  if (clients.length === 1) {
    const c1 = contractInForce(contracts, clients[0], monthStart(month));
    const c2 = contractInForce(contracts, clients[0], monthEnd(month));
    if (c1 && c2 && c1.id !== c2.id) return `Contract ${c1.contractNo} v${c1.version} → v${c2.version} in period`;
  }
  return null;
}

/* ---------- entries ---------- */
export function buildEntry(month: string, worker: Worker, ctx: RunContext, keepManual: EntryDeduction[] = []): PayrollEntry | null {
  const periodId = periodIdOf(month);
  const segments = segmentDays(ctx.segments, worker.id, month);
  if (!segments.length) return null;
  let orders = 0, pickups = 0, dropoffs = 0;
  for (const o of ctx.orders) {
    if (o.workerId !== worker.id || !o.date.startsWith(month)) continue;
    if (o.kind === "store") orders += o.orders;
    else { pickups += o.pickups; dropoffs += o.dropoffs; }
  }
  const hasVehicle = ctx.assignments.some((a) => a.workerId === worker.id && a.vehicleId && overlaps(a.from, a.to, monthStart(month), monthEnd(month)));
  const planLines: EntryDeduction[] = ctx.plans
    .filter((p) => p.workerId === worker.id)
    .map((p) => ({ p, due: planDue(p, month, periodId) }))
    .filter((x) => x.due > 0)
    .map(({ p, due }) => ({ type: p.kind, label: p.description, amount: due, planId: p.id }));
  const input = {
    daysInMonth: daysInMonth(month), base: worker.baseSalary, overtime: worker.overtimeComponent, segments,
    orders, pickups, dropoffs, params: paramsFor(worker, ctx.params.find((p) => p.id === worker.id), ctx.config),
    deductions: [...planLines, ...keepManual],
  };
  return {
    id: `${periodId}:${worker.id}`, periodId, workerId: worker.id, input, result: computePayroll(input),
    transition: detectTransition(worker.id, month, ctx.assignments, ctx.contracts), placed: orders + pickups + dropoffs === 0 && !hasVehicle,
  };
}

export function generateEntries(month: string, ctx: RunContext, previous: PayrollEntry[] = []): PayrollEntry[] {
  const manual = new Map(previous.map((e) => [e.workerId, e.input.deductions.filter((d) => d.manual)]));
  return ctx.workers.flatMap((w) => {
    const e = buildEntry(month, w, ctx, manual.get(w.id) ?? []);
    return e ? [e] : [];
  });
}

/** Re-run the engine for an entry after an inline deduction change. */
export function withDeductions(e: PayrollEntry, deductions: EntryDeduction[]): PayrollEntry {
  const input = { ...e.input, deductions };
  return { ...e, input, result: computePayroll(input) };
}

export { prevMonth };
