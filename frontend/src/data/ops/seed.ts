import { addDays, TODAY } from "@/lib/dates";
import type { Worker } from "../entities";
import { seedContracts, seedVehicles, seedWorkers } from "../seed/core";
import { dowOf, eachDay } from "./dates";
import { applyRepayments, generateEntries, type RunContext } from "./payroll-run";
import { clientRevenue } from "./revenue";
import type {
  Assignment, AuditEntry, ClientInvoice, DeductionPlan, DocExpiry, FuelTx, Offboarding, Order, PayConfigItem, PayParamRec, PayrollEntry, PayrollPeriod,
  Shift, SpecialHours, StatusKey, StatusSegment, WeeklyPerf, WorkerExt, WorkerLogin, ConflictAck,
} from "./types";

const once = <T,>(fn: () => T) => { let v: T | undefined; return () => (v ??= fn()); };
const rng = (seed: number) => { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); };
const pad = (n: number, w = 4) => String(n).padStart(w, "0");

export const STORES: Record<string, string[]> = {
  "cli-americana": ["Salhiya Mall", "Avenues Food Court", "Hawalli Main St", "Salmiya Gulf Rd", "Farwaniya Block 4", "Jahra Ring Rd"],
  "cli-talabat": ["Zone Hawalli", "Zone Salmiya", "Zone Farwaniya", "Zone Jahra"],
};
const PLACE_BY_LOC: Record<string, string> = { "loc-s1": "Alshaya DC — Amghara", "loc-s2": "Bean & Brew — Avenues Mall" };

export const coreWorkers = once(() => seedWorkers());
const wIdx = (w: Worker) => Number(w.id.split("-")[1]);

/* ---------------- pay config ---------------- */
export const seedPayConfig = (): PayConfigItem[] => [
  { id: "pcf-0001", group: "deduction", key: "traffic_fine", label: "Traffic fine", active: true, system: true },
  { id: "pcf-0002", group: "deduction", key: "cod_shortfall", label: "COD shortfall", active: true, system: true },
  { id: "pcf-0003", group: "deduction", key: "equipment", label: "Equipment", active: true, system: true },
  { id: "pcf-0004", group: "deduction", key: "advance", label: "Advance repayment", active: true, system: true },
  { id: "pcf-0005", group: "deduction", key: "other", label: "Other", active: true, system: true },
  { id: "pcf-0006", group: "bonus", key: "performance_incentive", label: "Performance incentive", defaultFils: 120, active: true, system: true },
  { id: "pcf-0007", group: "bonus", key: "marketplace_bonus", label: "Marketplace bonus (per event, fils)", defaultFils: 100, active: true, system: true },
  { id: "pcf-0008", group: "allowance", key: "food", label: "Food allowance (monthly)", defaultFils: 25_000, active: true, system: true },
  { id: "pcf-0009", group: "allowance", key: "accommodation", label: "Accommodation living allowance (monthly max)", defaultFils: 60_000, active: true, system: true },
];

/* ---------------- status segments ---------------- */
const SPECIAL: Record<string, [StatusKey, string, string | null, ("onboarding" | "between_assignments" | "standby" | "sick_housing" | "refused_work")?][]> = {
  "wrk-0003": [["active", "2026-06-01", "2026-10-20"], ["sick_leave", "2026-10-21", "2026-10-25"], ["active", "2026-10-26", null]],
  "wrk-0005": [["accommodation", "2026-10-01", "2026-10-07", "onboarding"], ["active", "2026-10-08", "2026-11-02"], ["sick_leave", "2026-11-03", "2026-11-06"], ["active", "2026-11-07", null]],
  "wrk-0007": [["probation", "2026-06-01", null]],
  "wrk-0008": [["active", "2026-06-01", "2026-10-09"], ["annual_leave", "2026-10-10", "2026-10-24"], ["active", "2026-10-25", null]],
  "wrk-0012": [["active", "2026-06-01", "2026-10-14"], ["accommodation", "2026-10-15", "2026-10-18", "refused_work"], ["accommodation", "2026-10-19", "2026-10-21", "between_assignments"], ["active", "2026-10-22", null]],
  "wrk-0013": [["active", "2026-06-01", "2026-10-28"], ["terminated", "2026-10-29", null]],
  "wrk-0019": [["active", "2026-06-01", "2026-09-30"], ["terminated", "2026-10-01", null]],
  "wrk-0020": [["active", "2026-06-01", "2026-10-31"], ["blocked", "2026-11-01", null]],
  "wrk-0026": [["training", "2026-10-01", "2026-10-14"], ["probation", "2026-10-15", "2026-11-30"]],
  "wrk-0030": [["active", "2026-06-01", null]],
};

