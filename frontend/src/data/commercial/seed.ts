import { addDays, TODAY } from "@/lib/dates";
import { seedClients, seedContracts, seedVehicles, seedWorkers } from "../seed/core";
import { priceTx } from "./engine";
import type {
  AuditEntry, CashCollection, ContactEntry, ContractApproval, ContractDoc, CostRecord, CostType, InvoiceRecon,
  RevenueTx, SignedOpportunity, Store, TcoProfile, WorkerState, Zone,
} from "./types";

let s = 4242;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n: number) => String(n).padStart(2, "0");
const id = (p: string, n: number) => `${p}-${String(n).padStart(4, "0")}`;

/* ---------- approvals ---------- */
const FIN = { by: "Layla Hamdan", role: "Finance / Commercial" };
const CLI = { by: "Hamad Al-Rashidi", role: "Client & Deployment" };
export const seedApprovals = (): ContractApproval[] => {
  const rows: Omit<ContractApproval, "id">[] = [
    { opportunity: "Alshaya Warehouse: 20-head expansion", clientId: "cli-alshaya", pricingModel: "fixed_labour", heads: 20, revenuePerHead: 285_000, breakEvenPerHead: 168_000, requestedBy: FIN.by, requestedRole: FIN.role, requestedAt: addDays(TODAY, -3), status: "pending" },
    { opportunity: "Keeta bulk parcel pilot (12 riders)", clientId: "cli-keeta", contractNo: "CT-KEET-01", pricingModel: "bulk", heads: 12, revenuePerHead: 410_000, breakEvenPerHead: 235_000, requestedBy: CLI.by, requestedRole: CLI.role, requestedAt: addDays(TODAY, -6), status: "pending" },
    { opportunity: "Bean & Brew: Marina branch baristas", clientId: "cli-bean", pricingModel: "hourly", heads: 6, revenuePerHead: 290_000, breakEvenPerHead: 190_000, requestedBy: CLI.by, requestedRole: CLI.role, requestedAt: addDays(TODAY, -12), status: "pending" },
    { opportunity: "Talabat: night-shift bike pool", clientId: "cli-talabat", pricingModel: "marketplace_batched", heads: 8, revenuePerHead: 520_000, breakEvenPerHead: 305_000, requestedBy: FIN.by, requestedRole: FIN.role, requestedAt: addDays(TODAY, -1), status: "pending" },
    { opportunity: "Americana: Salmiya 6 riders", clientId: "cli-americana", pricingModel: "order_based", heads: 6, revenuePerHead: 780_000, breakEvenPerHead: 345_000, requestedBy: CLI.by, requestedRole: CLI.role, requestedAt: addDays(TODAY, -40), status: "approved", decidedBy: "Khalid Al-Mutairi", decidedAt: addDays(TODAY, -38), reason: "Above gate on volume floor; approved for record." },
    { opportunity: "Alshaya Warehouse: picking line 2", clientId: "cli-alshaya", contractNo: "CT-ALSH-01", pricingModel: "fixed_labour", heads: 6, revenuePerHead: 285_000, breakEvenPerHead: 150_000, requestedBy: FIN.by, requestedRole: FIN.role, requestedAt: addDays(TODAY, -75), status: "approved", decidedBy: "Khalid Al-Mutairi", decidedAt: addDays(TODAY, -73), reason: "Strategic account, 1.90x accepted for 6 months." },
    { opportunity: "Bean & Brew: Avenues Mall", clientId: "cli-bean", contractNo: "CT-BEAN-01", pricingModel: "hourly", heads: 12, revenuePerHead: 330_000, breakEvenPerHead: 170_000, requestedBy: CLI.by, requestedRole: CLI.role, requestedAt: addDays(TODAY, -160), status: "approved", decidedBy: "Khalid Al-Mutairi", decidedAt: addDays(TODAY, -158), reason: "Approved with rate review at 6 months." },
    { opportunity: "Talabat: car fleet top-up", clientId: "cli-talabat", pricingModel: "marketplace_batched", heads: 10, revenuePerHead: 400_000, breakEvenPerHead: 330_000, requestedBy: FIN.by, requestedRole: FIN.role, requestedAt: addDays(TODAY, -95), status: "declined", decidedBy: "Khalid Al-Mutairi", decidedAt: addDays(TODAY, -92), reason: "1.21x is too thin once batch 3 downside is included." },
    { opportunity: "Keeta VDA: weekend riders", clientId: "cli-keeta", pricingModel: "bulk", heads: 5, revenuePerHead: 300_000, breakEvenPerHead: 215_000, requestedBy: CLI.by, requestedRole: CLI.role, requestedAt: addDays(TODAY, -55), status: "declined", decidedBy: "Khalid Al-Mutairi", decidedAt: addDays(TODAY, -52), reason: "Wait for VDA terms; resubmit with fixed fee." },
    { opportunity: "Americana: Hawally 8 riders", clientId: "cli-americana", pricingModel: "order_based", heads: 8, revenuePerHead: 700_000, breakEvenPerHead: 360_000, requestedBy: CLI.by, requestedRole: CLI.role, requestedAt: addDays(TODAY, -20), status: "approved", decidedBy: "Khalid Al-Mutairi", decidedAt: addDays(TODAY, -19), reason: "Approved." },
  ];
  return rows.map((r, i) => ({ ...r, id: id("apr", i + 1) }));
};

