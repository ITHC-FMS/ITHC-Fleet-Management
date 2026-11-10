/**
 * Driver earnings engine (spec 7.6). PURE and dependency-free: no React, no storage, no imports.
 * All money is integer FILS. Every component is rounded half up at the end of that component.
 * Targets, rates and status treatment are inputs, never constants in the computation.
 */
export type Fils = number;

export type EngineStatus =
  | "active" | "training" | "probation" | "accommodation" | "sick_leave" | "annual_leave"
  | "standby" | "inactive" | "blocked" | "absconded" | "terminated";

export type AccommodationReason = "onboarding" | "between_assignments" | "standby" | "sick_housing" | "refused_work";

/** Days spent in one status within the month (statuses are additive, not exclusive). */
export interface StatusDays { status: EngineStatus; days: number; reason?: AccommodationReason }

export interface StatusRule {
  /** Counts toward paid_days. */
  paid: boolean;
  /** Order-producing: counts toward excess pay and the prorated order target. */
  orderProducing: boolean;
  /** Counts as an eligible day for the flat food allowance. */
  foodEligible: boolean;
  /** Probation accrues target proration but its days are not incentive-eligible (no payout). */
  incentiveEligible: boolean;
}

export const DEFAULT_STATUS_RULES: Record<EngineStatus, StatusRule> = {
  active: { paid: true, orderProducing: true, foodEligible: true, incentiveEligible: true },
  training: { paid: true, orderProducing: false, foodEligible: true, incentiveEligible: false },
  probation: { paid: true, orderProducing: true, foodEligible: true, incentiveEligible: false },
  accommodation: { paid: true, orderProducing: false, foodEligible: false, incentiveEligible: false },
  sick_leave: { paid: true, orderProducing: false, foodEligible: false, incentiveEligible: false },
  annual_leave: { paid: true, orderProducing: false, foodEligible: false, incentiveEligible: false },
  standby: { paid: true, orderProducing: false, foodEligible: true, incentiveEligible: false },
  inactive: { paid: false, orderProducing: false, foodEligible: false, incentiveEligible: false },
  blocked: { paid: false, orderProducing: false, foodEligible: false, incentiveEligible: false },
  absconded: { paid: false, orderProducing: false, foodEligible: false, incentiveEligible: false },
  terminated: { paid: false, orderProducing: false, foodEligible: false, incentiveEligible: false },
};

/** Accommodation reasons that qualify for the living allowance (refused work does not). */
export const DEFAULT_ACCOMMODATION_ELIGIBLE: AccommodationReason[] = ["onboarding", "between_assignments", "standby", "sick_housing"];

export interface MarketplaceParams {
  pickupTarget: number; dropoffTarget: number;           // monthly targets (events)
  pickupBonusRate: Fils; pickupShortfallRate: Fils;       // fils per event above / below target
  dropoffBonusRate: Fils; dropoffShortfallRate: Fils;
}

export interface PayParams {
  foodAllowance: Fils;
  accommodationMax: Fils;
  monthlyOrderTarget: number;     // orders per full month
  incentiveRateAbove: Fils;       // fils per order above prorated target
  incentiveRateBelow: Fils;       // fils per order below prorated target (applied as a negative)
  marketplace?: MarketplaceParams;
}

export interface DeductionLine { type: string; label: string; amount: Fils }

export interface PayrollInput {
  daysInMonth: number;
  base: Fils;
  overtime: Fils;
  segments: StatusDays[];
  orders: number;
  pickups: number;
  dropoffs: number;
  params: PayParams;
  deductions: DeductionLine[];
  standardDays?: number;                              // default 26
  rules?: Partial<Record<EngineStatus, StatusRule>>;
  accommodationEligible?: AccommodationReason[];
}

export interface PayrollResult {
  dailyRate: Fils;
  paidDays: number;
  orderProducingDays: number;
  excessDays: number;
  foodEligibleDays: number;
  accommodationDays: number;
  incentiveEligibleDays: number;
  /** Prorated order target, shown to 3 decimals as a string (it is not money). */
  proratedTarget: string;
  basePay: Fils;
  excessPay: Fils;
  food: Fils;
  accommodation: Fils;
  incentive: Fils;            // signed: negative when below target
  marketplaceBonus: Fils;
  marketplaceShortfall: Fils; // positive amount, subtracted in net
  gross: Fils;
  deductionTotal: Fils;       // manual/plan deductions only
  deductions: DeductionLine[];
  net: Fils;
  flags: string[];
}

