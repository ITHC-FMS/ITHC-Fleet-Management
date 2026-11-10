import { addDays, TODAY } from "@/lib/dates";
import { seedVehicles, seedWorkers } from "@/data/seed/core";
import type { AssignmentAuditEntry, AttendanceRecord, DedicatedVehicle, HandoverAck, ImportJob, Shift } from "./types";

let s = 4242;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);

/** Weekend in Kuwait is Friday and Saturday. */
export const isWeekend = (d: string) => {
  const day = new Date(`${d}T00:00:00Z`).getUTCDay();
  return day === 5 || day === 6;
};

/** Which site each site supervisor records for. Peter is ITHC staff; the Bean & Brew site has a trusted client contact. */
export const SUPERVISOR_SITES: Record<string, { locationId: string; clientContact?: boolean }> = {
  "peter.mwangi-0010": { locationId: "loc-s1" },
  "yousef.karam-0201": { locationId: "loc-s2", clientContact: true },
};

export const seedAttendance = (): AttendanceRecord[] => {
  s = 4242;
  const sites = seedWorkers().filter((w) => w.currentLocationId === "loc-s1" || w.currentLocationId === "loc-s2");
  const out: AttendanceRecord[] = [];
  for (let d = addDays(TODAY, -39); d < TODAY; d = addDays(d, 1)) {
    if (isWeekend(d)) continue;
    for (const w of sites) {
      const loc = w.currentLocationId!;
      const x = rnd();
      const status = x < 0.06 ? "absent" : x < 0.12 ? "partial" : "present";
      const minutes = status === "absent" ? 0 : status === "partial" ? 180 + Math.floor(rnd() * 5) * 45 : loc === "loc-s2" ? 480 : 480;
      out.push({
        id: `${w.id}|${d}`, workerId: w.id, locationId: loc, date: d, status, minutes,
        recordedBy: loc === "loc-s1" ? "Peter Mwangi" : "Yousef Karam", version: 1,
      });
    }
  }
  return out;
};

const STORES = ["Americana — Salmiya Hub", "Americana — Hawally Store", "Americana — Farwaniya Store", "Americana — Zone North"];
const SLOTS: [string, string][] = [["07:00", "15:00"], ["10:00", "19:00"], ["14:00", "23:00"], ["17:00", "01:00"]];

export function seedShiftsAndVehicles(): { shifts: Shift[]; dedicated: DedicatedVehicle[] } {
  s = 99;
  const workers = seedWorkers().filter((w) => w.roles.includes("driver") && w.currentClientId);
  const vehicles = seedVehicles();
  const cars = vehicles.filter((v) => v.type === "car" && v.status === "in_service");
  const bikes = vehicles.filter((v) => v.type === "bike");
  const shifts: Shift[] = [];
  const dedicated: DedicatedVehicle[] = [];
  let bikeIx = 0;
  workers.forEach((w, wi) => {
    const isBike = w.vehicleTypes?.[0] === "bike";
    const bike = isBike ? bikes[bikeIx++] : undefined; // later bike riders get none: an edge case on My Vehicle
    if (bike) dedicated.push({ id: `ded-${w.id}`, workerId: w.id, vehicleId: bike.id, from: addDays(TODAY, -120), to: null });
    for (let d = addDays(TODAY, -3); d <= addDays(TODAY, 8); d = addDays(d, 1)) {
      if (isWeekend(d) || (wi + new Date(d).getUTCDate()) % 6 === 0) continue;
      const slot = SLOTS[(wi + new Date(d).getUTCDate()) % SLOTS.length];
      const car = !isBike ? cars[(wi * 2 + new Date(d).getUTCDate()) % cars.length] : undefined;
      shifts.push({
        id: `shf-${w.id}-${d}`, workerId: w.id, date: d, start: slot[0], end: slot[1], clientId: w.currentClientId!,
        store: w.currentClientId === "cli-talabat" ? `Talabat zone — ${["Hawally", "Salmiya"][wi % 2]}` : STORES[wi % STORES.length],
        vehicleId: car?.id ?? bike?.id, deskId: (car ?? bike)?.homeLocationId,
      });
    }
  });
  return { shifts, dedicated };
}