export const seedSigned = (): SignedOpportunity[] => [
  { id: "sig-0001", name: "Alshaya Warehouse: picking line 2", clientId: "cli-alshaya", pricingModel: "fixed_labour", heads: 6, revenuePerHead: 285_000, startDate: addDays(TODAY, -60), signedBy: "Hamad Al-Rashidi", signedAt: addDays(TODAY, -70), approvalId: "apr-0006", status: "converted", contractNo: "CT-ALSH-01" },
  { id: "sig-0002", name: "Americana: Salmiya 6 riders", clientId: "cli-americana", pricingModel: "order_based", heads: 6, revenuePerHead: 780_000, startDate: addDays(TODAY, 14), signedBy: "Hamad Al-Rashidi", signedAt: addDays(TODAY, -4), approvalId: "apr-0005", status: "awaiting_contract" },
  { id: "sig-0003", name: "Americana: Hawally 8 riders", clientId: "cli-americana", pricingModel: "order_based", heads: 8, revenuePerHead: 700_000, startDate: addDays(TODAY, 21), signedBy: "Hamad Al-Rashidi", signedAt: addDays(TODAY, -9), approvalId: "apr-0010", status: "awaiting_contract" },
  { id: "sig-0004", name: "Bean & Brew: Marina branch baristas", clientId: "cli-bean", pricingModel: "hourly", heads: 6, revenuePerHead: 290_000, startDate: addDays(TODAY, 30), signedBy: "Hamad Al-Rashidi", signedAt: addDays(TODAY, -2), approvalId: "apr-0003", status: "awaiting_contract" },
  { id: "sig-0005", name: "Keeta bulk parcel pilot", clientId: "cli-keeta", pricingModel: "bulk", heads: 12, revenuePerHead: 410_000, startDate: "2027-01-01", signedBy: "Hamad Al-Rashidi", signedAt: addDays(TODAY, -5), approvalId: "apr-0002", status: "awaiting_contract" },
  { id: "sig-0006", name: "Talabat: bike pool, Jahra", clientId: "cli-talabat", pricingModel: "marketplace_batched", heads: 5, revenuePerHead: 560_000, startDate: addDays(TODAY, 10), signedBy: "Hamad Al-Rashidi", signedAt: addDays(TODAY, -1), status: "awaiting_contract" },
];

/* ---------- cash on delivery ---------- */
export const seedCash = (): CashCollection[] => {
  s = 99;
  const out: CashCollection[] = [];
  let n = 0;
  for (let d = 14; d >= 0; d--) {
    const date = addDays(TODAY, -d);
    const crew: [number, string][] = [];
    for (let w = 23; w <= 32; w++) if (rnd() > 0.2) crew.push([w, "cli-talabat"]);
    for (let w = 1; w <= 8; w++) if (rnd() > 0.45) crew.push([w, "cli-americana"]);
    for (const [w, client] of crew) {
      n++;
      const collected = between(40, 190) * 1000 + between(0, 9) * 100;
      const today = d === 0;
      const short = !today && rnd() > 0.82 ? between(2, 25) * 1000 + 500 : 0;
      const handedOver = today && rnd() > 0.5 ? null : collected - short;
      const month = date.slice(0, 7);
      out.push({
        id: id("csh", n), date, workerId: id("wrk", w), clientId: client, collected, handedOver,
        deduction: short > 0 ? (date < TODAY.slice(0, 7) + "-01" ? "deducted" : "queued") : "none",
        payrollPeriod: short > 0 ? month : undefined, note: short > 0 && rnd() > 0.5 ? "Driver reports customer short-paid" : undefined, version: 1,
      });
    }
  }
  return out;
};

