import { formatKD } from "@/lib/money";
import type { PayrollEntry } from "./types";

export interface SlipLine { key: string; label: string; amount: number; note: string }
export interface Slip { earnings: SlipLine[]; deductions: SlipLine[]; gross: number; totalDeductions: number; net: number }

const kd = (n: number) => formatKD(n, { symbol: false });

/** Every component individually, each with the arithmetic that produced it. */
export function payslipLines(e: PayrollEntry): Slip {
  const { input: i, result: r } = e;
  const m = i.params.marketplace;
  const earnings: SlipLine[] = [
    { key: "base", label: "Base pay", amount: r.basePay, note: `(${kd(i.base)} base + ${kd(i.overtime)} overtime) × min(1, ${r.paidDays} paid days ÷ 26)` },
    { key: "excess", label: "Excess pay", amount: r.excessPay, note: `${r.excessDays} day(s) above 26 (order-producing days ${r.orderProducingDays}) at daily rate ${kd(r.dailyRate)}` },
    { key: "food", label: "Food allowance", amount: r.food, note: r.foodEligibleDays > 0 ? `Flat monthly, ${r.foodEligibleDays} eligible day(s)` : "No eligible day in the month" },
    { key: "accommodation", label: "Accommodation allowance", amount: r.accommodation, note: `${r.accommodationDays} eligible accommodation day(s) ÷ ${i.daysInMonth} × max ${kd(i.params.accommodationMax)}` },
    { key: "incentive", label: "Performance incentive", amount: r.incentive, note: i.params.monthlyOrderTarget ? `${i.orders} orders vs prorated target ${r.proratedTarget}; ${r.incentiveEligibleDays} of ${r.orderProducingDays} days incentive-eligible (probation earns no payout)` : "No order target configured" },
    { key: "mkt_bonus", label: "Marketplace bonus", amount: r.marketplaceBonus, note: m ? `${i.pickups} pickups / ${i.dropoffs} dropoffs vs targets ${m.pickupTarget} / ${m.dropoffTarget} (prorated)` : "Not a marketplace driver" },
  ];
  const deductions: SlipLine[] = [
    ...i.deductions.map((d, k) => ({ key: `ded${k}`, label: d.label, amount: d.amount, note: `${d.type.replace(/_/g, " ")}${d.planId ? " (instalment)" : d.manual ? " (manual)" : ""}` })),
    { key: "mkt_short", label: "Marketplace shortfall", amount: r.marketplaceShortfall, note: "Below pickup / dropoff target" },
  ];
  const totalDeductions = r.deductionTotal + r.marketplaceShortfall;
  return { earnings, deductions, gross: r.gross, totalDeductions, net: r.net };
}