export function seedAcks(): HandoverAck[] {
  const veh = new Map(seedVehicles().map((v) => [v.id, v]));
  const { shifts } = seedShiftsAndVehicles();
  const out: HandoverAck[] = [];
  const today = TODAY.replaceAll("-", "");
  ["wrk-0001", "wrk-0002", "wrk-0003", "wrk-0004", "wrk-0005", "wrk-0006", "wrk-0007", "wrk-0008"].forEach((wid, i) => {
    const sh = shifts.find((x) => x.workerId === wid && x.date >= TODAY && x.vehicleId);
    if (!sh?.vehicleId) return;
    const v = veh.get(sh.vehicleId)!;
    out.push({
      id: `ack-${wid}-h`, workerId: wid, eventId: `HO-${today}-${String(10 + i).padStart(3, "0")}`, vehicleId: v.id, date: TODAY, kind: "handover",
      summary: `Keys and ${v.make} ${v.model} ${v.plate} handed over at ${sh.deskId === "loc-desk2" ? "Desk 2 Farwaniya" : "Desk 1 Shuwaikh"}. Fuel 3/4, odometer ${v.odometerKm} km.`,
      acknowledgedAt: i % 3 === 2 ? `${TODAY} 08:${10 + i}` : undefined,
    });
    out.push({
      id: `ack-${wid}-i`, workerId: wid, eventId: `HO-${today}-${String(10 + i).padStart(3, "0")}`, vehicleId: v.id, date: TODAY, kind: "inspection",
      result: i === 1 ? "damage_noted" : "pass",
      summary: i === 1 ? "Inspection recorded: scratch on rear left bumper (photo on file). Existing damage, not charged to you." : "Inspection passed. No new damage recorded.",
      acknowledgedAt: i % 3 === 2 ? `${TODAY} 08:${12 + i}` : undefined,
    });
  });
  const wid = "wrk-0001";
  const v = veh.get(shifts.find((x) => x.workerId === wid && x.vehicleId)!.vehicleId!)!;
  out.push({ id: "ack-prev-h", workerId: wid, eventId: `HO-${addDays(TODAY, -4).replaceAll("-", "")}-007`, vehicleId: v.id, date: addDays(TODAY, -4), kind: "handover", summary: `Handover of ${v.plate}, no issues.`, acknowledgedAt: `${addDays(TODAY, -4)} 07:05` });
  return out;
}

export const seedImportJobs = (): ImportJob[] => [
  { id: "imp-0001", sheet: "lessor_contracts", fileName: "lessor_contracts.xlsx", uploadedAt: "2026-11-02 11:00", sourceRows: 3, validRows: 3, errorRows: 0, sourceTotal: 3, appliedTotal: 3, appliedRows: 3, status: "committed", errors: [], version: 1 },
  { id: "imp-0002", sheet: "buildings", fileName: "buildings.xlsx", uploadedAt: "2026-11-02 11:20", sourceRows: 6, validRows: 6, errorRows: 0, sourceTotal: 6, appliedTotal: 6, appliedRows: 6, status: "committed", errors: [], version: 1 },
  { id: "imp-0003", sheet: "workers", fileName: "drivers_master_v3.xlsx", uploadedAt: "2026-11-05 15:42", sourceRows: 258, validRows: 251, errorRows: 7, sourceTotal: 258, appliedTotal: 0, appliedRows: 0, status: "validated", version: 1,
    errors: [
      { row: 14, key: "Civil ID", messages: ["Civil ID must be 12 digits"], raw: { name: "Kamal Rai", civil_id: "2910" } },
      { row: 33, key: "Rider ID", messages: ["Duplicate rider id TLB-1017 (also row 29)"], raw: { name: "Ali Singh", rider_id: "TLB-1017" } },
      { row: 87, key: "Joining date", messages: ["Joining date is not a valid date: 31/02/2025"], raw: { name: "Omar Hussein" } },
    ] },
];