/* ---------- stores & zones ---------- */
export const seedZones = (): Zone[] => [
  { id: "zon-0001", name: "Kuwait City", area: "Capital", status: "active", version: 1 },
  { id: "zon-0002", name: "Hawally", area: "Hawally", status: "active", version: 1 },
  { id: "zon-0003", name: "Salmiya", area: "Hawally", status: "active", version: 1 },
  { id: "zon-0004", name: "Farwaniya", area: "Farwaniya", status: "active", version: 1 },
  { id: "zon-0005", name: "Jahra", area: "Jahra", status: "active", version: 1 },
  { id: "zon-0006", name: "Ahmadi", area: "Ahmadi", status: "inactive", version: 1 },
];
export const seedStores = (): Store[] => {
  const list: [string, string, string, string][] = [
    ["Americana KFC: Dasman", "cli-americana", "zon-0001", "Dasman, Block 3"],
    ["Americana Pizza Hut: Sharq", "cli-americana", "zon-0001", "Sharq, Block 1"],
    ["Americana Hardee's: Hawally", "cli-americana", "zon-0002", "Hawally, Tunis St"],
    ["Americana KFC: Salmiya", "cli-americana", "zon-0003", "Salmiya, Salem Al-Mubarak St"],
    ["Americana Krispy Kreme: Salmiya", "cli-americana", "zon-0003", "Salmiya, Block 10"],
    ["Americana Pizza Hut: Farwaniya", "cli-americana", "zon-0004", "Farwaniya, Block 2"],
    ["Americana KFC: Khaitan", "cli-americana", "zon-0004", "Khaitan, Block 4"],
    ["Americana Hardee's: Jahra", "cli-americana", "zon-0005", "Jahra, Block 6"],
    ["Americana Costa: Fahaheel", "cli-americana", "zon-0006", "Fahaheel, Block 1"],
    ["Bean & Brew: Avenues Mall", "cli-bean", "zon-0004", "The Avenues, Level 1"],
    ["Bean & Brew: 360 Mall", "cli-bean", "zon-0002", "360 Mall, Ground floor"],
    ["Bean & Brew: Marina", "cli-bean", "zon-0001", "Marina Crescent"],
    ["Talabat Dark Store: Shuwaikh", "cli-talabat", "zon-0001", "Shuwaikh Industrial"],
    ["Talabat Dark Store: Jleeb", "cli-talabat", "zon-0004", "Jleeb Al-Shuyoukh"],
    ["Keeta Hub: Sulaibiya", "cli-keeta", "zon-0005", "Sulaibiya Industrial"],
    ["Alshaya DC: Amghara", "cli-alshaya", "zon-0005", "Amghara Industrial"],
  ];
  return list.map(([name, clientId, zoneId, address], i) => ({ id: id("sto", i + 1), name, clientId, zoneId, address, status: i === 8 ? "inactive" : "active", version: 1 }));
};

