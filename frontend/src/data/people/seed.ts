import { addDays, TODAY } from "@/lib/dates";
import { seedContracts, seedVehicles, seedWorkers } from "@/data/seed/core";
import { DEFAULT_TIERS, docType } from "./docTypes";
import type {
  BenchRecord, ContactEntry, DocAudit, DocRecord, Escalation, HousingProperty, HousingUnit, Lease, Occupancy,
  Opportunity, PeopleSettings, Placement, Renewal, SeatRequirement, SiteSupervisor, Stay, UserAudit,
} from "./types";

let s = 90210;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n: number, w = 4) => String(n).padStart(w, "0");

export const seedSettings = (): PeopleSettings[] => [{
  id: "cfg-people",
  tiers: { ...DEFAULT_TIERS },
  gateApprovalX100: 200,
  gateEscalateX100: 160,
  seatTargetPct: 95,
  benchMinPct: 10,
  benchMaxPct: 15,
  contactLimitDays: 30,
  contactWarnDays: 21,
  foodMonthly: 30_000,
  insuranceMonthly: 6_500,
  permitTotal: 300_000,
  permitMonths: 24,
  includeBasePay: true,
  breakEven: { fixed_labour: 135_000, hourly: 190_000 },
  version: 1,
}];

/* ---------------- Housing ---------------- */

export const seedProperties = (): HousingProperty[] => [
  { id: "hp-0001", locationId: "loc-h1", name: "Khaitan Block A", address: "Khaitan, Block 4, Bldg 12", landlord: "Al-Bader Real Estate", version: 1 },
  { id: "hp-0002", locationId: "loc-h2", name: "Jleeb Al-Shuyoukh", address: "Jleeb, Street 7, Bldg 3", landlord: "Dar Al-Salam Properties", version: 1 },
  { id: "hp-0003", locationId: "loc-h3", name: "Mahboula 2", address: "Mahboula, Block 2, Bldg 9", landlord: "Al-Ghanim Estates", version: 1 },
  { id: "hp-0004", locationId: "loc-h4", name: "Salmiya Annex", address: "Salmiya, Block 10, Bldg 21", landlord: "Kanoo Holdings", version: 1 },
  { id: "hp-0005", locationId: "loc-h5", name: "Hawally Block C", address: "Hawally, Street 5, Bldg 8", landlord: "Al-Mazyad Trading", version: 1 },
];

const UNITS: Record<string, number[]> = {
  "hp-0001": [4, 4, 4, 4, 4, 4],
  "hp-0002": [4, 4, 4, 4, 4, 4, 4],
  "hp-0003": [4, 4, 4, 4, 4, 4],
  "hp-0004": [3, 3, 3, 3],
  "hp-0005": [4, 4, 4],
};

export const seedUnits = (): HousingUnit[] => {
  const out: HousingUnit[] = [];
  let n = 0;
  for (const [pid, beds] of Object.entries(UNITS)) {
    beds.forEach((b, i) => out.push({ id: `hu-${pad(++n)}`, propertyId: pid, unitNo: `${pid === "hp-0001" ? "A" : pid === "hp-0002" ? "J" : pid === "hp-0003" ? "M" : pid === "hp-0004" ? "S" : "H"}-${101 + i}`, beds: b }));
  }
  return out;
};