export const seedSegments = once((): StatusSegment[] => {
  const out: StatusSegment[] = [];
  let n = 0;
  const add = (workerId: string, status: StatusKey, from: string, to: string | null, reason?: StatusSegment["reason"]) =>
    out.push({ id: `seg-${pad(++n)}`, workerId, status, from, to, reason, version: 1 });
  coreWorkers().forEach((w, i) => {
    if (SPECIAL[w.id]) { SPECIAL[w.id].forEach(([st, f, t, r]) => add(w.id, st, f, t, r)); return; }
    const start = w.joiningDate > "2026-06-01" ? w.joiningDate : "2026-06-01";
    const k = 3 + (i % 4);
    const st = w.status as StatusKey;
    if (st === "active" || st === "standby") add(w.id, st, start, null);
    else if (st === "probation") { add(w.id, "active", start, addDays(TODAY, -61)); add(w.id, "probation", addDays(TODAY, -60), null); }
    else { add(w.id, "active", start, addDays(TODAY, -k - 1)); add(w.id, st, addDays(TODAY, -k), null); }
  });
  return out;
});

/* ---------------- assignments ---------------- */
export const seedAssignments = once((): Assignment[] => {
  const ws = coreWorkers();
  const vs = seedVehicles();
  const out: Assignment[] = [];
  let n = 0;
  const base = (p: Omit<Assignment, "id" | "ownerCompanyId" | "kind" | "version"> & Partial<Assignment>): Assignment => ({ id: `asg-${pad(++n)}`, ownerCompanyId: "cmp-ithc", kind: "regular", version: 1, ...p });
  const pool: Record<string, string[]> = { car: vs.filter((v) => v.type === "car").map((v) => v.id), bike: vs.filter((v) => v.type === "bike").map((v) => v.id) };
  const used: Record<string, number> = {};
  const vehicleFor = (w: Worker): { vehicleId?: string; shift: Assignment["shift"] } => {
    const t = w.vehicleTypes?.[0] ?? "car";
    const list = pool[t] ?? [];
    const c = used[t] ?? 0;
    used[t] = c + 1;
    if (c >= list.length * 2) return { shift: "full" };
    return { vehicleId: list[c % list.length], shift: c < list.length ? "am" : "pm" };
  };
  for (const w of ws) {
    const i = wIdx(w);
    if (i <= 22) {
      const v = vehicleFor(w);
      const to = w.id === "wrk-0013" ? "2026-10-28" : w.id === "wrk-0019" ? "2026-09-30" : w.id === "wrk-0020" ? "2026-10-31" : null;
      out.push(base({ workerId: w.id, clientId: "cli-americana", place: STORES["cli-americana"][i % 6], from: "2026-07-01", to, ...v }));
    } else if (i <= 32) {
      const v = vehicleFor(w);
      if (w.id === "wrk-0030") {
        out.push(base({ workerId: w.id, clientId: "cli-americana", place: STORES["cli-americana"][2], from: "2026-07-01", to: "2026-10-13", ...v }));
        out.push(base({ workerId: w.id, clientId: "cli-talabat", place: STORES["cli-talabat"][1], from: "2026-10-14", to: null, ...v }));
      } else out.push(base({ workerId: w.id, clientId: "cli-talabat", place: STORES["cli-talabat"][i % 4], from: "2026-03-01", to: null, ...v }));
    } else if (i <= 51) {
      out.push(base({ workerId: w.id, clientId: w.currentClientId ?? "cli-alshaya", place: PLACE_BY_LOC[w.currentLocationId ?? "loc-s1"], from: i >= 45 && i <= 49 ? "2026-06-01" : "2026-04-01", to: null, shift: "full" }));
    }
  }
  const find = (id: string) => out.find((a) => a.workerId === id && a.to === null)!;
  // shared vehicle: wrk-0011 and wrk-0012 both full-day on the same vehicle (conflict to resolve by a human)
  const a11 = find("wrk-0011"), a12 = find("wrk-0012");
  if (a11.vehicleId) { a11.shift = "full"; a12.vehicleId = a11.vehicleId; a12.shift = "full"; }
  // double-booked driver: second regular assignment overlapping his primary one
  out.push(base({ workerId: "wrk-0009", clientId: "cli-americana", place: STORES["cli-americana"][5], from: "2026-11-02", to: "2026-11-12", shift: "full" }));
  // substitution: wrk-0004 covers wrk-0005's route in the afternoon while wrk-0005 is on sick leave
  find("wrk-0004").shift = "am";
  out.push(base({ workerId: "wrk-0004", clientId: "cli-americana", place: find("wrk-0005").place, from: "2026-11-03", to: "2026-11-06", shift: "pm", kind: "substitution", substitutesWorkerId: "wrk-0005", note: "Covering Rajesh route, sick leave" }));
  return out;
});

