import type { ImportSheet } from "@/data/admin";
import { parseKD } from "@/lib/money";

export interface FieldSpec {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
  check?: (v: string, row: Record<string, string>) => string | null;
}
export interface SheetSpec {
  id: ImportSheet;
  label: string;
  /** Dependency order: lessors and buildings first, then workers and vehicles, then everything that references them. */
  tier: 1 | 2 | 3;
  fields: FieldSpec[];
  /** Money field (KD text) summed for reconciliation; when absent only row counts reconcile. */
  amountKey?: string;
  uniqueKey: string;
  /** Where applied rows end up in this demo. */
  destination: "core" | "staged";
  sample: () => string[][];
}

const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? null : `"${v}" is not a valid date (use YYYY-MM-DD)`);
const kd = (v: string) => {
  if (!/^\d+(\.\d{1,3})?$/.test(v.trim())) return `"${v}" is not a valid KD amount (max 3 decimals)`;
  return null;
};
export const kdFils = (v: string) => { const n = parseKD(v); return Number.isFinite(n) ? n : 0; };

let seed = 1;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const FIRST = ["Ahmed", "Kamal", "Bikash", "Anil", "Hassan", "Samuel", "David", "Ibrahim", "Prakash", "Suresh", "Omar", "Yusuf", "Naveen", "Dinesh", "Joseph", "Peter", "Mohamed", "Ravi", "Sanjay", "Tariq"];
const LAST = ["Rai", "Singh", "Kumar", "Gurung", "Otieno", "Eze", "Abdalla", "Nair", "Shrestha", "Khan", "Hussein", "Ali", "Mwangi", "Thapa", "Sharma"];
const NAT = ["Nepal", "India", "Kenya", "Nigeria", "Egypt", "Bangladesh"];

const workerSample = () => {
  seed = 11;
  const rows: string[][] = [["Full Name", "Nationality", "Position", "Civil ID No", "Passport", "Mobile", "Date Joined", "Basic Salary (KD)", "Rider ID", "Client", "Licence No"]];
  for (let i = 0; i < 258; i++) {
    const talabat = i % 4 === 0;
    rows.push([`${pick(FIRST)} ${pick(LAST)}`, pick(NAT), i % 9 === 8 ? "warehouse" : "driver", `28${String(100000000 + i * 7919).padStart(10, "0")}`, `N${String(1000000 + i * 31)}`, `+965 6${String(2000000 + i * 17)}`,
      `2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`, (180 + (i % 5) * 10).toFixed(3), talabat ? `TLB-${3000 + i}` : "", talabat ? "Talabat" : i % 9 === 8 ? "Alshaya Warehouse" : "Americana", i % 9 === 8 ? "" : `DL${String(500000 + i)}`]);
  }
  // Deliberate errors so the error report has something to show.
  rows[14][3] = "2910"; // bad civil id
  rows[33][8] = rows[29][8]; // duplicate rider id
  rows[87][6] = "2025-02-31"; // impossible date
  rows[120][7] = ""; // missing salary
  rows[150][10] = ""; rows[150][2] = "driver"; // driver without licence
  rows[201][7] = "18O.000"; // typo in salary
  rows[240][0] = ""; // missing name
  return rows;
};

const vehicleSample = () => {
  seed = 23;
  const rows: string[][] = [["Plate No", "Vehicle Type", "Make", "Model", "Year", "Owned/Leased", "Lessor", "Monthly Cost (KD)", "Odometer", "Home Desk"]];
  const car = [["Toyota", "Yaris"], ["Nissan", "Sunny"], ["Kia", "Picanto"]];
  const bike = [["Honda", "CB125"], ["Yamaha", "YBR125"]];
  for (let i = 0; i < 96; i++) {
    const isBike = i % 3 !== 0;
    const [mk, md] = isBike ? pick(bike) : pick(car);
    const own = i % 4 === 0 ? "ITHC" : i % 4 === 1 ? "financed" : "leased";
    rows.push([`${40 + (i % 50)}/${String(60000 + i * 13)}`, isBike ? "bike" : "car", mk, md, String(2022 + (i % 4)), own, own === "leased" ? (i % 2 ? "Max Dash" : "Swift Link") : "", isBike ? "55.000" : own === "leased" ? "135.000" : "95.000", String(5000 + i * 450), i % 2 ? "Desk 1" : "Desk 2"]);
  }
  rows[10][1] = "scooter"; // unknown type
  rows[22][0] = rows[21][0]; // duplicate plate
  rows[40][6] = "Gulf Rentals"; rows[40][5] = "leased"; // unknown lessor
  rows[55][4] = "19x4"; // bad year
  rows[70][7] = "-20.000"; // negative cost
  return rows;
};