/** Integer division rounded half up (toward +infinity on exact ties). */
export const roundDiv = (num: number, den: number): number => Math.floor((2 * num + den) / (2 * den));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function computePayroll(input: PayrollInput): PayrollResult {
  const std = input.standardDays ?? 26;
  const dim = input.daysInMonth;
  const rules = { ...DEFAULT_STATUS_RULES, ...(input.rules ?? {}) };
  const accElig = input.accommodationEligible ?? DEFAULT_ACCOMMODATION_ELIGIBLE;
  const monthly = input.base + input.overtime;
  const flags: string[] = [];

  const daysWhere = (f: (s: StatusDays, r: StatusRule) => boolean) =>
    sum(input.segments.filter((s) => f(s, rules[s.status])).map((s) => s.days));

  const paidDays = daysWhere((_, r) => r.paid);
  const producing = daysWhere((_, r) => r.orderProducing);
  const foodDays = daysWhere((_, r) => r.foodEligible);
  const eligibleIncDays = daysWhere((_, r) => r.orderProducing && r.incentiveEligible);
  const accDays = daysWhere((s) => s.status === "accommodation" && !!s.reason && accElig.includes(s.reason));
  if (paidDays > dim) flags.push("Paid days exceed days in month: overlapping status segments");

  const dailyRate = roundDiv(monthly, std);
  const basePay = roundDiv(monthly * Math.min(paidDays, std), std);
  const excessDays = Math.max(0, producing - std);
  const excessPay = roundDiv(monthly * excessDays, std);
  const food = foodDays > 0 ? input.params.foodAllowance : 0;
  const accommodation = roundDiv(input.params.accommodationMax * Math.min(accDays, dim), dim);

  // Incentive: variance vs target prorated by order-producing days (probation included in proration),
  // paid only for the incentive-eligible share of those days.
  const varianceNum = input.orders * dim - input.params.monthlyOrderTarget * producing; // in orders x dim
  let incentive = 0;
  if (producing > 0 && eligibleIncDays > 0) {
    const rate = varianceNum >= 0 ? input.params.incentiveRateAbove : input.params.incentiveRateBelow;
    incentive = roundDiv(varianceNum * rate * eligibleIncDays, dim * producing);
  }
  const proratedTarget = ((input.params.monthlyOrderTarget * producing) / dim).toFixed(3);

  let marketplaceBonus = 0, marketplaceShortfall = 0;
  const m = input.params.marketplace;
  if (m && producing > 0) {
    const leg = (actual: number, target: number, bonusRate: Fils, shortRate: Fils) => {
      const v = actual * dim - target * producing;
      return v >= 0 ? { bonus: roundDiv(v * bonusRate, dim), short: 0 } : { bonus: 0, short: roundDiv(-v * shortRate, dim) };
    };
    const p = leg(input.pickups, m.pickupTarget, m.pickupBonusRate, m.pickupShortfallRate);
    const d = leg(input.dropoffs, m.dropoffTarget, m.dropoffBonusRate, m.dropoffShortfallRate);
    marketplaceBonus = p.bonus + d.bonus;
    marketplaceShortfall = p.short + d.short;
  }

  const gross = basePay + excessPay + food + accommodation + incentive + marketplaceBonus;
  const deductionTotal = sum(input.deductions.map((d) => d.amount));
  const net = gross - deductionTotal - marketplaceShortfall;
  if (net < 0) flags.push("Negative net pay");
  return {
    dailyRate, paidDays, orderProducingDays: producing, excessDays, foodEligibleDays: foodDays, accommodationDays: accDays,
    incentiveEligibleDays: eligibleIncDays, proratedTarget, basePay, excessPay, food, accommodation, incentive,
    marketplaceBonus, marketplaceShortfall, gross, deductionTotal, deductions: input.deductions, net, flags,
  };
}

/* ---------------- self-check (hard-coded scenarios, hand-derived expected figures) ---------------- */

const P: PayParams = { foodAllowance: 25_000, accommodationMax: 60_000, monthlyOrderTarget: 800, incentiveRateAbove: 120, incentiveRateBelow: 60 };
const none: Pick<PayrollInput, "orders" | "pickups" | "dropoffs" | "deductions"> = { orders: 0, pickups: 0, dropoffs: 0, deductions: [] };