/* ---------- audit log ---------- */
export const seedAudit = (): AuditEntry[] => {
  type T = [string, string, string, string, string, AuditEntry["action"], string, string, string?, string?];
  const t: T[] = [
    ["Layla Hamdan", "finance", "contract", "CT-AMER-01", "Americana order-based v2", "create", "New version v2 effective 2026-07-01", "Annual rate review agreed with client", "car 1.000 / bike 0.800", "car 1.100 / bike 0.850"],
    ["Khalid Al-Mutairi", "ceo", "approval", "apr-0005", "Americana: Salmiya 6 riders", "approve", "Opportunity approved below 2.0x", "Above gate on volume floor; approved for record.", "pending", "approved"],
    ["Faisal Al-Dosari", "operations", "assignment", "wrk-0003", "Rajesh Khan", "update", "Assignment moved from Dasman to Salmiya store", "Store closed for refit", "Dasman", "Salmiya"],
    ["Reem Al-Failakawi", "payroll", "compensation", "wrk-0012", "Samuel Rai", "update", "Overtime component changed", "Approved by manager after audit of timesheets", "40.000 KD", "55.000 KD"],
    ["Reem Al-Failakawi", "payroll", "payroll_run", "2026-09", "Payroll Sep 2026", "reopen", "Payroll period reopened for correction", "Cash shortfall deduction was entered against wrong driver"],
    ["Faisal Al-Dosari", "operations", "batch_override", "wrk-0025", "Talabat rider TLB-1025", "override", "Batch changed Batch 3 to Batch 2 for 2026-10-18", "Platform scoring outage; client confirmed correct batch by email", "Batch 3", "Batch 2"],
    ["Mariam Al-Hajri", "admin", "contract", "CT-BEAN-01", "Bean & Brew hourly v1", "update", "Volume floor corrected to 10 seats", "Typo at data entry; signed contract says 10", "12", "10"],
    ["Dalal Al-Ajmi", "hr", "worker", "wrk-0019", "Kamal Sharma", "update", "Status changed to sick leave", "Medical certificate received", "active", "sick_leave"],
    ["Jassim Behbehani", "fleet", "vehicle", "veh-0007", "Vehicle 47/21931", "update", "Status set to under repair", "Accident damage, workshop booked", "in_service", "under_repair"],
    ["Abdullah Al-Kandari", "housing", "lease", "loc-h2", "Jleeb Al-Shuyoukh", "update", "Monthly rent changed", "Landlord renewal at new rate", "2,200.000 KD", "2,400.000 KD"],
    ["Layla Hamdan", "finance", "document", "doc-0004", "Talabat rate schedule", "create", "Rate schedule v2 uploaded, v1 retained as superseded", "Client issued revised schedule"],
    ["Faisal Al-Dosari", "operations", "store", "sto-0009", "Americana Costa: Fahaheel", "update", "Store deactivated", "Franchise closed", "active", "inactive"],
    ["Khalid Al-Mutairi", "ceo", "approval", "apr-0008", "Talabat: car fleet top-up", "decline", "Opportunity declined", "1.21x is too thin once batch 3 downside is included.", "pending", "declined"],
    ["Dalal Al-Ajmi", "hr", "worker", "wrk-0036", "Joseph Gurung", "create", "Worker onboarded", "New hire for Alshaya warehouse"],
    ["Reem Al-Failakawi", "payroll", "advance", "adv-0007", "Advance for Suresh Nair", "create", "Advance 120.000 KD, 4 monthly deductions", "Family emergency, approved by HR"],
    ["Faisal Al-Dosari", "operations", "assignment", "wrk-0010", "Mohamed Okafor", "create", "Assigned to vehicle 12/55410 from 2026-10-20", "New rider starting"],
    ["Jassim Behbehani", "fleet", "vehicle", "veh-0014", "Vehicle 33/18420", "update", "Odometer corrected", "Handover desk typed 5 digits instead of 6", "8,420", "48,420"],
    ["Mariam Al-Hajri", "admin", "user", "usr-0006", "Fatima Al-Enezi", "update", "Role changed from Operations to Payroll", "Internal transfer"],
    ["Layla Hamdan", "finance", "cost", "cst-0220", "Fine borne by company", "create", "Traffic fine 15.000 KD attributed to vehicle", "Driver not liable, signal failure"],
    ["Faisal Al-Dosari", "operations", "batch_override", "wrk-0027", "Talabat rider TLB-1027", "override", "Batch changed Batch 2 to Batch 1 for 2026-11-02", "Rider completed bonus quota; platform report delayed", "Batch 2", "Batch 1"],
    ["Reem Al-Failakawi", "payroll", "compensation", "wrk-0021", "Anil Rai", "update", "Base salary raised", "Promotion to team lead", "200.000 KD", "230.000 KD"],
    ["Dalal Al-Ajmi", "hr", "worker", "wrk-0031", "Naveen Singh", "update", "Status changed to terminated", "Resignation accepted, last day 2026-11-05", "active", "terminated"],
    ["Mariam Al-Hajri", "admin", "contract", "CT-ALSH-01", "Alshaya fixed labour v1", "update", "Seats contracted corrected", "Client confirmed 40 seats in addendum", "35", "40"],
    ["Layla Hamdan", "finance", "reconciliation", "rec-0012", "Americana Sep 2026", "update", "Marked reconciled", "Invoice matches computed revenue"],
    ["Khalid Al-Mutairi", "ceo", "settings", "thresholds", "Approval thresholds", "update", "Escalation threshold changed", "Board decision, tighten weekly escalation", "1.50x", "1.60x", ],
    ["Abdullah Al-Kandari", "housing", "stay", "stay-0031", "Bikash Thapa, Khaitan A", "update", "Stay ended 2026-10-31", "Worker relocated to Mahboula"],
    ["Jassim Behbehani", "fleet", "lessor", "lsr-0002", "Swift Link", "update", "Lessor contract renewed to 2027-10-31", "Annual renewal"],
    ["Faisal Al-Dosari", "operations", "assignment", "wrk-0005", "Ahmed Kumar", "delete", "Assignment ended early on 2026-11-01", "Client request, rider performance"],
    ["Reem Al-Failakawi", "payroll", "payroll_run", "2026-10", "Payroll Oct 2026", "reopen", "Payroll reopened after approval", "Missed overtime for Talabat batch riders"],
    ["Layla Hamdan", "finance", "contract", "CT-TLBT-01", "Talabat batched v1", "update", "Achievement fee batch 2 corrected", "Rate schedule says 150 fils, not 160", "160 fils", "150 fils"],
    ["Mariam Al-Hajri", "admin", "worker", "wrk-0008", "Hassan Gurung", "update", "Civil ID added", "Document received from HR", "(empty)", "29xxxxxxxx"],
    ["Dalal Al-Ajmi", "hr", "document", "wdoc-0012", "Residency permit, Prakash Eze", "update", "Expiry date updated after renewal", "Renewal completed", "2026-11-12", "2028-11-11"],
  ];
  return t.map(([user, role, entityType, entityId, entityLabel, action, summary, reason, before, after], i) => {
    const day = Math.floor((i * 63) / t.length) + 1;
    return { id: id("aud", i + 1), at: `${addDays(TODAY, -day)} ${pad(8 + ((i * 7) % 10))}:${pad((i * 13) % 60)}`, user, role, entityType, entityId, entityLabel, action, summary, reason, before, after };
  }).sort((a, b) => (a.at < b.at ? 1 : -1)).map((e, i, arr) => ({ ...e, id: id("aud", arr.length - i) }));
};