export const seedLeases = (): Lease[] => [
  { id: "ls-0001", propertyId: "hp-0001", leaseNo: "LS-KHA-26", landlord: "Al-Bader Real Estate", start: "2026-02-01", end: "2027-01-31", monthlyCost: 1_850_000, status: "current", version: 2, supersedesId: "ls-0006", documentId: "doc-lease-1" },
  { id: "ls-0002", propertyId: "hp-0002", leaseNo: "LS-JLB-26", landlord: "Dar Al-Salam Properties", start: "2026-01-01", end: "2026-12-31", monthlyCost: 2_400_000, status: "current", version: 1, documentId: "doc-lease-2" },
  { id: "ls-0003", propertyId: "hp-0003", leaseNo: "LS-MAH-25", landlord: "Al-Ghanim Estates", start: "2025-12-01", end: "2026-11-30", monthlyCost: 1_600_000, status: "current", version: 2, supersedesId: "ls-0007", documentId: "doc-lease-3" },
  { id: "ls-0004", propertyId: "hp-0004", leaseNo: "LS-SAL-26", landlord: "Kanoo Holdings", start: "2026-06-01", end: "2027-05-31", monthlyCost: 1_200_000, status: "current", version: 1, documentId: "doc-lease-4" },
  { id: "ls-0005", propertyId: "hp-0005", leaseNo: "LS-HAW-25", landlord: "Al-Mazyad Trading", start: "2025-09-01", end: "2026-10-31", monthlyCost: 950_000, status: "current", version: 1, documentId: "doc-lease-5" },
  { id: "ls-0006", propertyId: "hp-0001", leaseNo: "LS-KHA-25", landlord: "Al-Bader Real Estate", start: "2025-02-01", end: "2026-01-31", monthlyCost: 1_700_000, status: "superseded", version: 1, documentId: "doc-lease-6" },
  { id: "ls-0007", propertyId: "hp-0003", leaseNo: "LS-MAH-24", landlord: "Al-Ghanim Estates", start: "2024-12-01", end: "2025-11-30", monthlyCost: 1_500_000, status: "superseded", version: 1, documentId: "doc-lease-7" },
];

const LOC_TO_HP: Record<string, string> = { "loc-h1": "hp-0001", "loc-h2": "hp-0002", "loc-h3": "hp-0003" };
const HP5_IDX = [3, 9]; // worker numbers moved into Hawally (lease expired: edge case)

interface HousingSeed { occupancy: Occupancy[]; stays: Stay[] }
let housingCache: HousingSeed | null = null;

