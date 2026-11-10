import type { Vehicle, Worker } from "@/data/entities";
import { seedVehicles, seedWorkers } from "@/data/seed/core";
import { addDays, TODAY } from "@/lib/dates";
import { hhmm, mk } from "./time";
import type {
  AuditEntry, ChecklistItem, CostSchedule, DeskUser, DocType, FuelTransaction, HandoverEvent, Incident, Inspection, LeaseLink,
  LessorContract, ServiceJob, TransportRoute, VehicleAssignment, VehicleDocument,
} from "./types";
import { checklistFor } from "./checklist";
import { deskOfVehicle } from "./rules";

let s = 424242;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pickOf = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];

export interface FleetSeed {
  deskUsers: DeskUser[]; events: HandoverEvent[]; inspections: Inspection[]; incidents: Incident[]; jobs: ServiceJob[];
  fuel: FuelTransaction[]; routes: TransportRoute[]; assignments: VehicleAssignment[]; contracts: LessorContract[];
  leases: LeaseLink[]; schedules: CostSchedule[]; docs: VehicleDocument[]; audit: AuditEntry[];
}

let memo: FleetSeed | null = null;
export function fleetSeed(): FleetSeed {
  if (!memo) memo = build();
  return memo;
}

const pad = (n: number, w = 4) => String(n).padStart(w, "0");