/* ---------- costs ---------- */
export const seedCosts = (): CostRecord[] => {
  s = 31;
  const out: CostRecord[] = [];
  let n = 0;
  const add = (c: Omit<CostRecord, "id">) => out.push({ ...c, id: id("cst", ++n) });
  const months = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
  const veh = seedVehicles();
  for (const m of months) {
    const last = m === "2026-11" ? 8 : 28;
    for (const v of veh) {
      if (v.status === "off_fleet") continue;
      const base = v.type === "bike" ? 17_000 : v.type === "transport" ? 140_000 : 52_000;
      const frac = m === "2026-11" ? 0.27 : 1;
      add({ date: `${m}-${pad(Math.min(last, between(20, 28)))}`, type: "fuel", target: "vehicle", refId: v.id, amount: Math.round((base + between(0, 12) * 1000) * frac), notes: "Fuel card statement" });
    }
    add({ date: `${m}-05`, type: "other", target: "company", refId: "", amount: 480_000, notes: "Office rent and utilities, Shuwaikh" });
    add({ date: `${m}-10`, type: "other", target: "company", refId: "", amount: 160_000, notes: "Software and telecom" });
  }
  const maint: [string, string, number, string][] = [
    ["veh-0007", "2026-10-21", 185_500, "Front-end collision repair"], ["veh-0003", "2026-10-02", 42_000, "Service, oil and filters"], ["veh-0011", "2026-09-17", 38_000, "Brake pads"],
    ["veh-0015", "2026-08-30", 96_000, "Gearbox repair"], ["veh-0019", "2026-07-11", 29_500, "Tyres (2)"], ["veh-0022", "2026-11-04", 44_000, "Service, oil and filters"], ["veh-0005", "2026-06-24", 31_000, "Battery"],
    ["veh-0025", "2026-10-12", 120_000, "Suspension"], ["veh-0009", "2026-09-05", 22_000, "Service"], ["veh-0013", "2026-11-06", 54_000, "AC compressor"],
  ];
  maint.forEach(([r, d, a, nn]) => add({ date: d, type: "maintenance", target: "vehicle", refId: r, amount: a, notes: nn }));
  const fines: [number, string, number][] = [[3, "2026-10-08", 15_000], [11, "2026-09-12", 10_000], [14, "2026-11-02", 20_000], [27, "2026-10-26", 15_000], [6, "2026-08-18", 10_000]];
  fines.forEach(([w, d, a]) => add({ date: d, type: "fine", target: "worker", refId: id("wrk", w), amount: a, notes: "Traffic fine borne by company" }));
  add({ date: "2026-10-15", type: "accommodation", target: "property", refId: "loc-h2", amount: 85_000, notes: "Plumbing repair" });
  add({ date: "2026-09-20", type: "accommodation", target: "property", refId: "loc-h1", amount: 42_000, notes: "Air-conditioning service" });
  add({ date: "2026-11-03", type: "accommodation", target: "property", refId: "loc-h3", amount: 120_000, notes: "Furniture replacement" });
  add({ date: "2026-10-01", type: "insurance", target: "client", refId: "cli-alshaya", amount: 95_000, notes: "Site liability cover, per contract" });
  add({ date: "2026-09-01", type: "insurance", target: "client", refId: "cli-bean", amount: 40_000, notes: "Public liability cover" });
  add({ date: "2026-10-28", type: "other", target: "client", refId: "cli-americana", amount: 60_000, notes: "Uniforms for new riders" });
  return out;
};
export const COST_TYPES: CostType[] = ["rental_charge", "instalment", "maintenance", "fuel", "fine", "accommodation", "insurance", "other"];