function buildHousing(): HousingSeed {
  if (housingCache) return housingCache;
  const units = seedUnits();
  const used = new Map<string, number>(); // unitId -> beds used
  const occupancy: Occupancy[] = [];
  const stays: Stay[] = [];
  s = 4411;
  const place = (pid: string): { unit: HousingUnit; bed: number } | null => {
    for (const u of units.filter((x) => x.propertyId === pid)) {
      const k = used.get(u.id) ?? 0;
      if (k < u.beds) {
        used.set(u.id, k + 1);
        return { unit: u, bed: k + 1 };
      }
    }
    return null;
  };
  const workers = seedWorkers();
  let o = 0, st = 0;
  const stayOffsets = [5, 12, 25, -6, 40, 55, 90, 140, 200, 250, 310, 365];
  workers.forEach((w, i) => {
    const num = i + 1;
    let pid = HP5_IDX.includes(num) ? "hp-0005" : LOC_TO_HP[w.housingLocationId ?? "loc-h1"];
    let slot = place(pid);
    if (!slot) { pid = "hp-0004"; slot = place(pid); }
    if (!slot) return;
    const moveIn = addDays(w.joiningDate, 3);
    if (HP5_IDX.includes(num)) {
      // history: previous bed in Mahboula, ended the day before moving to Hawally
      const prev = place("hp-0003");
      const switchDay = addDays(TODAY, -60);
      if (prev) {
        occupancy.push({ id: `occ-${pad(++o)}`, workerId: w.id, propertyId: "hp-0003", unitId: prev.unit.id, bed: prev.bed, moveIn, moveOut: addDays(switchDay, -1), note: "Moved to Hawally" });
      }
      occupancy.push({ id: `occ-${pad(++o)}`, workerId: w.id, propertyId: pid, unitId: slot.unit.id, bed: slot.bed, moveIn: switchDay, moveOut: null });
    } else {
      occupancy.push({ id: `occ-${pad(++o)}`, workerId: w.id, propertyId: pid, unitId: slot.unit.id, bed: slot.bed, moveIn, moveOut: null });
    }
    const cur = occupancy[occupancy.length - 1];
    const off = i < stayOffsets.length ? stayOffsets[i] : ri(60, 380);
    const stayId = `stay-${pad(++st)}`;
    cur.stayId = stayId;
    stays.push({ id: stayId, kind: "worker", workerId: w.id, propertyId: pid, unitId: slot.unit.id, start: cur.moveIn, end: addDays(TODAY, off), status: "active", version: 1 });
  });
  // a leaver: moved out 3 weeks ago, stay ended
  const leaver = workers[workers.length - 3];
  const leaverOcc = occupancy.find((x) => x.workerId === leaver.id && x.moveOut === null);
  if (leaverOcc) {
    leaverOcc.moveOut = addDays(TODAY, -21);
    leaverOcc.note = "Left housing";
    const ls = stays.find((x) => x.id === leaverOcc.stayId);
    if (ls) { ls.status = "ended"; ls.end = addDays(TODAY, -21); }
  }
  // guests
  const g1 = place("hp-0004");
  if (g1) {
    const sid = `stay-${pad(++st)}`;
    occupancy.push({ id: `occ-${pad(++o)}`, workerId: "", guestName: "Tariq Mahmood (contractor, Alshaya DC)", propertyId: "hp-0004", unitId: g1.unit.id, bed: g1.bed, moveIn: addDays(TODAY, -14), moveOut: null, stayId: sid });
    stays.push({ id: sid, kind: "guest", guestName: "Tariq Mahmood (contractor, Alshaya DC)", guestSponsor: "Alshaya Logistics Co.", propertyId: "hp-0004", unitId: g1.unit.id, start: addDays(TODAY, -14), end: addDays(TODAY, 16), status: "active", version: 1 });
  }
  const g2 = place("hp-0004");
  if (g2) {
    const sid = `stay-${pad(++st)}`;
    occupancy.push({ id: `occ-${pad(++o)}`, workerId: "", guestName: "Nabil Farouk (visiting trainer)", propertyId: "hp-0004", unitId: g2.unit.id, bed: g2.bed, moveIn: addDays(TODAY, -3), moveOut: null, stayId: sid });
    stays.push({ id: sid, kind: "guest", guestName: "Nabil Farouk (visiting trainer)", guestSponsor: "ITHC Operations", propertyId: "hp-0004", unitId: g2.unit.id, start: addDays(TODAY, -3), end: addDays(TODAY, 27), status: "active", version: 1 });
  }
  // a future-dated move-in (reserved bed)
  const fut = place("hp-0004");
  if (fut) {
    const w = workers[workers.length - 2];
    occupancy.push({ id: `occ-${pad(++o)}`, workerId: w.id, propertyId: "hp-0004", unitId: fut.unit.id, bed: fut.bed, moveIn: addDays(TODAY, 20), moveOut: null, note: "Reserved: transfer from Khaitan" });
    // that worker's current bed is closed the day before
    const curOcc = occupancy.find((x) => x.workerId === w.id && x.moveOut === null && x.moveIn <= TODAY);
    if (curOcc) curOcc.moveOut = addDays(TODAY, 19);
  }
  housingCache = { occupancy, stays };
  return housingCache;
}
export const seedOccupancy = () => buildHousing().occupancy;
export const seedStays = () => buildHousing().stays;

/* ---------------- Documents ---------------- */

const AUTH: Record<string, string> = {
  civil_id: "PACI", driving_licence: "Ministry of Interior (Traffic)", passport: "Passport Authority", visa_residency: "Ministry of Interior (Residency)",
  health_card: "Ministry of Health", employment_contract: "ITHC Logistics", vehicle_registration: "Ministry of Interior (Traffic)",
  vehicle_insurance: "Gulf Insurance Group", inspection_cert: "Traffic Inspection Dept.", client_contract_doc: "Client / ITHC", contract_amendment: "Client / ITHC", lease_agreement: "Landlord",
};
const VALIDITY: Record<string, number> = {
  civil_id: 1825, driving_licence: 3650, passport: 1825, visa_residency: 730, health_card: 365, employment_contract: 730,
  vehicle_registration: 365, vehicle_insurance: 365, inspection_cert: 365,
};