/* ---------------- orders ---------------- */
export const seedOrders = once((): Order[] => {
  const r = rng(4242);
  const ws = new Map(coreWorkers().map((w) => [w.id, w]));
  const segs = seedSegments();
  const out: Order[] = [];
  let n = 0;
  const working = (id: string, d: string) => {
    const s = segs.filter((x) => x.workerId === id && x.from <= d && (x.to === null || x.to >= d)).sort((a, b) => b.from.localeCompare(a.from))[0];
    return s?.status === "active" || s?.status === "probation";
  };
  for (const a of seedAssignments()) {
    if (a.kind !== "regular" || (a.clientId !== "cli-americana" && a.clientId !== "cli-talabat")) continue;
    const w = ws.get(a.workerId)!;
    const from = a.from > "2026-09-01" ? a.from : "2026-09-01";
    const to = a.to && a.to < TODAY ? a.to : TODAY;
    for (const d of eachDay(from, to)) {
      if (!working(a.workerId, d)) continue;
      if (d === TODAY && !(a.clientId === "cli-americana" && wIdx(w) <= 11)) continue;
      if (r() < (dowOf(d) === 4 ? 0.35 : 0.07)) continue;
      const base = { id: `ord-${pad(++n)}`, date: d, workerId: a.workerId, clientId: a.clientId, place: a.place ?? "", version: 1, enteredBy: "Faisal Al-Dosari" };
      if (a.clientId === "cli-americana") out.push({ ...base, kind: "store", orders: 18 + Math.floor(r() * 25) });
      else {
        const batch = a.workerId === "wrk-0028" && d < "2026-10-20" ? "Batch 3" : (w.batch ?? "Batch 3");
        out.push({ ...base, kind: "marketplace", pickups: 14 + Math.floor(r() * 20), dropoffs: 13 + Math.floor(r() * 20), batch });
      }
    }
  }
  return out;
});