/* ---------- revenue transactions ---------- */
export const seedTx = (): RevenueTx[] => {
  s = 7;
  const out: RevenueTx[] = [];
  let n = 0;
  const add = (t: Omit<RevenueTx, "id">) => out.push({ ...t, id: id("trx", ++n) });
  const start = "2026-06-01";
  const days = 161; // Jun 1 .. Nov 8
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const peak = dow === 5 || dow === 6 ? 1.3 : 1;
    add({ date, contractNo: "CT-AMER-01", lineKey: "car", qty: Math.round(between(290, 360) * peak), period: "day" });
    add({ date, contractNo: "CT-AMER-01", lineKey: "bike", qty: Math.round(between(200, 260) * peak), period: "day" });
    add({ date, contractNo: "CT-TLBT-01", batch: "Batch 1", qty: Math.round(between(100, 135) * peak), period: "day", vehicleType: "bike" });
    add({ date, contractNo: "CT-TLBT-01", batch: "Batch 2", qty: Math.round(between(70, 95) * peak), period: "day", vehicleType: "car" });
    add({ date, contractNo: "CT-TLBT-01", batch: "Batch 3", qty: Math.round(between(25, 45) * peak), period: "day", vehicleType: "bike" });
    add({ date, contractNo: "CT-BEAN-01", lineKey: "hour", qty: between(34, 44), period: "day" });
  }
  ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].forEach((m, i) =>
    add({ date: `${m}-01`, contractNo: "CT-ALSH-01", lineKey: "monthly", qty: Math.round((13 + (i % 3) * 0.4 - 0.55) * 100) / 100, period: "month", note: "Placed heads prorated by attendance" }));
  // manual batch overrides (mandatory reason)
  const setOv = (idx: number, to: string, reason: string) => {
    const t = out.filter((x) => x.batch)[idx];
    if (t) { t.batchOriginal = t.batch; t.batch = to; t.overrideReason = reason; t.overrideBy = "Faisal Al-Dosari"; }
  };
  setOv(220, "Batch 2", "Platform scoring outage; client confirmed correct batch by email");
  setOv(301, "Batch 1", "Rider completed bonus quota; platform report delayed");
  setOv(55, "Batch 3", "Batch 2 issued in error; penalty tier applied per client notice");
  return out;
};