export function seedDocuments(): DocRecord[] {
  s = 31337;
  const out: DocRecord[] = [];
  let n = 0;
  const mk = (d: Omit<DocRecord, "id" | "uploadedBy" | "uploadedAt" | "status" | "version" | "mime" | "fileSize" | "fileName"> & Partial<DocRecord>): DocRecord => {
    const id = d.id ?? `doc-${pad(++n)}`;
    const jpg = rnd() > 0.82;
    const rec: DocRecord = {
      status: "current", version: 1, uploadedBy: "Dalal Al-Ajmi", uploadedAt: TODAY, ...d, id,
      fileName: d.fileName ?? `${d.typeKey}-${d.ownerId}.${jpg ? "jpg" : "pdf"}`,
      mime: d.mime ?? (jpg ? "image/jpeg" : "application/pdf"),
      fileSize: d.fileSize ?? ri(70_000, 420_000),
    };
    out.push(rec);
    return rec;
  };
  const expiryOffset = (): number => {
    const r = rnd();
    if (r < 0.04) return -ri(1, 40);
    if (r < 0.13) return ri(2, 29);
    if (r < 0.22) return ri(31, 59);
    return ri(65, 900);
  };
  const overrides: Record<string, number> = {
    "wrk-0003:driving_licence": 6, "wrk-0007:passport": -18, "wrk-0009:employment_contract": -12, "wrk-0012:visa_residency": 28,
    "wrk-0015:health_card": 45, "wrk-0020:civil_id": 14, "wrk-0024:passport": 58, "wrk-0031:visa_residency": -4, "wrk-0040:health_card": 9,
  };
  const noHealth = new Set(["wrk-0014", "wrk-0033"]);
  const workers = seedWorkers();
  workers.forEach((w, i) => {
    const types: string[] = ["civil_id", "passport", "visa_residency", "health_card", "employment_contract"];
    if (w.roles.includes("driver") && w.licenceNo) types.push("driving_licence");
    for (const t of types) {
      if (t === "civil_id" && !w.civilId) continue;
      if (t === "health_card" && noHealth.has(w.id)) continue;
      if (t === "driving_licence" && w.id === "wrk-0026") continue; // missing licence edge case
      const validity = VALIDITY[t];
      let off = overrides[`${w.id}:${t}`];
      if (off === undefined) {
        off = t === "employment_contract" ? validity - (Math.round((Date.parse(TODAY) - Date.parse(w.joiningDate)) / 86_400_000)) : Math.min(expiryOffset(), validity - 5);
      }
      const expiry = addDays(TODAY, off);
      const issue = addDays(expiry, -validity);
      const cur = mk({ ownerKind: "worker", ownerId: w.id, typeKey: t, issueDate: issue, expiryDate: expiry, authority: AUTH[t], uploadedAt: issue < TODAY ? addDays(issue, 4) > TODAY ? TODAY : addDays(issue, 4) : TODAY });
      if (i % 5 === 0 && (t === "civil_id" || t === "passport")) {
        // a prior superseded version retained
        const priorExpiry = addDays(issue, -1);
        const prior = mk({ ownerKind: "worker", ownerId: w.id, typeKey: t, issueDate: addDays(priorExpiry, -validity), expiryDate: priorExpiry, authority: AUTH[t], status: "superseded", supersededById: cur.id, uploadedAt: addDays(priorExpiry, -validity + 3) });
        cur.version = 2;
        cur.notes = `Renewal of ${prior.id}`;
      }
    }
    if (i % 9 === 0) mk({ ownerKind: "worker", ownerId: w.id, typeKey: "leave_record", issueDate: addDays(TODAY, -ri(10, 120)), expiryDate: null, authority: "ITHC HR", uploadedAt: addDays(TODAY, -5) });
    if (i % 17 === 4) mk({ ownerKind: "worker", ownerId: w.id, typeKey: "warning", issueDate: addDays(TODAY, -ri(10, 80)), expiryDate: null, authority: "ITHC HR", notes: "Late reporting, first written warning", uploadedAt: addDays(TODAY, -8) });
  });
  const vehicles = seedVehicles();
  vehicles.forEach((v) => {
    for (const t of ["vehicle_registration", "vehicle_insurance", "inspection_cert"]) {
      if (v.id === "veh-0013" && t === "vehicle_insurance") continue; // missing insurance
      let off = Math.min(expiryOffset(), 360);
      if (v.id === "veh-0007" && t === "inspection_cert") off = -22;
      if (v.id === "veh-0004" && t === "vehicle_insurance") off = 11;
      const expiry = addDays(TODAY, off);
      mk({ ownerKind: "vehicle", ownerId: v.id, typeKey: t, issueDate: addDays(expiry, -365), expiryDate: expiry, authority: AUTH[t], fileName: `${t}-${v.plate.replace("/", "-")}.pdf`, mime: "application/pdf", uploadedBy: "Jassim Behbehani" });
    }
  });
  for (const c of seedContracts().filter((x) => x.status === "active")) {
    if (c.id === "con-0005") continue; // signed copy missing
    mk({ ownerKind: "contract", ownerId: c.id, typeKey: "client_contract_doc", issueDate: c.validFrom, expiryDate: null, authority: "Client / ITHC", uploadedBy: "Layla Hamdan", fileName: `${c.contractNo}-v${c.version}-signed.pdf`, mime: "application/pdf" });
  }
  mk({ ownerKind: "contract", ownerId: "con-0001", typeKey: "contract_amendment", issueDate: "2026-07-01", expiryDate: null, authority: "Client / ITHC", uploadedBy: "Layla Hamdan", notes: "Rate revision v2", fileName: "CT-AMER-01-amendment-2.pdf", mime: "application/pdf" });
  // lease documents (ids referenced by leases)
  for (const l of seedLeases()) {
    const docId = l.documentId!;
    mk({ id: docId, ownerKind: "property", ownerId: l.propertyId, typeKey: "lease_agreement", issueDate: l.start, expiryDate: l.end, authority: l.landlord, status: l.status === "current" ? "current" : "superseded", version: l.version, uploadedBy: "Abdullah Al-Kandari", fileName: `${l.leaseNo}.pdf`, mime: "application/pdf", supersededById: l.status === "superseded" ? seedLeases().find((x) => x.supersedesId === l.id)?.documentId : undefined, uploadedAt: l.start });
  }
  void docType;
  return out;
}