const simple = (header: string[], n: number, row: (i: number) => string[]) => () => [header, ...Array.from({ length: n }, (_, i) => row(i))];

export const SPECS: SheetSpec[] = [
  {
    id: "lessor_contracts", label: "Lessor contracts", tier: 1, destination: "staged", uniqueKey: "contract_no", amountKey: "monthly_rate_kd",
    fields: [
      { key: "lessor", label: "Lessor", required: true, aliases: ["lessorname"], check: (v) => (["Max Dash", "Swift Link"].includes(v) ? null : `Unknown lessor "${v}" (Max Dash or Swift Link)`) },
      { key: "contract_no", label: "Contract no", required: true, aliases: ["contractnumber"] },
      { key: "start", label: "Start date", required: true, check: date }, { key: "end", label: "End date", required: true, check: date },
      { key: "monthly_rate_kd", label: "Monthly rate (KD)", required: true, aliases: ["monthlyrate"], check: kd },
    ],
    sample: simple(["Lessor Name", "Contract Number", "Start", "End", "Monthly Rate"], 3, (i) => [i % 2 ? "Max Dash" : "Swift Link", `LC-${2026}-${i + 1}`, "2026-01-01", "2027-12-31", (4200 + i * 600).toFixed(3)]),
  },
  {
    id: "buildings", label: "Buildings", tier: 1, destination: "staged", uniqueKey: "name", amountKey: "monthly_rent_kd",
    fields: [
      { key: "name", label: "Building", required: true, aliases: ["buildingname"] }, { key: "address", label: "Address", required: true },
      { key: "monthly_rent_kd", label: "Monthly rent (KD)", required: true, aliases: ["rent"], check: kd }, { key: "lease_end", label: "Lease end", required: true, check: date },
    ],
    sample: simple(["Building Name", "Address", "Rent", "Lease End"], 6, (i) => [["Khaitan Block A", "Jleeb Al-Shuyoukh", "Mahboula 2", "Abbasiya 1", "Fahaheel 3", "Salmiya 6"][i], `Block ${i + 1}, Kuwait`, (1500 + i * 150).toFixed(3), "2027-06-30"]),
  },
  {
    id: "workers", label: "Workers (drivers and labour)", tier: 2, destination: "core", uniqueKey: "civil_id", amountKey: "base_salary_kd",
    fields: [
      { key: "name", label: "Full name", required: true, aliases: ["fullname", "workername"], check: (v) => (/^[A-Za-z][A-Za-z'’\- .]*$/.test(v) ? null : "Name must be written in Latin letters") },
      { key: "nationality", label: "Nationality" },
      { key: "role", label: "Role", required: true, aliases: ["position", "job"], check: (v) => (["driver", "picker", "warehouse", "security", "barista", "handover", "service"].includes(v.toLowerCase()) ? null : `Unknown role "${v}"`) },
      { key: "civil_id", label: "Civil ID", required: true, aliases: ["civilidno", "civilid"], check: (v) => (/^\d{12}$/.test(v) ? null : "Civil ID must be 12 digits") },
      { key: "passport_no", label: "Passport no", aliases: ["passport"] }, { key: "phone", label: "Phone", aliases: ["mobile"] },
      { key: "joining_date", label: "Joining date", required: true, aliases: ["datejoined"], check: date },
      { key: "base_salary_kd", label: "Base salary (KD)", required: true, aliases: ["basicsalarykd", "basicsalary"], check: kd },
      { key: "rider_id", label: "Rider ID", aliases: ["riderid"] }, { key: "client", label: "Client" },
      { key: "licence_no", label: "Licence no", aliases: ["licenceno", "licence"], check: undefined },
    ],
    sample: workerSample,
  },
  {
    id: "vehicles", label: "Vehicles", tier: 2, destination: "core", uniqueKey: "plate", amountKey: "monthly_cost_kd",
    fields: [
      { key: "plate", label: "Plate", required: true, aliases: ["plateno"] },
      { key: "type", label: "Type", required: true, aliases: ["vehicletype"], check: (v) => (["car", "bike", "transport"].includes(v.toLowerCase()) ? null : `Unknown vehicle type "${v}"`) },
      { key: "make", label: "Make", required: true }, { key: "model", label: "Model", required: true },
      { key: "year", label: "Year", required: true, check: (v) => (/^(19|20)\d{2}$/.test(v) ? null : `"${v}" is not a valid year`) },
      { key: "ownership", label: "Ownership", required: true, aliases: ["ownedleased"] },
      { key: "lessor", label: "Lessor", check: (v) => (["Max Dash", "Swift Link"].includes(v) ? null : `Unknown lessor "${v}"`) },
      { key: "monthly_cost_kd", label: "Monthly cost (KD)", required: true, aliases: ["monthlycostkd", "monthlycost"], check: kd },
      { key: "odometer_km", label: "Odometer (km)", aliases: ["odometer"] }, { key: "home_desk", label: "Home desk", aliases: ["homedesk"] },
    ],
    sample: vehicleSample,
  },
  {
    id: "assignments", label: "Assignments", tier: 3, destination: "staged", uniqueKey: "civil_id",
    fields: [
      { key: "civil_id", label: "Worker civil ID", required: true, check: (v) => (/^\d{12}$/.test(v) ? null : "Civil ID must be 12 digits") },
      { key: "client", label: "Client", required: true, check: (v) => (["Americana", "Talabat", "Keeta", "Alshaya Warehouse", "Bean & Brew Cafés"].includes(v) ? null : `Unknown client "${v}"`) },
      { key: "vehicle_plate", label: "Vehicle plate" }, { key: "start", label: "Start date", required: true, check: date }, { key: "end", label: "End date", check: date },
    ],
    sample: simple(["civil_id", "client", "vehicle_plate", "start", "end"], 30, (i) => [`28${String(100000000 + i * 7919).padStart(10, "0")}`, i % 4 ? "Americana" : "Talabat", `${40 + (i % 50)}/${String(60000 + i * 13)}`, "2026-01-01", ""]),
  },
  {
    id: "stays", label: "Stays", tier: 3, destination: "staged", uniqueKey: "civil_id",
    fields: [
      { key: "civil_id", label: "Worker civil ID", required: true, check: (v) => (/^\d{12}$/.test(v) ? null : "Civil ID must be 12 digits") },
      { key: "building", label: "Building", required: true }, { key: "bed", label: "Bed" },
      { key: "start", label: "Start date", required: true, check: date }, { key: "end", label: "End date", check: date },
    ],
    sample: simple(["civil_id", "building", "bed", "start", "end"], 40, (i) => [`28${String(100000000 + i * 7919).padStart(10, "0")}`, ["Khaitan Block A", "Jleeb Al-Shuyoukh", "Mahboula 2"][i % 3], String((i % 8) + 1), "2026-03-01", ""]),
  },
  {
    id: "advances", label: "Advances (opening balances)", tier: 3, destination: "staged", uniqueKey: "civil_id", amountKey: "balance_kd",
    fields: [
      { key: "civil_id", label: "Worker civil ID", required: true, check: (v) => (/^\d{12}$/.test(v) ? null : "Civil ID must be 12 digits") },
      { key: "amount_kd", label: "Original amount (KD)", required: true, check: kd }, { key: "issued", label: "Issued", required: true, check: date },
      { key: "monthly_deduction_kd", label: "Monthly deduction (KD)", required: true, check: kd },
      { key: "balance_kd", label: "Balance still owed (KD)", required: true, aliases: ["balance"], check: kd },
    ],
    sample: simple(["civil_id", "amount_kd", "issued", "monthly_deduction_kd", "balance"], 22, (i) => [`28${String(100000000 + i * 7919).padStart(10, "0")}`, (150 + i * 10).toFixed(3), "2026-08-15", "25.000", (100 + i * 5).toFixed(3)]),
  },
];
export const specOf = (id: ImportSheet) => SPECS.find((s) => s.id === id)!;

export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); out.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim()));
}
export const toCsv = (rows: string[][]) => rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Suggest a source column for each target field by name. */
export function autoMap(spec: SheetSpec, header: string[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const f of spec.fields) {
    const names = [f.key, f.label, ...(f.aliases ?? [])].map(norm);
    const hit = header.find((h) => names.includes(norm(h)));
    if (hit) m[f.key] = hit;
  }
  return m;
}