/* ---------- invoice reconciliation ---------- */
export const seedRecon = (): InvoiceRecon[] => {
  s = 123;
  const contracts = seedContracts();
  const tx = seedTx();
  const out: InvoiceRecon[] = [];
  let n = 0;
  for (const c of seedClients()) {
    for (const m of ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]) {
      const computed = tx.filter((t) => t.date.startsWith(m) && contracts.find((k) => k.contractNo === t.contractNo)?.clientId === c.id).reduce((a, t) => a + priceTx(contracts, t).amount, 0);
      if (!computed) continue;
      const r = rnd();
      const delta = r > 0.75 ? -between(40, 600) * 1000 : r > 0.65 ? between(30, 300) * 1000 : 0;
      const old = m < "2026-10";
      out.push({ id: id("rec", ++n), clientId: c.id, period: m, invoiced: computed + delta, status: delta === 0 ? (old || rnd() > 0.4 ? "reconciled" : "open") : old && rnd() > 0.5 ? "disputed" : "open", reconciledBy: delta === 0 && old ? "Layla Hamdan" : undefined, note: delta < 0 ? "Client invoice lower than computed; credit note suspected" : delta > 0 ? "Invoice higher than computed; check batch overrides" : undefined, version: 1 });
    }
  }
  return out;
};

/* ---------- contract documents ---------- */
export const seedDocs = (): ContractDoc[] => {
  const rows: Omit<ContractDoc, "id">[] = [
    { contractNo: "CT-AMER-01", docType: "Signed contract", fileName: "americana-contract-2026.pdf", issued: "2026-01-01", expires: "2026-12-31", authority: "Americana Restaurants Kuwait", uploadedBy: "Layla Hamdan", uploadedAt: "2026-01-04", docVersion: 1, status: "current" },
    { contractNo: "CT-AMER-01", docType: "Rate schedule", fileName: "americana-rates-v1.pdf", issued: "2026-01-01", expires: "2026-06-30", authority: "Americana Restaurants Kuwait", uploadedBy: "Layla Hamdan", uploadedAt: "2026-01-04", docVersion: 1, status: "superseded" },
    { contractNo: "CT-AMER-01", docType: "Rate schedule", fileName: "americana-rates-v2.pdf", issued: "2026-07-01", expires: null, authority: "Americana Restaurants Kuwait", uploadedBy: "Layla Hamdan", uploadedAt: "2026-06-27", docVersion: 2, status: "current" },
    { contractNo: "CT-AMER-01", docType: "Insurance certificate", fileName: "americana-insurance.pdf", issued: "2025-12-01", expires: addDays(TODAY, -9), authority: "Gulf Insurance Group", uploadedBy: "Mariam Al-Hajri", uploadedAt: "2025-12-03", docVersion: 1, status: "current" },
    { contractNo: "CT-TLBT-01", docType: "Signed contract", fileName: "talabat-master-agreement.pdf", issued: "2026-03-01", expires: "2027-02-28", authority: "Talabat Kuwait", uploadedBy: "Layla Hamdan", uploadedAt: "2026-03-02", docVersion: 1, status: "current" },
    { contractNo: "CT-TLBT-01", docType: "Rate schedule", fileName: "talabat-batch-rates-v1.pdf", issued: "2026-03-01", expires: "2026-08-31", authority: "Talabat Kuwait", uploadedBy: "Layla Hamdan", uploadedAt: "2026-03-02", docVersion: 1, status: "superseded" },
    { contractNo: "CT-TLBT-01", docType: "Rate schedule", fileName: "talabat-batch-rates-v2.pdf", issued: "2026-09-01", expires: "2027-02-28", authority: "Talabat Kuwait", uploadedBy: "Layla Hamdan", uploadedAt: "2026-09-02", docVersion: 2, status: "current" },
    { contractNo: "CT-ALSH-01", docType: "Signed contract", fileName: "alshaya-labour-supply.pdf", issued: "2026-04-01", expires: "2027-03-31", authority: "Alshaya Logistics", uploadedBy: "Layla Hamdan", uploadedAt: "2026-04-03", docVersion: 1, status: "current" },
    { contractNo: "CT-ALSH-01", docType: "Amendment", fileName: "alshaya-addendum-seats.pdf", issued: "2026-09-15", expires: null, authority: "Alshaya Logistics", uploadedBy: "Mariam Al-Hajri", uploadedAt: "2026-09-16", docVersion: 1, status: "current" },
    { contractNo: "CT-ALSH-01", docType: "Insurance certificate", fileName: "alshaya-site-liability.pdf", issued: "2026-04-01", expires: addDays(TODAY, 21), authority: "Warba Insurance", uploadedBy: "Mariam Al-Hajri", uploadedAt: "2026-04-02", docVersion: 1, status: "current" },
    { contractNo: "CT-BEAN-01", docType: "Signed contract", fileName: "bean-brew-hourly.pdf", issued: "2026-06-01", expires: "2027-05-31", authority: "Bean & Brew Trading", uploadedBy: "Layla Hamdan", uploadedAt: "2026-06-03", docVersion: 1, status: "current" },
    { contractNo: "CT-BEAN-01", docType: "Rate schedule", fileName: "bean-brew-rate-card.png", issued: "2026-06-01", expires: null, authority: "Bean & Brew Trading", uploadedBy: "Layla Hamdan", uploadedAt: "2026-06-03", docVersion: 1, status: "current" },
    { contractNo: "CT-KEET-01", docType: "Draft agreement", fileName: "keeta-bulk-draft.pdf", issued: "2026-10-20", expires: null, authority: "Keeta Delivery Kuwait", uploadedBy: "Layla Hamdan", uploadedAt: "2026-10-21", docVersion: 1, status: "current" },
    { contractNo: "CT-KEET-01", docType: "Rate schedule", fileName: "keeta-rates-proposal.pdf", issued: "2026-10-20", expires: addDays(TODAY, 25), authority: "Keeta Delivery Kuwait", uploadedBy: "Layla Hamdan", uploadedAt: "2026-10-21", docVersion: 1, status: "current" },
  ];
  return rows.map((r, i) => ({ ...r, id: id("doc", i + 1) }));
};