export const seedDocAudit = (): DocAudit[] => [
  { id: "da-0001", docId: "doc-0001", at: "2026-10-20 09:14", by: "Mariam Al-Hajri", action: "Corrected expiry date", reason: "Typo in original entry; card shows 2031" },
];

/* ---------------- Client & deployment ---------------- */

export const seedPlacements = (): Placement[] => {
  const workers = seedWorkers().filter((w) => w.currentClientId === "cli-alshaya" || w.currentClientId === "cli-bean");
  const out: Placement[] = [];
  let a = 0, b = 0;
  workers.forEach((w, i) => {
    const isAlsh = w.currentClientId === "cli-alshaya";
    const contractId = isAlsh ? "con-0004" : "con-0005";
    const base = isAlsh ? "2026-04-01" : "2026-06-01";
    const from = addDays(w.joiningDate > base ? w.joiningDate : base, 2);
    let to: string | null = null;
    if (isAlsh) { a++; if (a === 3) to = "2026-10-25"; }
    else { b++; if (b === 2) to = "2026-11-02"; }
    out.push({ id: `plc-${pad(i + 1)}`, workerId: w.id, clientId: w.currentClientId!, contractId, siteLocationId: w.currentLocationId!, from, to, version: 1 });
  });
  return out;
};

export const seedSeatRequirements = (): SeatRequirement[] => [
  { id: "seat-0001", contractId: "con-0004", from: "2026-04-01", to: "2026-12-31", heads: 15, volumeFloor: 13, note: "Ramp-up phase 1" },
  { id: "seat-0002", contractId: "con-0004", from: "2027-01-01", to: "2027-03-31", heads: 40, volumeFloor: 36, note: "Full contracted strength" },
  { id: "seat-0003", contractId: "con-0005", from: "2026-06-01", to: "2026-12-31", heads: 6, volumeFloor: 6, note: "Avenues outlet staffing" },
  { id: "seat-0004", contractId: "con-0005", from: "2027-01-01", to: "2027-05-31", heads: 12, volumeFloor: 10, note: "Second outlet opens" },
  { id: "seat-0005", contractId: "con-0001", from: "2026-07-01", to: "2027-06-30", heads: 23, volumeFloor: 20, note: "Driver seats, store-based" },
  { id: "seat-0006", contractId: "con-0003", from: "2026-03-01", to: "2027-02-28", heads: 11, volumeFloor: 10, note: "Marketplace rider pool" },
];

