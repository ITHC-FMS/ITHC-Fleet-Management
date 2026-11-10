import { addDays, daysBetween, overlaps, TODAY, type BizDate } from "@/lib/dates";
import type { Contract, Location, Vehicle, Worker } from "@/data/entities";
import { docType, DOC_TYPES, OWNER_DEPT, OWNER_LABEL } from "./docTypes";
import type { DocRecord, HousingProperty, HousingUnit, Lease, Occupancy, Opportunity, PeopleSettings, Placement, SeatRequirement, Stay } from "./types";

/* ---------- housing ---------- */

export const occupiesOn = (o: Occupancy, d: BizDate) => o.moveIn <= d && (o.moveOut === null || o.moveOut >= d);
export const currentLease = (leases: Lease[], propertyId: string) =>
  leases.filter((l) => l.propertyId === propertyId && l.status === "current").sort((a, b) => b.end.localeCompare(a.end))[0];
/** A building is open for new bed assignments only while its current building contract is valid. */
export const leaseValidOn = (leases: Lease[], propertyId: string, d: BizDate = TODAY) => {
  const l = currentLease(leases, propertyId);
  return !!l && l.start <= d && l.end >= d;
};
export const capacityOf = (units: HousingUnit[], propertyId: string) => units.filter((u) => u.propertyId === propertyId).reduce((a, u) => a + u.beds, 0);

/** Overlap conflicts for a proposed occupancy (same bed, or same worker in two beds). */
export function occupancyConflicts(all: Occupancy[], draft: Occupancy): string[] {
  const out: string[] = [];
  for (const o of all) {
    if (o.id === draft.id) continue;
    if (!overlaps(o.moveIn, o.moveOut, draft.moveIn, draft.moveOut)) continue;
    if (o.unitId === draft.unitId && o.bed === draft.bed) out.push(`Bed ${draft.bed} in that unit is already occupied from ${o.moveIn}${o.moveOut ? ` to ${o.moveOut}` : ""}`);
    if (draft.workerId && o.workerId === draft.workerId) out.push(`The worker already has a bed from ${o.moveIn}${o.moveOut ? ` to ${o.moveOut}` : ""}`);
  }
  return out;
}

/* ---------- documents / watchlist ---------- */

export interface AlertItem {
  key: string;
  ownerKind: "worker" | "vehicle" | "contract" | "property" | "stay" | "lease";
  ownerId: string;
  ownerLabel: string;
  dept: string;
  typeKey: string;
  typeLabel: string;
  kind: "expiring" | "expired" | "missing";
  expiry: BizDate | null;
  daysLeft: number | null;
  tierDays: number;
  link: { href: string; label: string };
}

const WORKING_OFF = new Set(["terminated", "inactive", "absconded"]);

