import type { BizDate } from "@/lib/dates";
import type { Fils } from "@/lib/money";

/** Ratios are stored as integer hundredths (200 = 2.00x) so no floats are involved. */
export interface Thresholds { id: "thresholds"; approvalMultiple: number; escalateMultiple: number; }

export type ApprovalStatus = "pending" | "approved" | "declined";
export interface ContractApproval {
  id: string;
  opportunity: string;
  clientId: string;
  contractNo?: string;
  pricingModel: string;
  heads: number;
  revenuePerHead: Fils;
  breakEvenPerHead: Fils;
  requestedBy: string;
  requestedRole: string;
  requestedAt: BizDate;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: BizDate;
  reason?: string;
}

export interface SignedOpportunity {
  id: string;
  name: string;
  clientId: string;
  pricingModel: string;
  heads: number;
  revenuePerHead: Fils;
  startDate: BizDate;
  signedBy: string;
  signedAt: BizDate;
  approvalId?: string;
  status: "awaiting_contract" | "converted";
  contractNo?: string;
}

export interface CashCollection {
  id: string;
  date: BizDate;
  workerId: string;
  clientId: string;
  collected: Fils;
  /** null = not yet handed over */
  handedOver: Fils | null;
  deduction: "none" | "queued" | "deducted" | "waived";
  payrollPeriod?: string;
  note?: string;
  version: number;
}

export interface Zone { id: string; name: string; area: string; status: "active" | "inactive"; version: number; }
export interface Store { id: string; name: string; clientId: string; zoneId: string; address: string; status: "active" | "inactive"; version: number; }

export type AuditAction = "create" | "update" | "delete" | "approve" | "decline" | "override" | "reopen";
export interface AuditEntry {
  id: string;
  /** "YYYY-MM-DD HH:mm" */
  at: string;
  user: string;
  role: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  action: AuditAction;
  summary: string;
  reason: string;
  before?: string;
  after?: string;
}

export type CostType = "rental_charge" | "instalment" | "maintenance" | "fuel" | "fine" | "accommodation" | "insurance" | "other";
export type CostTarget = "vehicle" | "worker" | "client" | "property" | "company";
export interface CostRecord {
  id: string;
  date: BizDate;
  type: CostType;
  target: CostTarget;
  /** vehicle / worker / client / location id; empty for company */
  refId: string;
  amount: Fils;
  notes?: string;
}

/** One priced event row. Priced live against the contract version in force on `date`. */
export interface RevenueTx {
  id: string;
  date: BizDate;
  contractNo: string;
  /** Rate line key for non-batched models; omitted for marketplace-batched (the line stack applies). */
  lineKey?: string;
  vehicleType?: "car" | "bike";
  /** Orders / hours / head-months. May be fractional (prorated head-months). */
  qty: number;
  /** Snapshot taken at order time. */
  batch?: string;
  batchOriginal?: string;
  overrideReason?: string;
  overrideBy?: string;
  period: "day" | "month";
  note?: string;
}

export interface InvoiceRecon {
  id: string;
  clientId: string;
  period: string; // YYYY-MM
  invoiced: Fils;
  status: "open" | "reconciled" | "disputed";
  note?: string;
  reconciledBy?: string;
  version: number;
}

export interface ContractDoc {
  id: string;
  contractNo: string;
  docType: string;
  fileName: string;
  issued: BizDate;
  expires: BizDate | null;
  authority: string;
  uploadedBy: string;
  uploadedAt: BizDate;
  docVersion: number;
  status: "current" | "superseded";
}

export interface ContactEntry {
  id: string;
  date: BizDate;
  clientId: string;
  contractNo: string;
  type: "call" | "visit" | "email" | "meeting";
  outcome: string;
  loggedBy: string;
}

export interface TcoProfile {
  id: string; // vehicle id
  startDate: BizDate;
  /** rented */
  returnConditions: string;
  /** cash */
  purchasePrice: Fils;
  residualPct: number;
  lifeMonths: number;
  /** financed */
  instalment: Fils;
  termMonths: number;
  principal: Fils;
  lienHolder: string;
}

export interface WorkerState { id: string; since: BizDate; }