export const seedOpportunities = (): Opportunity[] => {
  const o = (id: number, p: Partial<Opportunity> & Pick<Opportunity, "heads" | "revenuePerHead" | "breakEvenPerHead" | "startDate" | "stage" | "contractType">): Opportunity => ({
    id: `opp-${pad(id)}`, clientId: "", owner: "Hamad Al-Rashidi", approval: "none", version: 1, ...p,
  });
  return [
    o(1, { clientId: "cli-alshaya", heads: 20, contractType: "fixed_labour", revenuePerHead: 285_000, breakEvenPerHead: 135_000, startDate: "2027-01-15", stage: "negotiation", notes: "Second DC building, Amghara" }),
    o(2, { clientId: "cli-bean", heads: 8, contractType: "hourly", revenuePerHead: 343_200, breakEvenPerHead: 190_000, startDate: "2027-01-05", stage: "proposal", approval: "requested", notes: "Two new outlets; 208 hours per head per month" }),
    o(3, { prospectName: "Gulf Mart Hypermarkets", heads: 30, contractType: "fixed_labour", revenuePerHead: 270_000, breakEvenPerHead: 150_000, startDate: "2027-02-01", stage: "proposal", notes: "Needs written approval below 2.0x" }),
    o(4, { prospectName: "Kuwait Cold Chain", heads: 12, contractType: "fixed_labour", revenuePerHead: 240_000, breakEvenPerHead: 160_000, startDate: "2027-01-10", stage: "negotiation", lastEscalated: addDays(TODAY, -9), notes: "Client pushing rate down" }),
    o(5, { clientId: "cli-americana", heads: 6, contractType: "fixed_labour", revenuePerHead: 300_000, breakEvenPerHead: 140_000, startDate: "2027-03-01", stage: "lead", notes: "Store-prep staff" }),
    o(6, { prospectName: "Al-Mulla Facilities", heads: 10, contractType: "fixed_labour", revenuePerHead: 250_000, breakEvenPerHead: 120_000, startDate: "2026-12-01", stage: "signed", notes: "Security guards; signed, awaiting Finance contract" }),
    o(7, { clientId: "cli-alshaya", heads: 40, contractType: "fixed_labour", revenuePerHead: 285_000, breakEvenPerHead: 135_000, startDate: "2026-04-01", stage: "signed", convertedContractId: "con-0004", notes: "Original Alshaya award" }),
    o(8, { prospectName: "Sultan Centre", heads: 15, contractType: "fixed_labour", revenuePerHead: 235_000, breakEvenPerHead: 165_000, startDate: "2026-10-01", stage: "lost", notes: "Lost on price" }),
    o(9, { prospectName: "Zahra Catering", heads: 14, contractType: "hourly", revenuePerHead: 310_000, breakEvenPerHead: 190_000, startDate: "2027-02-15", stage: "lead" }),
    o(10, { prospectName: "Kuwait Airways Cargo", heads: 25, contractType: "fixed_labour", revenuePerHead: 320_000, breakEvenPerHead: 135_000, startDate: "2027-04-01", stage: "negotiation", notes: "Ramp 25 heads over 3 months" }),
    o(11, { prospectName: "Marina Mall Operator", heads: 9, contractType: "hourly", revenuePerHead: 280_000, breakEvenPerHead: 190_000, startDate: "2027-01-20", stage: "proposal", approval: "approved", approvalRef: "CEO-APPR-2026-014.pdf", approvalDate: addDays(TODAY, -4) }),
    o(12, { clientId: "cli-bean", heads: 4, contractType: "hourly", revenuePerHead: 343_200, breakEvenPerHead: 190_000, startDate: "2026-11-01", stage: "signed", notes: "Signed, start passed; staffing in progress" }),
  ];
};