export const seedAssignmentAudit = (): AssignmentAuditEntry[] => {
  const rows: Omit<AssignmentAuditEntry, "id">[] = [
    { at: "2026-11-09 08:40", user: "Faisal Al-Dosari", type: "driver_vehicle", workerId: "wrk-0004", vehicleId: "veh-0008", change: "Pooled car veh-0008 assigned for shift 2026-11-09", reason: "Regular car under repair (veh-0007)", effectiveFrom: "2026-11-09", effectiveTo: "2026-11-09", payrollPeriod: "2026-11", periodClosed: false },
    { at: "2026-11-08 17:05", user: "Faisal Al-Dosari", type: "driver_client", workerId: "wrk-0023", clientId: "cli-talabat", change: "Rider moved from Batch 2 to Batch 1", reason: "Performance review October", effectiveFrom: "2026-11-01", effectiveTo: null, payrollPeriod: "2026-11", periodClosed: false },
    { at: "2026-11-07 10:12", user: "Abdullah Al-Kandari", type: "housing_occupancy", workerId: "wrk-0041", change: "Moved from Khaitan Block A to Mahboula 2, bed 4", reason: "Khaitan unit closed for maintenance", effectiveFrom: "2026-11-07", effectiveTo: null, payrollPeriod: "2026-11", periodClosed: false },
    { at: "2026-11-06 09:30", user: "Hamad Al-Rashidi", type: "labour_placement", workerId: "wrk-0046", clientId: "cli-bean", change: "Barista placed at Avenues Mall", reason: "New hire after training", effectiveFrom: "2026-11-06", effectiveTo: null, payrollPeriod: "2026-11", periodClosed: false },
    { at: "2026-11-05 14:00", user: "Faisal Al-Dosari", type: "driver_client", workerId: "wrk-0011", clientId: "cli-americana", change: "Placement start corrected from 2026-10-15 to 2026-10-08", reason: "Start date keyed incorrectly at onboarding", effectiveFrom: "2026-10-08", effectiveTo: null, payrollPeriod: "2026-10", periodClosed: true, handling: "October payroll is closed and was not altered; 7 extra days posted as an adjustment in the open November period" },
    { at: "2026-11-04 16:45", user: "Jassim Behbehani", type: "driver_vehicle", workerId: "wrk-0016", vehicleId: "veh-0014", change: "Dedicated bike veh-0014 returned (end date set to 2026-11-03)", reason: "Rider absconded", effectiveFrom: "2026-06-01", effectiveTo: "2026-11-03", payrollPeriod: "2026-11", periodClosed: false },
    { at: "2026-11-03 11:20", user: "Hamad Al-Rashidi", type: "labour_placement", workerId: "wrk-0036", clientId: "cli-alshaya", change: "Warehouse worker moved from Inbound to Outbound team", reason: "Client request", effectiveFrom: "2026-11-03", effectiveTo: null, payrollPeriod: "2026-11", periodClosed: false },
    { at: "2026-10-30 09:10", user: "Faisal Al-Dosari", type: "driver_vehicle", workerId: "wrk-0009", vehicleId: "veh-0011", change: "Assignment end date changed from 2026-10-28 to 2026-10-31 (inclusive)", reason: "Handover delayed by three days", effectiveFrom: "2026-10-01", effectiveTo: "2026-10-31", payrollPeriod: "2026-10", periodClosed: false },
    { at: "2026-10-28 15:30", user: "Abdullah Al-Kandari", type: "housing_occupancy", workerId: "wrk-0020", change: "Occupancy ended 2026-10-27", reason: "Worker terminated", effectiveFrom: "2026-03-01", effectiveTo: "2026-10-27", payrollPeriod: "2026-10", periodClosed: false },
    { at: "2026-10-22 13:00", user: "Faisal Al-Dosari", type: "driver_client", workerId: "wrk-0055", clientId: "cli-americana", change: "Bench driver placed with Americana", reason: "Volume increase at Hawally store", effectiveFrom: "2026-10-22", effectiveTo: null, payrollPeriod: "2026-10", periodClosed: false },
    { at: "2026-10-12 10:00", user: "Mariam Al-Hajri", type: "labour_placement", workerId: "wrk-0038", clientId: "cli-alshaya", change: "Placement end date corrected from 2026-09-15 to 2026-09-22", reason: "Client confirmed worker stayed a further week", effectiveFrom: "2026-03-01", effectiveTo: "2026-09-22", payrollPeriod: "2026-09", periodClosed: true, handling: "September payroll is closed; correction not applied retroactively. 5 days of pay posted as an adjustment in October" },
    { at: "2026-10-05 08:15", user: "Jassim Behbehani", type: "driver_vehicle", workerId: "wrk-0002", vehicleId: "veh-0003", change: "Pooled car assigned for shift 2026-10-05", reason: "Standard roster", effectiveFrom: "2026-10-05", effectiveTo: "2026-10-05", payrollPeriod: "2026-10", periodClosed: false },
    { at: "2026-09-29 12:40", user: "Faisal Al-Dosari", type: "driver_client", workerId: "wrk-0030", clientId: "cli-talabat", change: "Rider moved from Americana to Talabat", reason: "Worker preference and open Talabat slot", effectiveFrom: "2026-10-01", effectiveTo: null, payrollPeriod: "2026-10", periodClosed: false },
    { at: "2026-09-18 09:55", user: "Abdullah Al-Kandari", type: "housing_occupancy", workerId: "wrk-0044", change: "Assigned to Jleeb Al-Shuyoukh bed 2", reason: "New worker arrival", effectiveFrom: "2026-09-18", effectiveTo: null, payrollPeriod: "2026-09", periodClosed: true, handling: "Recorded on the day; no retroactive effect" },
  ];
  return rows.map((r, i) => ({ id: `asa-${String(rows.length - i).padStart(4, "0")}`, ...r }));
};