export function buildAlerts(args: {
  docs: DocRecord[]; workers: Worker[]; vehicles: Vehicle[]; contracts: Contract[]; leases: Lease[]; properties: HousingProperty[]; stays: Stay[]; settings: PeopleSettings;
}): AlertItem[] {
  const { docs, workers, vehicles, contracts, leases, properties, stays, settings } = args;
  const out: AlertItem[] = [];
  const tierOf = (k: string) => settings.tiers[k] ?? docType(k)?.tierDays ?? 30;
  const push = (it: Omit<AlertItem, "daysLeft" | "kind"> & { kind?: AlertItem["kind"] }) => {
    const daysLeft = it.expiry ? daysBetween(TODAY, it.expiry) : null;
    if (it.kind === "missing") { out.push({ ...it, kind: "missing", daysLeft: null }); return; }
    if (daysLeft === null) return;
    if (daysLeft > it.tierDays) return;
    out.push({ ...it, kind: daysLeft < 0 ? "expired" : "expiring", daysLeft });
  };
  const wName = new Map(workers.map((w) => [w.id, w]));
  const vName = new Map(vehicles.map((v) => [v.id, v]));
  const cName = new Map(contracts.map((c) => [c.id, c]));
  const pName = new Map(properties.map((p) => [p.id, p]));
  const cur = docs.filter((d) => d.status === "current");
  const has = new Set(cur.map((d) => `${d.ownerKind}:${d.ownerId}:${d.typeKey}`));

  for (const d of cur) {
    const t = docType(d.typeKey);
    if (!t || !d.expiryDate) continue;
    if (d.ownerKind === "worker") {
      const w = wName.get(d.ownerId);
      if (!w || WORKING_OFF.has(w.status)) continue;
      push({ key: d.id, ownerKind: "worker", ownerId: d.ownerId, ownerLabel: w.name, dept: OWNER_DEPT.worker, typeKey: d.typeKey, typeLabel: t.label, expiry: d.expiryDate, tierDays: tierOf(d.typeKey), link: { href: "/hr/workers", label: "Workers" } });
    } else if (d.ownerKind === "vehicle") {
      const v = vName.get(d.ownerId);
      push({ key: d.id, ownerKind: "vehicle", ownerId: d.ownerId, ownerLabel: v ? `${v.plate} (${v.make} ${v.model})` : d.ownerId, dept: OWNER_DEPT.vehicle, typeKey: d.typeKey, typeLabel: t.label, expiry: d.expiryDate, tierDays: tierOf(d.typeKey), link: { href: "/fleet/vehicles", label: "Fleet vehicles" } });
    } else if (d.ownerKind === "contract") {
      const c = cName.get(d.ownerId);
      push({ key: d.id, ownerKind: "contract", ownerId: d.ownerId, ownerLabel: c ? c.contractNo : d.ownerId, dept: OWNER_DEPT.contract, typeKey: d.typeKey, typeLabel: t.label, expiry: d.expiryDate, tierDays: tierOf(d.typeKey), link: { href: "/finance/contracts", label: "Finance contracts" } });
    }
    // property lease documents are covered by the lease items below
  }
  // client contract end dates
  for (const c of contracts.filter((x) => x.status === "active" && x.validTo)) {
    push({ key: `ct-${c.id}`, ownerKind: "contract", ownerId: c.id, ownerLabel: c.contractNo, dept: OWNER_DEPT.contract, typeKey: "client_contract_doc", typeLabel: "Client contract end date", expiry: c.validTo, tierDays: tierOf("client_contract_doc"), link: { href: "/finance/contracts", label: "Finance contracts" } });
  }
  // building contracts
  for (const l of leases.filter((x) => x.status === "current")) {
    push({ key: `ls-${l.id}`, ownerKind: "lease", ownerId: l.propertyId, ownerLabel: `${pName.get(l.propertyId)?.name ?? l.propertyId} (${l.leaseNo})`, dept: OWNER_DEPT.lease, typeKey: "lease_agreement", typeLabel: "Building contract", expiry: l.end, tierDays: tierOf("lease_agreement"), link: { href: "/housing/leases", label: "Housing leases" } });
  }
  // stay contracts
  for (const st of stays.filter((x) => x.status === "active")) {
    const label = st.kind === "worker" ? wName.get(st.workerId ?? "")?.name ?? st.workerId : st.guestName;
    push({ key: `st-${st.id}`, ownerKind: "stay", ownerId: st.id, ownerLabel: `${label ?? ""} (${pName.get(st.propertyId)?.name ?? ""})`, dept: OWNER_DEPT.stay, typeKey: "stay_contract", typeLabel: "Stay contract", expiry: st.end, tierDays: tierOf("stay_contract"), link: { href: "/housing/stays", label: "Housing stays" } });
  }
  // missing entirely
  const missing = (ownerKind: "worker" | "vehicle" | "contract" | "property", ownerId: string, ownerLabel: string, typeKey: string, link: AlertItem["link"]) => {
    if (has.has(`${ownerKind}:${ownerId}:${typeKey}`)) return;
    const t = docType(typeKey)!;
    out.push({ key: `miss-${ownerKind}-${ownerId}-${typeKey}`, ownerKind, ownerId, ownerLabel, dept: OWNER_DEPT[ownerKind], typeKey, typeLabel: t.label, kind: "missing", expiry: null, daysLeft: null, tierDays: tierOf(typeKey), link });
  };
  for (const w of workers.filter((x) => !WORKING_OFF.has(x.status))) {
    for (const t of DOC_TYPES.filter((x) => x.owner === "worker" && (x.required || (x.key === "driving_licence" && w.roles.includes("driver") && !!w.licenceNo))))
      missing("worker", w.id, w.name, t.key, { href: "/hr/documents", label: "HR documents" });
  }
  for (const v of vehicles.filter((x) => x.status !== "off_fleet"))
    for (const t of DOC_TYPES.filter((x) => x.owner === "vehicle" && x.required)) missing("vehicle", v.id, `${v.plate} (${v.make} ${v.model})`, t.key, { href: "/fleet/documents", label: "Fleet documents" });
  for (const c of contracts.filter((x) => x.status === "active"))
    missing("contract", c.id, c.contractNo, "client_contract_doc", { href: "/finance/documents", label: "Finance documents" });
  for (const p of properties) missing("property", p.id, p.name, "lease_agreement", { href: "/housing/leases", label: "Housing leases" });
  return out.sort((a, b) => (a.kind === "missing" ? 1 : 0) - (b.kind === "missing" ? 1 : 0) || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
}

export { OWNER_LABEL };

/* ---------- deployment ---------- */

const LABOUR = new Set(["fixed_labour", "hourly"]);
export const isLabour = (c: Contract) => LABOUR.has(c.pricingModel);
export const placementActive = (p: Placement, d: BizDate = TODAY) => p.from <= d && (p.to === null || p.to >= d);
const OFF = new Set(["terminated", "absconded", "inactive", "blocked"]);

export function seatFor(reqs: SeatRequirement[], contractId: string, d: BizDate = TODAY) {
  return reqs.find((r) => r.contractId === contractId && r.from <= d && r.to >= d);
}

/** Active placement worker ids for a contract on a date. */
export function filledIds(args: { contract: Contract; placements: Placement[]; workers: Worker[]; date?: BizDate }): string[] {
  const { contract, placements, workers, date = TODAY } = args;
  if (isLabour(contract)) return placements.filter((p) => p.contractId === contract.id && placementActive(p, date)).map((p) => p.workerId);
  const placed = new Set(placements.map((p) => p.workerId));
  return workers.filter((w) => w.currentClientId === contract.clientId && !placed.has(w.id) && !OFF.has(w.status)).map((w) => w.id);
}

export interface SeatRow {
  contract: Contract; contracted: number; floor: number; filled: number; gap: number; pct: number;
  state: "ok" | "below_target" | "below_minimum" | "no_requirement";
}
export function seatRows(args: { contracts: Contract[]; reqs: SeatRequirement[]; placements: Placement[]; workers: Worker[]; settings: PeopleSettings; date?: BizDate }): SeatRow[] {
  const { contracts, reqs, placements, workers, settings, date = TODAY } = args;
  const out: SeatRow[] = [];
  for (const contract of contracts.filter((c) => c.status === "active")) {
    const req = seatFor(reqs, contract.id, date);
    const filled = filledIds({ contract, placements, workers, date }).length;
    if (!req && contract.seatsContracted === undefined) continue;
    const contracted = req?.heads ?? contract.seatsContracted ?? 0;
    const floor = req?.volumeFloor ?? contract.volumeFloor ?? 0;
    const pct = contracted ? (filled / contracted) * 100 : 0;
    const state = !req && contract.seatsContracted === undefined ? "no_requirement" : filled < floor ? "below_minimum" : pct < settings.seatTargetPct ? "below_target" : "ok";
    out.push({ contract, contracted, floor, filled, gap: Math.max(0, contracted - filled), pct, state });
  }
  return out;
}

/** Fully-loaded daily carrying cost (fils) of one worker. */
export function dailyCarry(args: { worker: Worker; housingPerHead: number; settings: PeopleSettings }): number {
  const { worker, housingPerHead, settings: s } = args;
  const monthly = housingPerHead + s.foodMonthly + s.insuranceMonthly + Math.round(s.permitTotal / s.permitMonths) + (s.includeBasePay ? worker.baseSalary : 0);
  return Math.round(monthly / 30);
}

export function isDeployed(w: Worker, placements: Placement[], date: BizDate = TODAY): boolean {
  const mine = placements.filter((p) => p.workerId === w.id);
  if (mine.length) return mine.some((p) => placementActive(p, date));
  return !!w.currentClientId;
}
/** Internal staff are neither deployed nor bench. */
export const benchEligible = (w: Worker) => !OFF.has(w.status) && !w.roles.some((r) => r === "handover" || r === "service" || r === "admin");

/** Multiple = revenue per head / break-even per head; compared by cross-multiplication, never float money. */
export const multipleX100 = (o: Pick<Opportunity, "revenuePerHead" | "breakEvenPerHead">) => (o.breakEvenPerHead ? Math.round((o.revenuePerHead * 100) / o.breakEvenPerHead) : 0);
export const gateOf = (o: Opportunity, s: PeopleSettings): "ok" | "approval" | "escalate" => {
  const m = multipleX100(o);
  return m < s.gateEscalateX100 ? "escalate" : m < s.gateApprovalX100 ? "approval" : "ok";
};
export const fmtX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;

export { addDays };
export type { Location };

/** Monthly housing cost per head (fils) for each occupant on a date: current lease rent / occupants of that property. */
export function housingCostPerHead(occ: Occupancy[], leases: Lease[], date: BizDate = TODAY) {
  const byProp = new Map<string, Occupancy[]>();
  for (const o of occ.filter((x) => occupiesOn(x, date))) byProp.set(o.propertyId, [...(byProp.get(o.propertyId) ?? []), o]);
  const byOcc = new Map<string, number>();
  const byWorker = new Map<string, number>();
  const perProp = new Map<string, number>();
  for (const [pid, list] of byProp) {
    const rent = currentLease(leases, pid)?.monthlyCost ?? 0;
    const per = Math.round(rent / list.length);
    perProp.set(pid, per);
    for (const o of list) { byOcc.set(o.id, per); if (o.workerId) byWorker.set(o.workerId, per); }
  }
  return { byOcc, byWorker, perProp };
}