interface Scenario { name: string; input: PayrollInput; expect: Partial<Record<keyof PayrollResult, number>> }

export const SELF_CHECK_SCENARIOS: Scenario[] = [
  {
    name: "Full 30-day month with marketplace bonus and deduction",
    input: {
      daysInMonth: 30, base: 200_000, overtime: 40_000, segments: [{ status: "active", days: 30 }],
      orders: 900, pickups: 500, dropoffs: 300,
      params: { ...P, marketplace: { pickupTarget: 400, dropoffTarget: 350, pickupBonusRate: 100, pickupShortfallRate: 90, dropoffBonusRate: 110, dropoffShortfallRate: 80 } },
      deductions: [{ type: "traffic_fine", label: "Traffic fine", amount: 20_000 }],
    },
    // 240000; excess 4d = 240000*4/26 = 36923.08; food 25000; incentive (900-800)*120 = 12000; bonus (500-400)*100 = 10000; short (350-300)*80 = 4000
    expect: { basePay: 240_000, excessPay: 36_923, food: 25_000, incentive: 12_000, marketplaceBonus: 10_000, marketplaceShortfall: 4_000, gross: 323_923, net: 299_923 },
  },
  {
    name: "Mixed-status 31-day month (active, sick, annual leave, onboarding accommodation)",
    input: {
      daysInMonth: 31, base: 200_000, overtime: 40_000, orders: 500, pickups: 0, dropoffs: 0, params: P, deductions: [],
      segments: [{ status: "active", days: 20 }, { status: "sick_leave", days: 5 }, { status: "annual_leave", days: 3 }, { status: "accommodation", days: 3, reason: "onboarding" }],
    },
    // paid 31 -> base 240000; producing 20 -> no excess; accommodation 60000*3/31 = 5806.45; incentive (500*31-800*20)=-500 *60/31 = -967.74
    expect: { basePay: 240_000, excessPay: 0, food: 25_000, accommodation: 5_806, incentive: -968, gross: 269_838, net: 269_838 },
  },
  {
    name: "Probation: target accrues but no incentive payout",
    input: { daysInMonth: 30, base: 180_000, overtime: 40_000, orders: 1000, pickups: 0, dropoffs: 0, params: P, deductions: [], segments: [{ status: "probation", days: 30 }] },
    // 220000; excess 4d = 220000*4/26 = 33846.15; food 25000; incentive 0
    expect: { basePay: 220_000, excessPay: 33_846, incentive: 0, gross: 278_846 },
  },
  {
    name: "Exactly at target (orders and marketplace): zero variance",
    input: {
      daysInMonth: 30, base: 200_000, overtime: 0, segments: [{ status: "active", days: 30 }], orders: 800, pickups: 400, dropoffs: 380,
      params: { ...P, marketplace: { pickupTarget: 400, dropoffTarget: 380, pickupBonusRate: 100, pickupShortfallRate: 90, dropoffBonusRate: 110, dropoffShortfallRate: 80 } },
      deductions: [],
    },
    // 200000 + excess 200000*4/26 = 30769.23 + food 25000
    expect: { basePay: 200_000, excessPay: 30_769, incentive: 0, marketplaceBonus: 0, marketplaceShortfall: 0, gross: 255_769 },
  },
  {
    name: "Placed labour: no orders, no vehicle, 22 attendance days",
    input: { daysInMonth: 30, base: 150_000, overtime: 0, segments: [{ status: "active", days: 22 }], ...none, params: { ...P, monthlyOrderTarget: 0 }, deductions: [{ type: "other", label: "Equipment", amount: 10_000 }] },
    // 150000*22/26 = 126923.08; no excess; food 25000; no order components
    expect: { basePay: 126_923, excessPay: 0, incentive: 0, food: 25_000, gross: 151_923, net: 141_923 },
  },
];

export interface SelfCheckResult { pass: boolean; results: { name: string; pass: boolean; failures: string[] }[] }

export function runSelfCheck(): SelfCheckResult {
  const results = SELF_CHECK_SCENARIOS.map((sc) => {
    const out = computePayroll(sc.input);
    const failures: string[] = [];
    for (const [k, want] of Object.entries(sc.expect)) {
      const got = out[k as keyof PayrollResult] as number;
      if (got !== want) failures.push(`${k}: expected ${want}, got ${got}`);
    }
    return { name: sc.name, pass: failures.length === 0, failures };
  });
  return { pass: results.every((r) => r.pass), results };
}
