import { defineCollection } from "../store";
import { TODAY } from "@/lib/dates";
import {
  seedApprovals, seedAudit, seedCash, seedContacts, seedCosts, seedDocs, seedRecon, seedSigned, seedStores, seedTco, seedTx, seedWorkerStates, seedZones,
} from "./seed";
import type {
  AuditEntry, CashCollection, ContactEntry, ContractApproval, ContractDoc, CostRecord, InvoiceRecon, RevenueTx, SignedOpportunity, Store, TcoProfile, Thresholds, WorkerState, Zone,
} from "./types";

export const thresholds = defineCollection<Thresholds>("cm.thresholds", () => [{ id: "thresholds", approvalMultiple: 200, escalateMultiple: 160 }]);
export const approvals = defineCollection<ContractApproval>("cm.approvals", seedApprovals);
export const signedOpps = defineCollection<SignedOpportunity>("cm.signed", seedSigned);
export const cashCollections = defineCollection<CashCollection>("cm.cash", seedCash);
export const zones = defineCollection<Zone>("cm.zones", seedZones);
export const stores = defineCollection<Store>("cm.stores", seedStores);
export const auditLog = defineCollection<AuditEntry>("cm.audit", seedAudit);
export const costRecords = defineCollection<CostRecord>("cm.costs", seedCosts);
export const revenueTx = defineCollection<RevenueTx>("cm.revenuetx", seedTx);
export const invoiceRecon = defineCollection<InvoiceRecon>("cm.recon", seedRecon);
export const contractDocs = defineCollection<ContractDoc>("cm.docs", seedDocs);
export const contactLog = defineCollection<ContactEntry>("cm.contacts", seedContacts);
export const tcoProfiles = defineCollection<TcoProfile>("cm.tco", seedTco);
export const workerStates = defineCollection<WorkerState>("cm.workerstates", seedWorkerStates);

const pad = (n: number) => String(n).padStart(2, "0");
export const nowStamp = () => {
  const d = new Date();
  return `${TODAY} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Append an audit entry (the log is append-only). */
export async function writeAudit(e: Omit<AuditEntry, "id" | "at">): Promise<void> {
  await auditLog.save({ ...e, id: auditLog.nextId("aud"), at: nowStamp() });
}

export const multipleOf = (revenue: number, breakEven: number) => Math.round((revenue * 100) / Math.max(1, breakEven));
export const fmtMultiple = (hundredths: number) => `${(hundredths / 100).toFixed(2)}x`;
export * from "./types";
