import type { BizDate } from "@/lib/dates";
import type { Fils } from "@/lib/money";
import type { AccommodationReason, DeductionLine, MarketplaceParams, PayrollInput, PayrollResult } from "./payroll-engine";

/* ---------- Orders: discriminated by pricing model, not one table with nullable columns ---------- */
interface OrderBase { id: string; date: BizDate; workerId: string; clientId: string; place: string; version: number; enteredBy: string }
export interface StoreOrder extends OrderBase { kind: "store"; orders: number }
export interface MarketplaceOrder extends OrderBase { kind: "marketplace"; pickups: number; dropoffs: number; /** batch snapshot at order time */ batch: string }
export type Order = StoreOrder | MarketplaceOrder;

/* ---------- Assignments / schedule ---------- */
export type ShiftPattern = "full" | "am" | "pm";
export interface Assignment {
  id: string; workerId: string; clientId: string; vehicleId?: string; place?: string;
  from: BizDate; to: BizDate | null; /** inclusive */
  ownerCompanyId: string; kind: "regular" | "substitution"; substitutesWorkerId?: string;
  shift: ShiftPattern; note?: string; version: number;
}
export interface Shift {
  id: string; date: BizDate; workerId: string; vehicleId?: string; clientId: string; place?: string;
  plannedStart: string; plannedEnd: string; actualStart?: string; actualEnd?: string; version: number;
}
export interface ConflictAck { id: string; key: string; note: string; by: string; at: string }

/* ---------- Workers ---------- */
export type StatusKey = "active" | "training" | "probation" | "accommodation" | "sick_leave" | "annual_leave" | "standby" | "inactive" | "blocked" | "absconded" | "terminated";
export interface StatusSegment { id: string; workerId: string; status: StatusKey; from: BizDate; to: BizDate | null; reason?: AccommodationReason; note?: string; version: number }
export interface WorkerExt {
  id: string; /* worker id */ email?: string; visaNo?: string; healthCardNo?: string; contractEnd?: BizDate; contractOwnerCompanyId: string;
  offboarding?: { startedOn: BizDate; lastDay: BizDate };
}
export interface WorkerLogin { id: string; username: string; tempPassword: string; revealed: boolean; views: { at: string; by: string }[]; emailedTo?: string; mustChange: boolean; active: boolean }
export interface DocExpiry { id: string; workerId: string; type: "civil_id" | "licence" | "visa" | "health_card" | "passport"; expires: BizDate }

/* ---------- Pay ---------- */
export interface PayParamRec {
  id: string; /* worker id */ foodAllowance: Fils; accommodationMax: Fils; monthlyOrderTarget: number;
  incentiveRateAbove: Fils; incentiveRateBelow: Fils; marketplace?: MarketplaceParams; effectiveFrom: BizDate; version: number;
}
export interface PayConfigItem { id: string; group: "deduction" | "bonus" | "allowance"; key: string; label: string; defaultFils?: Fils; active: boolean; system: boolean }
export interface PlanRepayment { periodId: string; amount: Fils }
export interface DeductionPlan {
  id: string; workerId: string; kind: string; description: string; total: Fils; instalment: Fils; startMonth: string; issuedOn: BizDate;
  repayments: PlanRepayment[]; cancelled?: boolean; version: number;
}
export type PeriodState = "not_generated" | "open" | "closed";
export interface PayrollPeriod {
  id: string; companyId: string; month: string; state: PeriodState; generatedAt?: string; approvedBy?: string; approvedAt?: string;
  events: { at: string; by: string; action: string; reason?: string }[]; version: number;
}
export interface EntryDeduction extends DeductionLine { planId?: string; manual?: boolean }
export interface PayrollEntry {
  id: string; periodId: string; workerId: string; input: Omit<PayrollInput, "deductions"> & { deductions: EntryDeduction[] }; result: PayrollResult;
  transition: string | null; placed: boolean;
}

/* ---------- Misc ---------- */
export interface AuditEntry { id: string; at: string; actor: string; entity: string; entityId: string; action: string; reason?: string; detail: string }
export interface FuelTx { id: string; date: BizDate; vehicleId: string; workerId?: string; litres: number; cost: Fils; odometerKm: number; handoverRef?: string }
export interface ClientInvoice { id: string; clientId: string; month: string; invoiced: Fils | null; status: "draft" | "sent" | "paid" | "not_issued" }
export interface WeeklyPerf { id: string; workerId: string; riderId: string; weekStart: BizDate; acceptance: number; plannedHours: number; actualHours: number; utilisation: number; lateLogin: number; specialCoverage: number }
export interface SpecialHours { id: string; label: string; day: string; from: string; to: string; multiplier?: string }
export interface Offboarding {
  id: string; /* worker id */ lastDay: BizDate; startedOn: BizDate; reason: string; vehicleReturned: boolean; vehicleReturnRef?: string;
  docs: { civilId: boolean; licence: boolean; uniform: boolean; keys: boolean; simCard: boolean; deviceBag: boolean };
  settlementApproved: boolean; completed: boolean; version: number;
}
export interface ImportLog { id: string; at: string; target: string; fileName: string; rows: number; committed: number; rejected: number; by: string }