function build(): FleetSeed {
  s = 424242;
  const vehicles = seedVehicles();
  const workers = seedWorkers();
  const V = (id: string) => vehicles.find((v) => v.id === id);
  const deskUsers: DeskUser[] = [
    { id: "du-0001", name: "Sunil Thapa", username: "sunil.thapa-0011", email: "sunil.thapa@ithc.demo", deskId: "loc-desk1", role: "desk_lead", status: "active", mustChangePassword: false, createdAt: "2026-01-12T09:00", version: 1 },
    { id: "du-0002", name: "Kamal Thapa", username: "kamal.thapa-0056", email: "kamal.thapa@ithc.demo", deskId: "loc-desk1", role: "desk_operator", status: "active", mustChangePassword: false, createdAt: "2026-02-03T09:00", version: 1 },
    { id: "du-0003", name: "Ahmed Shrestha", username: "ahmed.shrestha-0057", email: "ahmed.shrestha@ithc.demo", deskId: "loc-desk2", role: "desk_lead", status: "active", mustChangePassword: false, createdAt: "2026-02-03T09:10", version: 1 },
    { id: "du-0004", name: "Rashid Hussein", username: "rashid.hussein-0101", email: "rashid.hussein@ithc.demo", deskId: "loc-desk2", role: "desk_operator", status: "active", mustChangePassword: true, createdAt: "2026-11-04T10:30", version: 1 },
    { id: "du-0005", name: "Bikash Gurung", username: "bikash.gurung-0102", email: "bikash.gurung@ithc.demo", deskId: "loc-desk2", role: "desk_operator", status: "offboarded", mustChangePassword: false, createdAt: "2026-03-10T09:00", offboardedAt: "2026-10-20T17:00", version: 2 },
  ];
  const opFor = (desk: string) => deskUsers.filter((u) => u.deskId === desk && u.status === "active");

  // ---- contracts, leases, schedules ----
  const mkDoc = (name: string, type: string, issued: string, expires: string) => ({ name, type, issued, expires });
  const contracts: LessorContract[] = [
    { id: "lc-0001", lessorId: "cmp-maxdash", contractNo: "MD-2025-A", contractVersion: 1, start: "2025-06-01", end: "2026-10-31", terms: "Two motorbikes, monthly rental, maintenance by lessor, return in clean condition.", status: "active", documents: [mkDoc("MD-2025-A signed.pdf", "Lease agreement", "2025-06-01", "2026-10-31")], version: 1 },
    { id: "lc-0002", lessorId: "cmp-maxdash", contractNo: "MD-2025-B", contractVersion: 1, start: "2025-02-01", end: "2026-01-31", terms: "Pooled cars and one bike, 12 month term.", status: "superseded", documents: [mkDoc("MD-2025-B v1.pdf", "Lease agreement", "2025-02-01", "2026-01-31")], version: 2 },
    { id: "lc-0003", lessorId: "cmp-maxdash", contractNo: "MD-2025-B", contractVersion: 2, start: "2026-02-01", end: "2026-12-15", terms: "Renewal of v1. Monthly rate unchanged, insurance included, early return fee 2 months.", renewalOfId: "lc-0002", status: "active", documents: [mkDoc("MD-2025-B v2.pdf", "Lease agreement", "2026-02-01", "2026-12-15")], version: 1 },
    { id: "lc-0004", lessorId: "cmp-swiftlink", contractNo: "SL-2024-01", contractVersion: 1, start: "2024-11-01", end: "2025-12-31", terms: "Pooled cars and transport van, 14 month term.", status: "superseded", documents: [mkDoc("SL-2024-01 v1.pdf", "Lease agreement", "2024-11-01", "2025-12-31")], version: 2 },
    { id: "lc-0005", lessorId: "cmp-swiftlink", contractNo: "SL-2024-01", contractVersion: 2, start: "2026-01-01", end: "2027-06-30", terms: "Renewal of v1. Transport van and one pooled car. Return with full service history.", renewalOfId: "lc-0004", status: "active", documents: [mkDoc("SL-2024-01 v2.pdf", "Lease agreement", "2026-01-01", "2027-06-30")], version: 1 },
    { id: "lc-0006", lessorId: "cmp-swiftlink", contractNo: "SL-2025-07", contractVersion: 1, start: "2025-11-01", end: "2026-10-31", terms: "Two pooled cars, 12 month term. Renewal under negotiation.", status: "active", documents: [mkDoc("SL-2025-07.pdf", "Lease agreement", "2025-11-01", "2026-10-31")], version: 1 },
  ];
  const leaseMap: Record<string, string> = {
    "veh-0013": "lc-0001", "veh-0015": "lc-0001",
    "veh-0007": "lc-0003", "veh-0009": "lc-0003", "veh-0012": "lc-0003", "veh-0019": "lc-0003", "veh-0023": "lc-0003", "veh-0024": "lc-0003",
    "veh-0002": "lc-0005", "veh-0025": "lc-0005",
    "veh-0003": "lc-0006", "veh-0017": "lc-0006",
  };
  const leases: LeaseLink[] = vehicles.filter((v) => v.ownership === "rented").map((v) => ({ id: v.id, contractId: leaseMap[v.id] ?? (v.lessor === "Max Dash" ? "lc-0003" : "lc-0005") }));
  const schedules: CostSchedule[] = vehicles.map((v) => {
    const mc = v.monthlyCost;
    if (v.ownership === "rented") return { id: v.id, ownership: "rented", monthlyCharge: mc, returnConditions: "Return clean, full tank, with service book" };
    if (v.ownership === "cash") return { id: v.id, ownership: "cash", purchasePrice: mc * 75, residual: Math.round(mc * 15), lifeMonths: 60 };
    return { id: v.id, ownership: "financed", instalment: Math.round(mc * 0.9), deposit: Math.round(mc * 4.8), termMonths: 48 };
  });

  // ---- drivers ----
  const okStatus = (w: Worker) => ["active", "probation", "training"].includes(w.status);
  const drivers = workers.filter((w) => w.roles.includes("driver"));
  const carDrivers = drivers.filter((w) => okStatus(w) && w.vehicleTypes?.includes("car") || w.status === "standby" && w.vehicleTypes?.includes("car"));
  const bikeDrivers = drivers.filter((w) => okStatus(w) && w.vehicleTypes?.includes("bike"));

  // ---- special-case vehicles ----
  const INC = { overdue: "veh-0007", open: "veh-0002", routed: "veh-0010", done: "veh-0003", accident: "veh-0016", closed: "veh-0001" };
  const underRepairAfter: Record<string, string> = {
    [INC.overdue]: addDays(TODAY, -9), [INC.open]: addDays(TODAY, -4), [INC.routed]: TODAY, [INC.done]: addDays(TODAY, -11),
    [INC.accident]: addDays(TODAY, -2), [INC.closed]: addDays(TODAY, -12),
  };

  // ---- handover history for pooled cars ----
  const events: HandoverEvent[] = [];
  const inspections: Inspection[] = [];
  const assignments: VehicleAssignment[] = [];
  let evN = 0, inN = 0, asN = 0;
  const pooled = vehicles.filter((v) => v.mode === "pooled");
  const busy = new Set<string>();
  for (const d of new Set(pooled.map((v) => deskOfVehicle(v)))) {
    const ofDesk = pooled.filter((v) => deskOfVehicle(v) === d);
    ofDesk.slice(0, Math.ceil(ofDesk.length * 0.45)).forEach((v) => busy.add(v.id));
  }
  const finalOdo = new Map<string, number>();
  const photo = (n: string) => ({ name: `${n}.jpg` });

  const addEvent = (e: Omit<HandoverEvent, "id" | "sync" | "photos" | "notes" | "inspectionResult"> & Partial<HandoverEvent>): HandoverEvent => {
    const ev: HandoverEvent = { photos: [], notes: "", inspectionResult: "pass", sync: "synced", ...e, id: `hov-${pad(++evN, 5)}` } as HandoverEvent;
    events.push(ev);
    return ev;
  };
  const addInspection = (ev: HandoverEvent, v: Vehicle, result: "pass" | "minor" | "fail", bad?: string): Inspection => {
    const items: ChecklistItem[] = checklistFor(v.type).map((c) => ({ ...c, grade: "ok" as const }));
    if (result !== "pass") { const it = items.find((x) => x.key === (bad ?? "body")) ?? items[0]; it.grade = result === "fail" ? "major" : "minor"; it.note = result === "fail" ? "Dent and cracked panel" : "Light scratch"; }
    const ins: Inspection = { id: `ins-${pad(++inN, 5)}`, handoverId: ev.id, vehicleId: v.id, driverId: ev.driverId, deskId: ev.deskId, at: ev.at, operatorName: ev.operatorName, items, result, photos: result === "pass" ? [] : [photo(`dmg-${inN}-a`), photo(`dmg-${inN}-b`)] };
    ev.inspectionId = ins.id;
    ev.inspectionResult = result;
    if (result !== "pass") ev.photos = ins.photos;
    inspections.push(ins);
    return ins;
  };

  for (const v of pooled) {
    const desk = deskOfVehicle(v);
    const ops = opFor(desk);
    const cutoff = underRepairAfter[v.id];
    const hot = busy.has(v.id);
    const pool = carDrivers.length ? carDrivers : drivers;
    let odo = 0;
    const local: HandoverEvent[] = [];
    for (let d = -27; d <= 0; d++) {
      const day = addDays(TODAY, d);
      if (cutoff && day >= cutoff) break;
      const shifts: ("A" | "B")[] = [];
      if (rnd() < (hot ? 0.92 : 0.05)) shifts.push("A");
      if (d < 0 && rnd() < (hot ? 0.12 : 0.02)) shifts.push("B");
      for (const sh of shifts) {
        const drv = pickOf(pool);
        const op = pickOf(ops);
        const outH = sh === "A" ? ri(5, 7) : ri(18, 19);
        const outAt = mk(day, hhmm(outH, ri(0, 59)));
        const km = ri(60, 150);
        const inAt = sh === "A" ? mk(day, hhmm(ri(17, 18), ri(0, 59))) : mk(addDays(day, 1), hhmm(ri(5, 6), ri(0, 59)));
        const stillOut = d === 0 && sh === "A";
        const iss = addEvent({ direction: "issue", vehicleId: v.id, driverId: drv.id, deskId: desk, at: outAt, operatorId: op.id, operatorName: op.name, odometerKm: odo, fuelEighths: ri(5, 8), mode: v.mode, durationSec: ri(38, 58) });
        local.push(iss);
        odo += km;
        if (!stillOut && inAt <= mk(TODAY, "23:59")) {
          const ret = addEvent({ direction: "return", vehicleId: v.id, driverId: drv.id, deskId: desk, at: inAt, operatorId: op.id, operatorName: op.name, odometerKm: odo, fuelEighths: ri(2, 6), mode: v.mode, durationSec: ri(35, 55) });
          local.push(ret);
        }
        if (day >= addDays(TODAY, -6) && !stillOut) {
          const bad = rnd() < 0.05 ? "minor" : "pass";
          addInspection(iss, v, "pass");
          const r = local[local.length - 1];
          if (r.direction === "return") addInspection(r, v, bad);
        } else if (day >= addDays(TODAY, -6)) addInspection(iss, v, "pass");
        if (day >= addDays(TODAY, -1)) assignments.push({ id: `vas-${pad(++asN)}`, vehicleId: v.id, workerId: drv.id, from: day, to: day, source: "handover", handoverId: iss.id, version: 1 });
      }
    }
    // shift odometers so the last recorded reading matches the vehicle register
    const shift = v.odometerKm - odo;
    for (const e of local) e.odometerKm += shift;
    // issue with no later return -> odometer at issue should equal register
    finalOdo.set(v.id, v.odometerKm);
  }

  // dedicated bikes: one issue at start of assignment, open ended
  const assignedBikes = vehicles.filter((v) => v.mode === "dedicated" && !["veh-0022", "veh-0024", "veh-0014"].includes(v.id));
  const usedDrivers = new Set<string>();
  assignedBikes.forEach((v, i) => {
    const drv = bikeDrivers.find((d) => !usedDrivers.has(d.id));
    if (!drv) return;
    usedDrivers.add(drv.id);
    const desk = deskOfVehicle(v);
    const op = opFor(desk)[0];
    const from = addDays(TODAY, -(60 + i * 17));
    const iss = addEvent({ direction: "issue", vehicleId: v.id, driverId: drv.id, deskId: desk, at: mk(from, "08:10"), operatorId: op.id, operatorName: op.name, odometerKm: Math.max(0, v.odometerKm - ri(2500, 7000)), fuelEighths: 6, mode: "dedicated", durationSec: 55 });
    addInspection(iss, v, "pass");
    assignments.push({ id: `vas-${pad(++asN)}`, vehicleId: v.id, workerId: drv.id, from, to: null, source: "handover", handoverId: iss.id, avgDailyHours: ri(8, 11), version: 1 });
  });
  // a past bike assignment that ended, and one conflict
  const b14 = V("veh-0014"), b15 = V("veh-0015");
  const freeDrivers = bikeDrivers.filter((d) => !usedDrivers.has(d.id));
  if (b14 && freeDrivers[0]) {
    const iss = addEvent({ direction: "issue", vehicleId: b14.id, driverId: freeDrivers[0].id, deskId: deskOfVehicle(b14), at: mk(addDays(TODAY, -90), "09:00"), operatorId: opFor(deskOfVehicle(b14))[0].id, operatorName: opFor(deskOfVehicle(b14))[0].name, odometerKm: b14.odometerKm - 5000, fuelEighths: 6, mode: "dedicated" });
    const ret = addEvent({ direction: "return", vehicleId: b14.id, driverId: freeDrivers[0].id, deskId: deskOfVehicle(b14), at: mk(addDays(TODAY, -35), "16:40"), operatorId: opFor(deskOfVehicle(b14))[0].id, operatorName: opFor(deskOfVehicle(b14))[0].name, odometerKm: b14.odometerKm, fuelEighths: 4, mode: "dedicated" });
    assignments.push({ id: `vas-${pad(++asN)}`, vehicleId: b14.id, workerId: freeDrivers[0].id, from: addDays(TODAY, -90), to: addDays(TODAY, -35), source: "handover", handoverId: iss.id, note: `Returned ${ret.id} (resigned)`, avgDailyHours: 9, version: 1 });
  }
  if (b15) {
    const other = freeDrivers[1];
    if (other) assignments.push({ id: `vas-${pad(++asN)}`, vehicleId: b15.id, workerId: other.id, from: addDays(TODAY, -5), to: addDays(TODAY, 20), source: "manual", note: "Cover while regular rider is on leave (overlaps the standing assignment)", avgDailyHours: 8, version: 1 });
  }

  // ---- incidents & service jobs ----
  const incidents: Incident[] = [];
  const jobs: ServiceJob[] = [];
  const odoAt = (vid: string, at: string) => { const e = events.filter((x) => x.vehicleId === vid && x.at <= at).sort((a, b) => (a.at < b.at ? -1 : 1)).pop(); return e ? e.odometerKm : Math.max(0, (V(vid)?.odometerKm ?? 3000) - 3000); };
  const lastRet = (vid: string) => [...events].filter((e) => e.vehicleId === vid).sort((a, b) => (a.at < b.at ? -1 : 1)).pop();
  const mkIncident = (vid: string, o: Partial<Incident> & { day: string; kind: Incident["kind"]; desc: string; assess: string; status: Incident["status"]; repl?: string; sev?: Incident["severity"] }) => {
    const { day, desc, assess, repl, sev, ...rest } = o;
    const v = V(vid);
    if (!v) return undefined;
    const desk = deskOfVehicle(v);
    const drv = pickOf(carDrivers.length ? carDrivers : drivers);
    const op = opFor(desk)[0];
    let hid: string | undefined;
    if (o.kind === "damage") {
      const ev = addEvent({ direction: "return", vehicleId: v.id, driverId: drv.id, deskId: desk, at: mk(day, "17:42"), operatorId: op.id, operatorName: op.name, odometerKm: odoAt(v.id, mk(day, "17:42")), fuelEighths: 3, mode: v.mode, durationSec: 72 });
      addInspection(ev, v, "fail", "body");
      hid = ev.id;
    }
    const inc: Incident = {
      id: `inc-${pad(incidents.length + 1)}`, vehicleId: v.id, handoverId: hid, driverId: drv.id, deskId: desk, at: mk(day, "17:50"),
      severity: sev ?? "major", description: desc, assessment: assess, photos: [photo(`inc-${incidents.length + 1}-front`), photo(`inc-${incidents.length + 1}-side`)],
      replacementVehicleId: repl, recordedBy: op.name, version: 1, ...rest, status: o.status,
    };
    if (hid) { const ins = inspections.find((i) => i.handoverId === hid); if (ins) ins.incidentId = inc.id; }
    incidents.push(inc);
    return inc;
  };
  const mkJob = (inc: ReturnType<typeof mkIncident>, o: Partial<ServiceJob> & { opened: string; work: string; expectedReturn: string; costFils: number; status: ServiceJob["status"] }) => {
    if (!inc) return;
    const job: ServiceJob = { id: `sj-${pad(jobs.length + 1)}`, vehicleId: inc.vehicleId, incidentId: inc.id, source: inc.kind === "damage" ? "damaged" : "accident", replacementVehicleId: inc.replacementVehicleId, version: 1, ...o };
    jobs.push(job);
    inc.serviceJobId = job.id;
    return job;
  };
  const usedRepl = new Set<string>();
  const replFor = (vid: string, today = false) => {
    const v = V(vid);
    const pick = pooled.find((p) => p.id !== vid && deskOfVehicle(p) === (v ? deskOfVehicle(v) : "") && !underRepairAfter[p.id] && p.status === "in_service" && !["lc-0001", "lc-0006"].includes(leaseMap[p.id] ?? "") && !usedRepl.has(p.id)
      && (!today || ![...events].filter((e) => e.vehicleId === p.id).sort((x, y) => (x.at < y.at ? -1 : 1)).slice(-1).some((e) => e.direction === "issue")));
    if (pick) usedRepl.add(pick.id);
    return pick?.id;
  };
  const i1 = mkIncident(INC.overdue, { day: addDays(TODAY, -9), kind: "damage", desc: "Rear bumper crushed, tail light broken", assess: "Panel replacement and paint; parts on order", status: "in_service", repl: replFor(INC.overdue) });
  mkJob(i1, { opened: addDays(TODAY, -8), work: "Bumper replacement, tail light, respray", expectedReturn: addDays(TODAY, -2), costFils: 410_000, status: "open" });
  const i2 = mkIncident(INC.open, { day: addDays(TODAY, -4), kind: "accident", desc: "Side impact at junction, driver unhurt", assess: "Door and wing replacement, alignment check", status: "in_service", repl: replFor(INC.open), sev: "major" });
  mkJob(i2, { opened: addDays(TODAY, -3), work: "Door, wing, alignment", expectedReturn: addDays(TODAY, 4), costFils: 680_000, status: "open" });
  const i3 = mkIncident(INC.routed, { day: TODAY, kind: "damage", desc: "Cracked windscreen and scraped front wing found at return", assess: "Windscreen replacement, wing repaint", status: "routed", repl: replFor(INC.routed, true), sev: "minor" });
  const i4 = mkIncident(INC.done, { day: addDays(TODAY, -11), kind: "damage", desc: "Mirror torn off, scratched driver door", assess: "Mirror unit and door repaint", status: "in_service", repl: replFor(INC.done), sev: "minor" });
  mkJob(i4, { opened: addDays(TODAY, -10), work: "Mirror unit, door repaint", expectedReturn: addDays(TODAY, -3), completedOn: addDays(TODAY, -1), costFils: 145_000, status: "completed" });
  const i5 = mkIncident(INC.accident, { day: addDays(TODAY, -2), kind: "accident", desc: "Bike skidded on wet road, handlebar and fairing damaged", assess: "Handlebar, fairing, forks check", status: "received", receivedOn: addDays(TODAY, -1), repl: "veh-0022", sev: "major" });
  const i6 = mkIncident(INC.closed, { day: addDays(TODAY, -12), kind: "damage", desc: "Interior upholstery torn", assess: "Seat cover replaced", status: "closed", repl: replFor(INC.closed), sev: "minor", attributedTo: "driver", attributionNote: "Photos at issue show seat intact" });
  mkJob(i6, { opened: addDays(TODAY, -11), work: "Seat cover replacement", expectedReturn: addDays(TODAY, -7), completedOn: addDays(TODAY, -7), returnedOn: addDays(TODAY, -6), costFils: 85_000, status: "returned" });
  void i3; void i5;

  // replacement handover events (drivers continue on the replacement)
  for (const inc of incidents) {
    if (!inc.replacementVehicleId || inc.status === "closed") continue;
    const rv = V(inc.replacementVehicleId);
    if (!rv) continue;
    const prior = lastRet(rv.id);
    if (inc.vehicleId === INC.accident) {
      const op = opFor(inc.deskId)[0];
      const iss = addEvent({ direction: "issue", vehicleId: rv.id, driverId: inc.driverId!, deskId: inc.deskId, at: mk(addDays(TODAY, -2), "19:05"), operatorId: op.id, operatorName: op.name, odometerKm: rv.odometerKm, fuelEighths: 6, mode: "dedicated", notes: "Replacement bike after accident" });
      addInspection(iss, rv, "pass");
      inc.replacementHandoverId = iss.id;
      assignments.push({ id: `vas-${pad(++asN)}`, vehicleId: rv.id, workerId: inc.driverId!, from: addDays(TODAY, -2), to: null, source: "handover", handoverId: iss.id, avgDailyHours: 9, version: 1 });
      continue;
    }
    void prior;
    const op = opFor(inc.deskId)[0];
    const day = inc.at.slice(0, 10);
    const odo = odoAt(rv.id, mk(day, "18:02"));
    const iss = addEvent({ direction: "issue", vehicleId: rv.id, driverId: inc.driverId!, deskId: inc.deskId, at: mk(day, "18:02"), operatorId: op.id, operatorName: op.name, odometerKm: odo, fuelEighths: 7, mode: "pooled", notes: `Replacement for ${inc.vehicleId}` });
    addInspection(iss, rv, "pass");
    inc.replacementHandoverId = iss.id;
    if (day < TODAY) addEvent({ direction: "return", vehicleId: rv.id, driverId: inc.driverId!, deskId: inc.deskId, at: mk(addDays(day, 1), "06:10"), operatorId: op.id, operatorName: op.name, odometerKm: odo + 80, fuelEighths: 4, mode: "pooled", notes: `Replacement for ${inc.vehicleId}` });
  }
  // recompute final odometer coherence is best-effort for replacement events

  // ---- fuel ----
  const fuel: FuelTransaction[] = [];
  const stations = ["Kuwait Oil Co. — Shuwaikh", "Alghanim — Farwaniya", "Ahmadi Fuel — Block 4", "KNPC — Jleeb"];
  let fuN = 0;
  for (const v of vehicles) {
    if (v.status === "under_repair" && v.id !== "veh-0007") continue;
    const evs = events.filter((e) => e.vehicleId === v.id && e.direction === "return" && !e.notes.startsWith("Replacement") && e.inspectionResult !== "fail" && e.at >= `${addDays(TODAY, -21)}T00:00`);
    if (v.mode === "pooled") {
      let lastOdo = evs.length ? evs[0].odometerKm - 120 : 0;
      for (let k = 0; k < evs.length; k += 3) {
        const e = evs[k];
        const km = e.odometerKm - lastOdo;
        if (km <= 0) continue;
        const litres = Math.round(((km * ri(78, 98)) / 1000) * 10) / 10;
        fuel.push({ id: `fu-${pad(++fuN, 5)}`, date: e.at.slice(0, 10), vehicleId: v.id, driverId: e.driverId, handoverId: e.id, litres, costFils: Math.round(litres * ri(213, 217)), odometerKm: e.odometerKm, station: pickOf(stations), source: "card" });
        lastOdo = e.odometerKm;
      }
    } else if (v.mode === "dedicated") {
      for (let k = 0; k < 4; k++) {
        const date = addDays(TODAY, -(k * 6 + 2));
        const l = Math.round(ri(55, 95)) / 10;
        fuel.push({ id: `fu-${pad(++fuN, 5)}`, date, vehicleId: v.id, litres: l, costFils: Math.round(l * 215), odometerKm: v.odometerKm - (k * 6 + 2) * 70, station: pickOf(stations), source: "card" });
      }
    } else {
      for (let k = 0; k < 4; k++) {
        const date = addDays(TODAY, -(k * 6 + 1));
        const l = ri(55, 70);
        fuel.push({ id: `fu-${pad(++fuN, 5)}`, date, vehicleId: v.id, litres: l, costFils: l * 214, odometerKm: v.odometerKm - (k * 6 + 1) * 180, station: stations[0], source: "card" });
      }
    }
  }
  // anomalies
  const car = pooled.find((p) => p.id === "veh-0009");
  if (car) {
    fuel.push({ id: `fu-${pad(++fuN, 5)}`, date: addDays(TODAY, -3), vehicleId: car.id, litres: 78.4, costFils: 16_856, odometerKm: car.odometerKm - 80, station: "Ahmadi Fuel — Block 4", source: "card" });
    const ev = events.filter((e) => e.vehicleId === car.id && e.direction === "return").pop();
    if (ev) { fuel.push({ id: `fu-${pad(++fuN, 5)}`, date: ev.at.slice(0, 10), vehicleId: car.id, litres: 31.2, costFils: 6_708, odometerKm: ev.odometerKm, handoverId: ev.id, station: "Alghanim — Farwaniya", source: "card" }); fuel.push({ id: `fu-${pad(++fuN, 5)}`, date: ev.at.slice(0, 10), vehicleId: car.id, litres: 29.6, costFils: 6_364, odometerKm: ev.odometerKm + 3, handoverId: ev.id, station: "KNPC — Jleeb", source: "card" }); }
  }
  const car2 = pooled.find((p) => p.id === "veh-0020");
  if (car2) fuel.push({ id: `fu-${pad(++fuN, 5)}`, date: addDays(TODAY, -1), vehicleId: car2.id, litres: 41, costFils: 12_300, odometerKm: car2.odometerKm + 90, station: "Alghanim — Farwaniya", source: "manual" });
  const car3 = pooled.find((p) => p.id === "veh-0012");
  if (car3) fuel.push({ id: `fu-${pad(++fuN, 5)}`, date: addDays(TODAY, -2), vehicleId: car3.id, litres: 52, costFils: 11_232, odometerKm: car3.odometerKm + 40, station: "KNPC — Jleeb", source: "manual" });

  // ---- transport routes ----
  const tv = vehicles.find((v) => v.type === "transport");
  const tDrv = drivers.filter((d) => d.status === "standby");
  const routes: TransportRoute[] = tv
    ? [
        { id: "rt-0001", name: "Khaitan to Alshaya DC (morning)", fromLocationId: "loc-h1", toLocationId: "loc-s1", vehicleId: tv.id, driverId: tDrv[0]?.id ?? drivers[0].id, contractId: "con-0004", departs: "04:30", durationMin: 60, days: "Sun-Thu", heads: 14, driverCostFils: 210_000, fuelCostFils: 96_000, status: "active", version: 1 },
        { id: "rt-0002", name: "Alshaya DC to Khaitan (afternoon)", fromLocationId: "loc-s1", toLocationId: "loc-h1", vehicleId: tv.id, driverId: tDrv[0]?.id ?? drivers[0].id, contractId: "con-0004", departs: "14:15", durationMin: 60, days: "Sun-Thu", heads: 14, driverCostFils: 0, fuelCostFils: 96_000, status: "active", version: 1 },
        { id: "rt-0003", name: "Mahboula to Avenues Mall (morning)", fromLocationId: "loc-h3", toLocationId: "loc-s2", vehicleId: tv.id, driverId: tDrv[0]?.id ?? drivers[0].id, contractId: "con-0005", departs: "09:30", durationMin: 45, days: "Sun-Sat", heads: 6, driverCostFils: 90_000, fuelCostFils: 58_000, status: "active", version: 1 },
        { id: "rt-0004", name: "Avenues Mall to Mahboula (night)", fromLocationId: "loc-s2", toLocationId: "loc-h3", vehicleId: tv.id, driverId: tDrv[1]?.id ?? drivers[1].id, contractId: "con-0005", departs: "22:30", durationMin: 45, days: "Sun-Sat", heads: 6, driverCostFils: 70_000, fuelCostFils: 58_000, status: "active", version: 1 },
        { id: "rt-0005", name: "Jleeb to Alshaya DC (draft, second shift)", fromLocationId: "loc-h2", toLocationId: "loc-s1", vehicleId: tv.id, driverId: tDrv[1]?.id ?? drivers[1].id, contractId: "con-0004", departs: "04:45", durationMin: 70, days: "Sun-Thu", heads: 10, driverCostFils: 120_000, fuelCostFils: 88_000, status: "draft", version: 1 },
      ]
    : [];

  // ---- vehicle documents ----
  const docs: VehicleDocument[] = [];
  let dN = 0;
  const auth: Record<DocType, string> = { registration: "Kuwait MOI Traffic Dept", insurance: "Gulf Insurance Group", inspection_cert: "MOI Technical Inspection", lease: "Lessor" };
  const addDoc = (v: Vehicle, type: DocType, expiresOffset: number, ver = 1, supersedes?: string, status: "current" | "superseded" = "current") => {
    const expires = addDays(TODAY, expiresOffset);
    const d: VehicleDocument = { id: `vd-${pad(++dN)}`, vehicleId: v.id, type, issued: addDays(expires, type === "insurance" ? -365 : type === "inspection_cert" ? -365 : -1095), expires, authority: type === "lease" ? (v.lessor ?? "Lessor") : auth[type], docVersion: ver, supersedesId: supersedes, status, fileName: `${v.plate.replace("/", "-")}-${type}-v${ver}.pdf`, uploadedBy: "Jassim Behbehani", uploadedAt: mk(addDays(expires, -360), "10:00") };
    docs.push(d);
    return d;
  };
  vehicles.forEach((v, i) => {
    addDoc(v, "registration", ri(120, 900));
    const ins = i % 9 === 3 ? -ri(2, 20) : i % 6 === 1 ? ri(3, 28) : ri(60, 330);
    const prevIns = addDoc(v, "insurance", ins - 365, 1, undefined, "superseded");
    addDoc(v, "insurance", ins, 2, prevIns.id);
    addDoc(v, "inspection_cert", i % 7 === 2 ? ri(5, 25) : ri(80, 340));
    if (v.ownership === "rented") addDoc(v, "lease", (leaseMap[v.id] === "lc-0001" || leaseMap[v.id] === "lc-0006") ? -9 : leaseMap[v.id] === "lc-0003" ? 36 : 600);
  });

  // ---- audit ----
  const audit: AuditEntry[] = [
    { id: "aud-0001", at: mk(addDays(TODAY, -12), "17:55"), actor: "Sunil Thapa", entity: "Vehicle", entityId: INC.closed, action: "Status change", detail: "in service to under repair", reason: "Incident inc-0006 routed to service" },
    { id: "aud-0002", at: mk(addDays(TODAY, -6), "11:20"), actor: "Jassim Behbehani", entity: "Vehicle", entityId: INC.closed, action: "Status change", detail: "under repair to in service (returned to fleet)", reason: "Service job sj-0004 completed" },
    { id: "aud-0003", at: mk(addDays(TODAY, -3), "09:40"), actor: "Jassim Behbehani", entity: "Lessor contract", entityId: "lc-0003", action: "Renewed", detail: "MD-2025-B v1 renewed as v2 (2026-02-01 to 2026-12-15)" },
    { id: "aud-0004", at: mk(addDays(TODAY, -1), "13:12"), actor: "Jassim Behbehani", entity: "Assignment", entityId: "vas-cover", action: "Created", detail: "Cover assignment on veh-0015 overlapping the standing assignment", reason: "Rider on leave" },
    { id: "aud-0005", at: mk(addDays(TODAY, -15), "10:00"), actor: "Jassim Behbehani", entity: "Desk user", entityId: "du-0005", action: "Offboarded", detail: "Bikash Gurung login deactivated", reason: "Left the company" },
  ];

  return { deskUsers, events, inspections, incidents, jobs, fuel, routes, assignments, contracts, leases, schedules, docs, audit };
}
