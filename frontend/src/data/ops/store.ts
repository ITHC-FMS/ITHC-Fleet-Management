"use client";

import { useMemo } from "react";
import { defineCollection } from "../store";
import { workers as coreWorkersCol } from "../core";
import type { Worker } from "../entities";
import { TODAY } from "@/lib/dates";
import * as seed from "./seed";
import { statusOn } from "./statuses";
import type {
  Assignment, AuditEntry, ClientInvoice, ConflictAck, DeductionPlan, DocExpiry, FuelTx, ImportLog, Offboarding, Order, PayConfigItem, PayParamRec,
  PayrollEntry, PayrollPeriod, Shift, SpecialHours, StatusSegment, WeeklyPerf, WorkerExt, WorkerLogin,
} from "./types";

export const orders = defineCollection<Order>("ops_orders", seed.seedOrders);
export const assignments = defineCollection<Assignment>("ops_assignments", seed.seedAssignments);
export const shifts = defineCollection<Shift>("ops_shifts", () => seed.seedShifts().shifts);
export const conflictAcks = defineCollection<ConflictAck>("ops_conflict_acks", () => seed.seedShifts().acks);
export const segments = defineCollection<StatusSegment>("ops_status_segments", seed.seedSegments);
export const workerExt = defineCollection<WorkerExt>("ops_worker_ext", seed.seedExt);
export const workerLogins = defineCollection<WorkerLogin>("ops_worker_logins", seed.seedLogins);
export const docExpiries = defineCollection<DocExpiry>("ops_doc_expiries", seed.seedDocs);
export const payParams = defineCollection<PayParamRec>("ops_pay_params", seed.seedPayParams);
export const payConfig = defineCollection<PayConfigItem>("ops_pay_config", seed.seedPayConfig);
export const plans = defineCollection<DeductionPlan>("ops_deduction_plans", seed.seedPlans);
export const periods = defineCollection<PayrollPeriod>("ops_payroll_periods", seed.seedPeriods);
export const entries = defineCollection<PayrollEntry>("ops_payroll_entries", seed.seedEntries);
export const fuelTx = defineCollection<FuelTx>("ops_fuel", seed.seedFuel);
export const invoices = defineCollection<ClientInvoice>("ops_invoices", seed.seedInvoices);
export const weeklyPerf = defineCollection<WeeklyPerf>("ops_weekly_perf", seed.seedWeeklyPerf);
export const specialHours = defineCollection<SpecialHours>("ops_special_hours", seed.seedSpecialHours);
export const offboardings = defineCollection<Offboarding>("ops_offboarding", seed.seedOffboarding);
export const audit = defineCollection<AuditEntry>("ops_audit", seed.seedAudit);
export const importLogs = defineCollection<ImportLog>("ops_import_logs", () => []);

/** Append an audit entry (who changed what, when, why). */
export async function logAudit(e: Omit<AuditEntry, "id" | "at" | "actor"> & { actor?: string }) {
  await audit.save({ id: audit.nextId("aud"), at: TODAY, actor: e.actor ?? "Demo user", ...e });
}

/** Core workers with their status derived from the date-ranged status timeline on TODAY. */
export function useWorkerView(): Worker[] {
  const ws = coreWorkersCol.useAll();
  const segs = segments.useAll();
  return useMemo(() => ws.map((w) => ({ ...w, status: statusOn(segs, w) })), [ws, segs]);
}
export { coreWorkersCol };

/** Optimistic locking: the form remembers the version it opened; a stale version is rejected. */
export function versionConflict(openedVersion: number, current?: { version: number }) {
  return !!current && current.version !== openedVersion;
}