export const seedContactLog = (): ContactEntry[] => {
  const by = "Hamad Al-Rashidi";
  const e: Omit<ContactEntry, "id" | "loggedBy">[] = [
    { date: addDays(TODAY, -12), clientId: "cli-americana", contractId: "con-0001", type: "visit", contactPerson: "Fahad Al-Sabah", outcome: "Reviewed store coverage; asked for two extra drivers for weekends" },
    { date: addDays(TODAY, -26), clientId: "cli-americana", contractId: "con-0001", type: "call", contactPerson: "Fahad Al-Sabah", outcome: "Rate review scheduled for Q1" },
    { date: addDays(TODAY, -41), clientId: "cli-americana", contractId: "con-0001", type: "meeting", contactPerson: "Americana Ops Director", outcome: "Agreed v2 rates; new volume floor confirmed" },
    { date: addDays(TODAY, -58), clientId: "cli-americana", contractId: "con-0001", type: "call", contactPerson: "Fahad Al-Sabah", outcome: "Late deliveries complaint resolved" },
    { date: addDays(TODAY, -80), clientId: "cli-americana", contractId: "con-0001", type: "visit", contactPerson: "Store managers", outcome: "Walkthrough of five stores" },
    { date: addDays(TODAY, -41), clientId: "cli-talabat", contractId: "con-0003", type: "meeting", contactPerson: "Noura Al-Enezi", outcome: "Batch bands reviewed; no changes" },
    { date: addDays(TODAY, -63), clientId: "cli-talabat", contractId: "con-0003", type: "call", contactPerson: "Noura Al-Enezi", outcome: "Asked about rider headcount for Ramadan" },
    { date: addDays(TODAY, -90), clientId: "cli-talabat", contractId: "con-0003", type: "email", contactPerson: "Noura Al-Enezi", outcome: "Confirmed monthly settlement format" },
    { date: addDays(TODAY, -27), clientId: "cli-alshaya", contractId: "con-0004", type: "visit", contactPerson: "Sara Al-Rashid", outcome: "DC walkthrough; discussed expansion to second building" },
    { date: addDays(TODAY, -44), clientId: "cli-alshaya", contractId: "con-0004", type: "call", contactPerson: "Sara Al-Rashid", outcome: "Two pickers requested at short notice" },
    { date: addDays(TODAY, -70), clientId: "cli-alshaya", contractId: "con-0004", type: "meeting", contactPerson: "Alshaya Procurement", outcome: "Quarterly review, scorecard good" },
    { date: addDays(TODAY, -8), clientId: "cli-bean", contractId: "con-0005", type: "visit", contactPerson: "Yousef Karam", outcome: "Avenues outlet short two baristas; redeployment promised" },
    { date: addDays(TODAY, -22), clientId: "cli-bean", contractId: "con-0005", type: "call", contactPerson: "Yousef Karam", outcome: "Hours reconciliation question answered" },
    { date: addDays(TODAY, -5), clientId: "cli-keeta", contractId: "con-0006", type: "meeting", contactPerson: "Liam Chen", outcome: "Go-live plan for January agreed" },
    { date: addDays(TODAY, -35), clientId: "cli-keeta", contractId: "con-0006", type: "call", contactPerson: "Liam Chen", outcome: "Draft contract comments received" },
  ];
  return e.map((x, i) => ({ id: `cl-${pad(i + 1)}`, loggedBy: by, ...x }));
};

export const seedRenewals = (): Renewal[] => [
  { id: "ren-0001", contractId: "con-0004", status: "in_talks", note: "Client wants expansion bundled with renewal", financeNotifiedOn: addDays(TODAY, -10) },
  { id: "ren-0002", contractId: "con-0005", status: "upcoming" },
  { id: "ren-0003", contractId: "con-0001", status: "upcoming", note: "Annual rate review" },
];

export const seedBench = (): BenchRecord[] => {
  const standby = seedWorkers().filter((w) => !w.currentClientId && w.roles.includes("driver"));
  const reasons = ["Awaiting a driver seat", "Returned from leave", "Client reduced headcount", "New hire pending seat"];
  const days = [34, 21, 12, 5];
  return standby.map((w, i) => ({ id: `bn-${pad(i + 1)}`, workerId: w.id, since: addDays(TODAY, -days[i % 4]), reason: reasons[i % 4] }));
};