/* ---------------- schedule ---------------- */
const TIMES = { am: ["07:00", "15:00"], pm: ["15:00", "23:00"], full: ["08:00", "18:00"] } as const;
export const seedShifts = once((): { shifts: Shift[]; acks: ConflictAck[] } => {
  const r = rng(99);
  const segs = seedSegments();
  const out: Shift[] = [];
  let n = 0;
  const weeks = ["2026-11-02", "2026-11-09", "2026-11-16"];
  const working = (id: string, d: string) => {
    const s = segs.filter((x) => x.workerId === id && x.from <= d && (x.to === null || x.to >= d)).sort((a, b) => b.from.localeCompare(a.from))[0];
    return s?.status === "active" || s?.status === "probation";
  };
  for (const a of seedAssignments()) {
    if (a.kind !== "regular" || !["cli-americana", "cli-talabat"].includes(a.clientId) || a.to) continue;
    const idx = Number(a.workerId.split("-")[1]);
    if (a.workerId === "wrk-0009" && a.place === STORES["cli-americana"][5]) continue;
    // the two drivers sharing a vehicle on "full" assignments are scheduled am/pm; they clash only on one day
    const pat: keyof typeof TIMES = a.workerId === "wrk-0011" ? "am" : a.workerId === "wrk-0012" ? "pm" : a.shift;
    for (const wk of weeks)
      for (let d = 0; d < 7; d++) {
        const date = addDays(wk, d);
        if (d === 6 || (d === 4 && idx % 2) || !working(a.workerId, date)) continue;
        const [ps, pe] = TIMES[pat];
        const past = date < TODAY;
        const jitter = () => `${pad(Math.floor(r() * 2), 1)}${pad(Math.floor(r() * 9), 1)}`;
        out.push({
          id: `sh-${pad(++n, 5)}`, date, workerId: a.workerId, vehicleId: a.vehicleId, clientId: a.clientId, place: a.place, plannedStart: ps, plannedEnd: pe,
          actualStart: past || date === TODAY ? `${ps.slice(0, 2)}:${jitter().slice(0, 2)}` : undefined, actualEnd: past ? `${pe.slice(0, 2)}:${jitter().slice(0, 2)}` : undefined, version: 1,
        });
      }
  }
  const mk = (p: Partial<Shift> & Pick<Shift, "date" | "workerId" | "clientId" | "plannedStart" | "plannedEnd">): Shift => ({ id: `sh-${pad(++n, 5)}`, version: 1, ...p });
  // driver double-booked on Wed 11 Nov
  out.push(mk({ date: "2026-11-11", workerId: "wrk-0009", clientId: "cli-talabat", place: STORES["cli-talabat"][0], plannedStart: "13:00", plannedEnd: "21:00" }));
  // vehicle clash Thu 12 Nov: wrk-0011 am shift stretched into wrk-0012 pm shift
  const s11 = out.find((s) => s.workerId === "wrk-0011" && s.date === "2026-11-12");
  if (s11) s11.plannedEnd = "17:00";
  // past, acknowledged conflict
  const a = mk({ date: "2026-11-04", workerId: "wrk-0014", clientId: "cli-talabat", place: STORES["cli-talabat"][2], plannedStart: "10:00", plannedEnd: "14:00" });
  out.push(a);
  const base14 = out.find((s) => s.workerId === "wrk-0014" && s.date === "2026-11-04" && s.id !== a.id);
  const acks: ConflictAck[] = base14 ? [{ id: "ack-0001", key: `d:${[a.id, base14.id].sort().join("|")}`, note: "Intentional split: handover run agreed with client", by: "Faisal Al-Dosari", at: "2026-11-04" }] : [];
  return { shifts: out, acks };
});

/* ---------------- workers ---------------- */
export const seedPayParams = (): PayParamRec[] =>
  coreWorkers().map((w) => {
    const i = wIdx(w);
    const americana = i <= 22, talabat = i >= 23 && i <= 32;
    return {
      id: w.id, foodAllowance: 25_000, accommodationMax: 60_000, monthlyOrderTarget: americana ? 700 : 0,
      incentiveRateAbove: americana ? 120 : 0, incentiveRateBelow: americana ? 60 : 0,
      marketplace: talabat ? { pickupTarget: 600, dropoffTarget: 580, pickupBonusRate: 100, pickupShortfallRate: 90, dropoffBonusRate: 110, dropoffShortfallRate: 80 } : undefined,
      effectiveFrom: "2026-07-01", version: 1,
    };
  });

