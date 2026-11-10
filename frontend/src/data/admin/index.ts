import { defineCollection } from "@/data/store";
import type {
  AdminAuditEntry, AppNotification, AssignmentAuditEntry, AttendanceRecord, ClientMeta, CompanyProfile, CreationRule,
  DedicatedVehicle, HandoverAck, ImportJob, ManagedUser, OutboxEmail, PermissionRow, Shift,
} from "./types";
import { seedAdminAudit, seedClientMeta, seedCompanyProfiles, seedCreationRules, seedManagedUsers, seedPermissions } from "./seed-users";
import { seedCredentialEmails, seedNotificationsAndEmails } from "./seed-alerts";
import { seedAcks, seedAssignmentAudit, seedAttendance, seedImportJobs, seedShiftsAndVehicles } from "./seed-field";

export * from "./types";
export * from "./tiers";
export { PERM_ROLES } from "./seed-users";
export { SUPERVISOR_SITES, isWeekend } from "./seed-field";

export const managedUsers = defineCollection<ManagedUser>("admin.users", seedManagedUsers);
export const adminAudit = defineCollection<AdminAuditEntry>("admin.audit", seedAdminAudit);
export const clientMeta = defineCollection<ClientMeta>("admin.clientMeta", seedClientMeta);
export const companyProfiles = defineCollection<CompanyProfile>("admin.companyProfiles", seedCompanyProfiles);
export const permissions = defineCollection<PermissionRow>("admin.permissions", seedPermissions);
export const creationRules = defineCollection<CreationRule>("admin.creationRules", seedCreationRules);
export const notifications = defineCollection<AppNotification>("admin.notifications", () => seedNotificationsAndEmails().notifications);
export const emailOutbox = defineCollection<OutboxEmail>("admin.emailOutbox", () => [...seedNotificationsAndEmails().emails, ...seedCredentialEmails()]);
export const attendance = defineCollection<AttendanceRecord>("admin.attendance", seedAttendance);
export const shifts = defineCollection<Shift>("admin.shifts", () => seedShiftsAndVehicles().shifts);
export const dedicatedVehicles = defineCollection<DedicatedVehicle>("admin.dedicatedVehicles", () => seedShiftsAndVehicles().dedicated);
export const handoverAcks = defineCollection<HandoverAck>("admin.handoverAcks", seedAcks);
export const importJobs = defineCollection<ImportJob>("admin.importJobs", seedImportJobs);
export const assignmentAudit = defineCollection<AssignmentAuditEntry>("admin.assignmentAudit", seedAssignmentAudit);

/** "YYYY-MM-DD HH:MM" using the demo's fixed business date and the real clock time. */
export function stamp(): string {
  const d = new Date();
  return `2026-11-09 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Append an audit entry. */
export async function audit(e: Omit<AdminAuditEntry, "id" | "at">) {
  const all = await adminAudit.list();
  const n = Math.max(0, ...all.map((x) => Number(x.id.split("-").pop()) || 0)) + 1;
  await adminAudit.save({ ...e, id: `aud-${String(n).padStart(4, "0")}`, at: stamp() });
}
export async function auditMany(entries: Omit<AdminAuditEntry, "id" | "at">[]) {
  const all = await adminAudit.list();
  let n = Math.max(0, ...all.map((x) => Number(x.id.split("-").pop()) || 0));
  const at = stamp();
  await adminAudit.saveMany(entries.map((e) => ({ ...e, id: `aud-${String(++n).padStart(4, "0")}`, at })));
}

export async function queueEmail(e: Omit<OutboxEmail, "id" | "sentAt" | "status">) {
  const all = await emailOutbox.list();
  const n = Math.max(0, ...all.map((x) => Number(x.id.split("-").pop()?.replace(/\D/g, "")) || 0)) + 1;
  await emailOutbox.save({ ...e, id: `eml-x${String(n).padStart(4, "0")}`, sentAt: stamp(), status: "simulated_sent" });
}

export interface AcceptanceGate { id: string; label: string; ref: string; status: "not_started" | "in_progress" | "passed"; detail: string; version: number; }
export const acceptanceGates = defineCollection<AcceptanceGate>("admin.gates", () => [
  { id: "gate-1", label: "Earnings engine reproduces the April 2026 reference figures within 0.001 KD (gross and net)", ref: "§9.1", status: "in_progress", detail: "Reference sheet received; engine not yet compared", version: 1 },
  { id: "gate-2", label: "Seventy automated test scenarios passing", ref: "§9.2", status: "in_progress", detail: "41 of 70 scenarios written", version: 1 },
  { id: "gate-3", label: "Handover flow validated by real desk staff, timed under 60 seconds", ref: "§9.3", status: "not_started", detail: "Awaiting desk staff session", version: 1 },
  { id: "gate-4", label: "CI with tests, type checking and linting on a protected main branch", ref: "§10.2", status: "passed", detail: "Branch protection and CI enabled", version: 1 },
]);