export const seedEscalations = (): Escalation[] => [
  { id: "esc-0001", kind: "seat_floor", refId: "con-0005", date: addDays(TODAY, -6), note: "Bean & Brew below client minimum (5 of 6)", by: "Hamad Al-Rashidi" },
  { id: "esc-0002", kind: "gate_low", refId: "opp-0004", date: addDays(TODAY, -9), note: "Kuwait Cold Chain at 1.50x, weekly escalation", by: "Hamad Al-Rashidi" },
];

/* ---------------- Supervisors ---------------- */

export const seedSupervisors = (): SiteSupervisor[] => [
  { id: "sup-0001", name: "Peter Mwangi", email: "peter.mwangi@ithc.demo", username: "peter.mwangi-0010", roleLabel: "Site supervisor", siteLocationId: "loc-s1", status: "active", loginActive: true, mustChangePassword: false, createdOn: "2026-03-10", version: 1 },
  { id: "sup-0002", name: "Joseph Otieno", email: "joseph.otieno@ithc.demo", username: "joseph.otieno-0101", roleLabel: "Site supervisor", siteLocationId: "loc-s2", status: "active", loginActive: true, mustChangePassword: false, createdOn: "2026-06-02", version: 1 },
  { id: "sup-0003", name: "Bikash Rai", email: "bikash.rai@ithc.demo", username: "bikash.rai-0102", roleLabel: "Site supervisor", siteLocationId: "loc-hq", status: "active", loginActive: true, mustChangePassword: true, createdOn: addDays(TODAY, -2), version: 1 },
  { id: "sup-0004", name: "Sara Al-Rashid", email: "sara@alshaya-logistics.demo", username: "sara.alrashid-0103", roleLabel: "Site supervisor (client contact)", siteLocationId: "loc-s1", clientId: "cli-alshaya", status: "active", loginActive: true, mustChangePassword: false, createdOn: "2026-07-15", version: 1 },
  { id: "sup-0005", name: "Samuel Eze", email: "samuel.eze@ithc.demo", username: "samuel.eze-0104", roleLabel: "Site supervisor", siteLocationId: "loc-h1", status: "active", loginActive: true, mustChangePassword: false, createdOn: "2026-08-20", version: 1 },
  { id: "sup-0006", name: "Anil Singh", email: "anil.singh@ithc.demo", username: "anil.singh-0105", roleLabel: "Site supervisor", siteLocationId: "loc-s2", status: "offboarded", loginActive: false, mustChangePassword: false, createdOn: "2026-02-01", offboardedOn: "2026-10-12", version: 2 },
];

export const seedUserAudit = (): UserAudit[] => [
  { id: "ua-0001", at: "2026-03-10 10:02", by: "Abdullah Al-Kandari", subjectId: "sup-0001", action: "Account created", detail: "peter.mwangi-0010, Site supervisor, Alshaya DC" },
  { id: "ua-0002", at: "2026-06-02 11:20", by: "Abdullah Al-Kandari", subjectId: "sup-0002", action: "Account created", detail: "joseph.otieno-0101, Site supervisor, Avenues" },
  { id: "ua-0003", at: "2026-07-15 09:40", by: "Abdullah Al-Kandari", subjectId: "sup-0004", action: "Account created", detail: "sara.alrashid-0103, client contact, Alshaya DC" },
  { id: "ua-0004", at: "2026-08-20 14:05", by: "Abdullah Al-Kandari", subjectId: "sup-0005", action: "Account created", detail: "samuel.eze-0104, Site supervisor, Khaitan" },
  { id: "ua-0005", at: addDays(TODAY, -2) + " 08:55", by: "Abdullah Al-Kandari", subjectId: "sup-0003", action: "Account created", detail: "bikash.rai-0102, Site supervisor, Operating Building" },
  { id: "ua-0006", at: "2026-02-01 09:00", by: "Abdullah Al-Kandari", subjectId: "sup-0006", action: "Account created", detail: "anil.singh-0105, Site supervisor, Avenues" },
  { id: "ua-0007", at: "2026-10-12 16:30", by: "Abdullah Al-Kandari", subjectId: "sup-0006", action: "Offboarded", detail: "Login deactivated automatically" },
];