const EXPIRED_CONTRACT: Record<string, number> = { "wrk-0002": -12, "wrk-0027": -40, "wrk-0006": 9, "wrk-0016": 22 };
export const seedExt = (): WorkerExt[] =>
  coreWorkers().map((w) => {
    const i = wIdx(w);
    return {
      id: w.id, email: i % 4 === 0 ? undefined : `${w.username.split("-")[0]}@mail.example`, visaNo: i % 9 === 0 ? undefined : `V${pad(700000 + i * 31, 7)}`,
      healthCardNo: i % 7 === 0 ? undefined : `HC${pad(300000 + i * 17, 7)}`,
      contractEnd: addDays(TODAY, EXPIRED_CONTRACT[w.id] ?? 200 + i * 3), contractOwnerCompanyId: "cmp-ithc",
      offboarding: w.id === "wrk-0013" ? { startedOn: "2026-10-29", lastDay: "2026-10-28" } : w.id === "wrk-0019" ? { startedOn: "2026-10-01", lastDay: "2026-09-30" } : undefined,
    };
  });
export const seedLogins = (): WorkerLogin[] =>
  coreWorkers().map((w) => {
    const email = seedExt().find((e) => e.id === w.id)?.email;
    return { id: w.id, username: w.username, tempPassword: `Tmp-${pad(Math.floor(wIdx(w) * 7919) % 10000)}`, revealed: wIdx(w) % 5 !== 0, views: [], emailedTo: email, mustChange: wIdx(w) > 50, active: w.id !== "wrk-0013" && w.id !== "wrk-0019" };
  });
export const seedDocs = (): DocExpiry[] => {
  const r = rng(31337);
  const out: DocExpiry[] = [];
  let n = 0;
  for (const w of coreWorkers()) {
    const types: DocExpiry["type"][] = ["passport", "visa", "health_card"];
    if (w.civilId) types.push("civil_id");
    if (w.roles.includes("driver")) types.push("licence");
    for (const type of types) {
      const roll = r();
      const off = roll < 0.05 ? -Math.floor(r() * 30) - 1 : roll < 0.18 ? Math.floor(r() * 60) : 60 + Math.floor(r() * 500);
      out.push({ id: `doc-${pad(++n)}`, workerId: w.id, type, expires: addDays(TODAY, off) });
    }
  }
  return out;
};

/* ---------------- payroll chain ---------------- */
export const seedPlans0 = (): DeductionPlan[] => {
  const p = (id: number, workerId: string, kind: string, description: string, total: number, instalment: number, startMonth: string, issuedOn: string, repayments: DeductionPlan["repayments"] = []): DeductionPlan =>
    ({ id: `pln-${pad(id)}`, workerId, kind, description, total, instalment, startMonth, issuedOn, repayments, version: 1 });
  return [
    p(1, "wrk-0003", "advance", "Salary advance (family emergency)", 150_000, 50_000, "2026-09", "2026-08-20"),
    p(2, "wrk-0006", "advance", "Salary advance", 60_000, 30_000, "2026-08", "2026-07-25", [{ periodId: "pp-2026-08", amount: 30_000 }]),
    p(3, "wrk-0008", "traffic_fine", "Traffic fine ref TF-88213 (speeding)", 60_000, 20_000, "2026-10", "2026-10-05"),
    p(4, "wrk-0024", "cod_shortfall", "COD shortfall 14 Oct", 12_500, 12_500, "2026-10", "2026-10-15"),
    p(5, "wrk-0015", "equipment", "Lost helmet and bag", 25_000, 12_500, "2026-10", "2026-10-02"),
    p(6, "wrk-0027", "other", "Uniform replacement", 8_000, 8_000, "2026-09", "2026-09-04"),
    p(7, "wrk-0010", "advance", "Salary advance (travel)", 200_000, 40_000, "2026-10", "2026-09-28"),
    p(8, "wrk-0021", "traffic_fine", "Traffic fine ref TF-90177 (red light)", 90_000, 30_000, "2026-09", "2026-09-02"),
    p(9, "wrk-0013", "advance", "Salary advance", 100_000, 25_000, "2026-10", "2026-09-30"),
  ];
};
export const ctxBase = once((): Omit<RunContext, "plans"> => ({
  workers: coreWorkers(), segments: seedSegments(), orders: seedOrders(), params: seedPayParams(), assignments: seedAssignments(), contracts: seedContracts(), config: seedPayConfig(),
}));
export const payrollSeed = once(() => {
  const ctx = ctxBase();
  const plans0 = seedPlans0();
  const sep = generateEntries("2026-09", { ...ctx, plans: plans0 });
  const plans1 = applyRepayments(plans0, sep, "pp-2026-09");
  const oct = generateEntries("2026-10", { ...ctx, plans: plans1 });
  return { plans: plans1, entries: [...sep, ...oct] as PayrollEntry[] };
});
export const seedPlans = () => payrollSeed().plans;
export const seedEntries = () => payrollSeed().entries;
export const seedPeriods = (): PayrollPeriod[] => [
  { id: "pp-2026-09", companyId: "cmp-ithc", month: "2026-09", state: "closed", generatedAt: "2026-10-02", approvedBy: "Reem Al-Failakawi", approvedAt: "2026-10-07", version: 3, events: [
    { at: "2026-10-02", by: "Reem Al-Failakawi", action: "Generated" }, { at: "2026-10-03", by: "Reem Al-Failakawi", action: "Approved and locked" },
    { at: "2026-10-06", by: "Reem Al-Failakawi", action: "Reopened", reason: "Traffic fine for a driver posted late; correct deductions before accounting export" },
    { at: "2026-10-07", by: "Reem Al-Failakawi", action: "Approved and locked" } ] },
  { id: "pp-2026-10", companyId: "cmp-ithc", month: "2026-10", state: "open", generatedAt: "2026-11-02", version: 1, events: [{ at: "2026-11-02", by: "Reem Al-Failakawi", action: "Generated" }] },
  { id: "pp-2026-11", companyId: "cmp-ithc", month: "2026-11", state: "not_generated", version: 1, events: [] },
];