/* ---------- contact log ---------- */
export const seedContacts = (): ContactEntry[] => {
  s = 555;
  const outcomes = ["Confirmed volumes for next month", "Raised late-payment query", "Client asked for rate review", "Site walk-through, no issues", "Discussed seat shortfall", "Renewal intent positive", "Complaint about rider punctuality, resolved", "Agreed batch dispute process"];
  const types: ContactEntry["type"][] = ["call", "visit", "email", "meeting"];
  const people = ["Hamad Al-Rashidi", "Hamad Al-Rashidi", "Layla Hamdan", "Faisal Al-Dosari"];
  const per: [string, string, number[]][] = [
    ["cli-americana", "CT-AMER-01", [2, 9, 18, 33, 47, 61]],
    ["cli-talabat", "CT-TLBT-01", [4, 11, 19, 27, 40]],
    ["cli-alshaya", "CT-ALSH-01", [7, 21, 35, 52, 70]],
    ["cli-bean", "CT-BEAN-01", [44, 58, 79, 95]],
    ["cli-keeta", "CT-KEET-01", [15, 29]],
  ];
  const out: ContactEntry[] = [];
  let n = 0;
  for (const [clientId, contractNo, ago] of per)
    for (const a of ago) out.push({ id: id("ctc", ++n), date: addDays(TODAY, -a), clientId, contractNo, type: types[between(0, 3)], outcome: outcomes[between(0, outcomes.length - 1)], loggedBy: people[between(0, 3)] });
  return out;
};

/* ---------- TCO profiles & worker states ---------- */
export const seedTco = (): TcoProfile[] =>
  seedVehicles().map((v, i) => {
    const bike = v.type === "bike";
    const price = bike ? 650_000 : v.type === "transport" ? 9_800_000 : 4_200_000;
    const term = 36;
    const instalment = v.monthlyCost;
    return {
      id: v.id, startDate: addDays(TODAY, -(150 + ((i * 53) % 650))),
      returnConditions: "Return in delivered condition, fair wear only; 3,000 km/month cap, excess at 40 fils/km",
      purchasePrice: price, residualPct: 20, lifeMonths: 60,
      instalment, termMonths: term, principal: Math.round(instalment * term * 0.9),
      lienHolder: v.ownership === "financed" ? (i % 2 ? "Gulf Bank" : "KFH Auto") : "",
    };
  });

export const seedWorkerStates = (): WorkerState[] => {
  s = 808;
  return seedWorkers().map((w) => ({ id: w.id, since: addDays(TODAY, -between(3, 75)) }));
};