/* ---------------- fuel, invoices, performance, offboarding, audit ---------------- */
export const seedFuel = once((): FuelTx[] => {
  const r = rng(2026);
  const vs = new Map(seedVehicles().map((v) => [v.id, v]));
  const out: FuelTx[] = [];
  let n = 0;
  for (const a of seedAssignments()) {
    if (!a.vehicleId || a.to || a.kind !== "regular") continue;
    const v = vs.get(a.vehicleId)!;
    const bike = v.type === "bike";
    let odo = v.odometerKm - 1200;
    const kmPerL = bike ? 34 : 12;
    const heavy = a.vehicleId === "veh-0009";
    for (let d = addDays("2026-10-01", Math.floor(r() * 3)); d < TODAY; d = addDays(d, 4 + Math.floor(r() * 3))) {
      const litres = Math.round((bike ? 6 + r() * 4 : 20 + r() * 14) * 10) / 10;
      odo += Math.round(litres * kmPerL * (heavy ? 0.55 : 0.9 + r() * 0.2));
      out.push({ id: `fue-${pad(++n)}`, date: d, vehicleId: a.vehicleId, workerId: a.workerId, litres, cost: Math.round(litres * 165), odometerKm: odo, handoverRef: `HO-${d.slice(5).replace("-", "")}-${pad(n, 3)}` });
    }
    if (a.vehicleId === "veh-0005") out.push({ id: `fue-${pad(++n)}`, date: "2026-11-05", vehicleId: a.vehicleId, workerId: a.workerId, litres: 62.4, cost: 10_296, odometerKm: odo + 30 });
    if (a.vehicleId === "veh-0013") { out.push({ id: `fue-${pad(++n)}`, date: "2026-11-02", vehicleId: a.vehicleId, workerId: a.workerId, litres: 18, cost: 2_970, odometerKm: odo + 5 }); out.push({ id: `fue-${pad(++n)}`, date: "2026-11-02", vehicleId: a.vehicleId, workerId: a.workerId, litres: 20, cost: 3_300, odometerKm: odo + 9 }); }
  }
  return out;
});
export const seedInvoices = (): ClientInvoice[] => {
  const ctx = { orders: seedOrders(), contracts: seedContracts(), workers: coreWorkers(), assignments: seedAssignments(), segments: seedSegments() };
  const rev = (c: string, m: string) => clientRevenue(c, m, ctx);
  return [
    { id: "inv-0001", clientId: "cli-americana", month: "2026-09", invoiced: rev("cli-americana", "2026-09"), status: "paid" },
    { id: "inv-0002", clientId: "cli-talabat", month: "2026-09", invoiced: rev("cli-talabat", "2026-09") - 124_000, status: "sent" },
    { id: "inv-0003", clientId: "cli-alshaya", month: "2026-09", invoiced: rev("cli-alshaya", "2026-09"), status: "paid" },
    { id: "inv-0004", clientId: "cli-bean", month: "2026-09", invoiced: rev("cli-bean", "2026-09") + 3_300, status: "sent" },
    { id: "inv-0005", clientId: "cli-americana", month: "2026-10", invoiced: rev("cli-americana", "2026-10") - 480, status: "draft" },
    { id: "inv-0006", clientId: "cli-talabat", month: "2026-10", invoiced: null, status: "not_issued" },
    { id: "inv-0007", clientId: "cli-alshaya", month: "2026-10", invoiced: rev("cli-alshaya", "2026-10"), status: "sent" },
    { id: "inv-0008", clientId: "cli-bean", month: "2026-10", invoiced: null, status: "not_issued" },
  ];
};
export const seedWeeklyPerf = (): WeeklyPerf[] => {
  const r = rng(555);
  const out: WeeklyPerf[] = [];
  let n = 0;
  for (const w of coreWorkers().filter((x) => x.riderId))
    for (const wk of ["2026-10-26", "2026-11-02"]) {
      const bias = w.batch === "Batch 1" ? 12 : w.batch === "Batch 2" ? 0 : -12;
      const g = (b: number) => Math.max(40, Math.min(100, Math.round(b + bias + r() * 14 - 7)));
      const planned = 40;
      out.push({ id: `wpf-${pad(++n)}`, workerId: w.id, riderId: w.riderId!, weekStart: wk, acceptance: g(78), plannedHours: planned, actualHours: Math.max(20, Math.min(46, Math.round(planned * (g(80) / 100)))), utilisation: g(74), lateLogin: Math.max(0, 100 - g(92)), specialCoverage: g(70) });
    }
  return out;
};
export const seedSpecialHours = (): SpecialHours[] => [
  { id: "sph-0001", label: "Lunch peak", day: "Daily", from: "12:00", to: "14:30" },
  { id: "sph-0002", label: "Dinner peak", day: "Daily", from: "19:00", to: "22:30" },
  { id: "sph-0003", label: "Weekend evening boost", day: "Fri", from: "17:00", to: "23:30", multiplier: "1.5x" },
];
export const seedOffboarding = (): Offboarding[] => [
  { id: "wrk-0013", lastDay: "2026-10-28", startedOn: "2026-10-29", reason: "Terminated: contract not renewed", vehicleReturned: false, docs: { civilId: true, licence: false, uniform: false, keys: true, simCard: false, deviceBag: false }, settlementApproved: false, completed: false, version: 1 },
  { id: "wrk-0019", lastDay: "2026-09-30", startedOn: "2026-10-01", reason: "Resigned", vehicleReturned: true, vehicleReturnRef: "HO-1002-014", docs: { civilId: true, licence: true, uniform: true, keys: true, simCard: true, deviceBag: true }, settlementApproved: true, completed: true, version: 3 },
];
export const seedAudit = (): AuditEntry[] => [
  { id: "aud-0001", at: "2026-10-06", actor: "Reem Al-Failakawi", entity: "payroll_period", entityId: "pp-2026-09", action: "reopen", reason: "Traffic fine for a driver posted late; correct deductions before accounting export", detail: "Period 2026-09 reopened" },
  { id: "aud-0002", at: "2026-10-20", actor: "Faisal Al-Dosari", entity: "batch", entityId: "wrk-0028", action: "batch_override", reason: "Platform confirmed promotion in weekly scorecard email", detail: "Batch 3 to Batch 1" },
  { id: "aud-0003", at: "2026-11-01", actor: "Faisal Al-Dosari", entity: "assignment", entityId: "asg-0020", action: "end", reason: "Worker blocked by HR after missing documents", detail: "Assignment ended 2026-10-31" },
];
