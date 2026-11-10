import type { Client, Company, Contract, Location, Vehicle, Worker, WorkerRole, WorkerStatus } from "../entities";
import { addDays, TODAY } from "@/lib/dates";

/** Deterministic pseudo-random so the demo looks the same on every load. */
let s = 20260511;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];

export const seedCompanies = (): Company[] => [
  { id: "cmp-ithc", name: "ITHC Logistics", kind: "operating" },
  { id: "cmp-maxdash", name: "Max Dash", kind: "lessor" },
  { id: "cmp-swiftlink", name: "Swift Link", kind: "lessor" },
];

export const seedClients = (): Client[] => [
  { id: "cli-americana", name: "Americana", legalName: "Americana Restaurants Kuwait W.L.L.", model: "Store-based", contactName: "Fahad Al-Sabah", contactPhone: "+965 5551 2001" },
  { id: "cli-talabat", name: "Talabat", legalName: "Talabat Kuwait Co. W.L.L.", model: "Marketplace (batched)", contactName: "Noura Al-Enezi", contactPhone: "+965 5551 2002" },
  { id: "cli-keeta", name: "Keeta", legalName: "Keeta Delivery Kuwait", model: "Marketplace (VDA, planned)", contactName: "Liam Chen", contactPhone: "+965 5551 2003" },
  { id: "cli-alshaya", name: "Alshaya Warehouse", legalName: "Alshaya Logistics Co.", model: "Labour supply", contactName: "Sara Al-Rashid", contactPhone: "+965 5551 2004" },
  { id: "cli-bean", name: "Bean & Brew Cafés", legalName: "Bean & Brew Trading", model: "Labour supply (hourly)", contactName: "Yousef Karam", contactPhone: "+965 5551 2005" },
];

export const seedLocations = (): Location[] => [
  { id: "loc-hq", name: "ITHC Operating Building (Shuwaikh)", kind: "operating_building", address: "Shuwaikh Industrial, Block 2" },
  { id: "loc-desk1", name: "Handover Desk 1 — Shuwaikh", kind: "handover_desk", address: "Operating Building, Ground floor" },
  { id: "loc-desk2", name: "Handover Desk 2 — Farwaniya", kind: "handover_desk", address: "Farwaniya, Block 5" },
  { id: "loc-h1", name: "Housing — Khaitan Block A", kind: "housing", address: "Khaitan, Block 4, Bldg 12", monthlyCost: 1_850_000 },
  { id: "loc-h2", name: "Housing — Jleeb Al-Shuyoukh", kind: "housing", address: "Jleeb, Street 7, Bldg 3", monthlyCost: 2_400_000 },
  { id: "loc-h3", name: "Housing — Mahboula 2", kind: "housing", address: "Mahboula, Block 2, Bldg 9", monthlyCost: 1_600_000 },
  { id: "loc-s1", name: "Alshaya DC — Amghara", kind: "client_site", address: "Amghara Industrial" },
  { id: "loc-s2", name: "Bean & Brew — Avenues Mall", kind: "client_site", address: "The Avenues, Level 1" },
  { id: "loc-svc", name: "Fleet Service Centre", kind: "service_centre", address: "Shuwaikh Industrial, Block 4" },
];

export const seedContracts = (): Contract[] => [
  { id: "con-0001", contractNo: "CT-AMER-01", version: 2, clientId: "cli-americana", ownerCompanyId: "cmp-ithc", pricingModel: "order_based", validFrom: "2026-07-01", validTo: null, volumeFloor: 4000, status: "active",
    rates: [{ key: "car", label: "Per order — car", unit: "order", amount: 1_100 }, { key: "bike", label: "Per order — bike", unit: "order", amount: 850 }] },
  { id: "con-0002", contractNo: "CT-AMER-01", version: 1, clientId: "cli-americana", ownerCompanyId: "cmp-ithc", pricingModel: "order_based", validFrom: "2026-01-01", validTo: "2026-06-30", volumeFloor: 4000, status: "superseded",
    rates: [{ key: "car", label: "Per order — car", unit: "order", amount: 1_000 }, { key: "bike", label: "Per order — bike", unit: "order", amount: 800 }] },
  { id: "con-0003", contractNo: "CT-TLBT-01", version: 1, clientId: "cli-talabat", ownerCompanyId: "cmp-ithc", pricingModel: "marketplace_batched", validFrom: "2026-03-01", validTo: null, status: "active",
    rates: [{ key: "admin_fee", label: "Administrative fee", unit: "event", amount: 300 }, { key: "ops_fee", label: "Operational fee", unit: "event", amount: 450 }, { key: "ach_b1", label: "Achievement fee — batch 1", unit: "event", amount: 250 }, { key: "ach_b2", label: "Achievement fee — batch 2", unit: "event", amount: 150 }] },
  { id: "con-0004", contractNo: "CT-ALSH-01", version: 1, clientId: "cli-alshaya", ownerCompanyId: "cmp-ithc", pricingModel: "fixed_labour", validFrom: "2026-04-01", validTo: "2027-03-31", seatsContracted: 40, volumeFloor: 36, status: "active",
    rates: [{ key: "monthly", label: "Monthly fee per head", unit: "head/month", amount: 285_000 }] },
  { id: "con-0005", contractNo: "CT-BEAN-01", version: 1, clientId: "cli-bean", ownerCompanyId: "cmp-ithc", pricingModel: "hourly", validFrom: "2026-06-01", validTo: "2027-05-31", seatsContracted: 12, volumeFloor: 10, status: "active",
    rates: [{ key: "hour", label: "Per hour", unit: "hour", amount: 1_650 }] },
  { id: "con-0006", contractNo: "CT-KEET-01", version: 1, clientId: "cli-keeta", ownerCompanyId: "cmp-ithc", pricingModel: "bulk", validFrom: "2027-01-01", validTo: null, status: "draft",
    rates: [{ key: "bulk", label: "Per parcel (single pickup)", unit: "parcel", amount: 700 }] },
];

const first = ["Ahmed", "Rajesh", "Sunil", "Kamal", "Joseph", "Peter", "Mohamed", "Ali", "Bikash", "Anil", "Hassan", "Samuel", "David", "Ibrahim", "Prakash", "Suresh", "Omar", "Yusuf", "Naveen", "Dinesh"];
const last = ["Khan", "Sharma", "Thapa", "Mwangi", "Okafor", "Hussein", "Rai", "Singh", "Kumar", "Gurung", "Otieno", "Eze", "Abdalla", "Nair", "Shrestha"];
const nat = ["Nepal", "India", "Kenya", "Nigeria", "Sudan", "Egypt", "Bangladesh"];

export const seedWorkers = (): Worker[] => {
  s = 20260511;
  const out: Worker[] = [];
  const plan: { roles: WorkerRole[]; n: number; client?: string; loc?: string }[] = [
    { roles: ["driver"], n: 22, client: "cli-americana" },
    { roles: ["driver"], n: 10, client: "cli-talabat" },
    { roles: ["warehouse"], n: 8, client: "cli-alshaya", loc: "loc-s1" },
    { roles: ["picker"], n: 4, client: "cli-alshaya", loc: "loc-s1" },
    { roles: ["barista"], n: 5, client: "cli-bean", loc: "loc-s2" },
    { roles: ["security"], n: 2, client: "cli-alshaya", loc: "loc-s1" },
    { roles: ["driver"], n: 4 }, // bench
    { roles: ["handover"], n: 2 },
    { roles: ["service"], n: 1 },
  ];
  let i = 0;
  for (const g of plan) {
    for (let k = 0; k < g.n; k++) {
      i++;
      const f = pick(first), l = pick(last);
      const statuses: WorkerStatus[] = ["active", "active", "active", "active", "active", "active", "probation", "sick_leave", "annual_leave", "training"];
      const isDriver = g.roles.includes("driver");
      out.push({
        id: `wrk-${String(i).padStart(4, "0")}`,
        username: `${f.toLowerCase()}.${l.toLowerCase()}-${String(i).padStart(4, "0")}`,
        name: `${f} ${l}`,
        nationality: pick(nat),
        roles: g.roles,
        status: g.client || g.roles.includes("handover") ? pick(statuses) : "standby",
        employingCompany: "cmp-ithc",
        joiningDate: addDays(TODAY, -Math.floor(rnd() * 600) - 20),
        phone: `+965 6${String(Math.floor(rnd() * 9_000_000) + 1_000_000)}`,
        civilId: rnd() > 0.1 ? `29${String(Math.floor(rnd() * 1e10)).padStart(10, "0")}` : undefined,
        passportNo: `P${String(Math.floor(rnd() * 1e7)).padStart(7, "0")}`,
        licenceNo: isDriver ? `DL${String(Math.floor(rnd() * 1e6)).padStart(6, "0")}` : undefined,
        riderId: isDriver && g.client === "cli-talabat" ? `TLB-${1000 + i}` : undefined,
        vehicleTypes: isDriver ? (rnd() > 0.4 ? ["car"] : ["bike"]) : undefined,
        baseSalary: 180_000 + Math.floor(rnd() * 5) * 10_000,
        overtimeComponent: isDriver ? 40_000 : 0,
        currentClientId: g.client,
        currentLocationId: g.loc,
        housingLocationId: pick(["loc-h1", "loc-h2", "loc-h3"]),
        batch: g.client === "cli-talabat" ? pick(["Batch 1", "Batch 2", "Batch 3"]) : undefined,
        version: 1,
      });
    }
  }
  return out;
};

export const seedVehicles = (): Vehicle[] => {
  s = 777;
  const makes: [string, string, "car" | "bike"][] = [["Toyota", "Yaris", "car"], ["Nissan", "Sunny", "car"], ["Kia", "Picanto", "car"], ["Honda", "CB125", "bike"], ["Yamaha", "YBR125", "bike"]];
  const out: Vehicle[] = [];
  for (let i = 1; i <= 24; i++) {
    const [make, model, type] = pick(makes);
    const ownership = pick(["rented", "rented", "cash", "financed"] as const);
    out.push({
      id: `veh-${String(i).padStart(4, "0")}`,
      plate: `${Math.floor(rnd() * 90 + 10)}/${String(Math.floor(rnd() * 90000) + 10000)}`,
      type, make, model, year: 2022 + Math.floor(rnd() * 4), ownership,
      mode: type === "bike" ? "dedicated" : "pooled",
      homeLocationId: i % 2 ? "loc-desk1" : "loc-desk2",
      status: i === 7 ? "under_repair" : "in_service",
      monthlyCost: type === "bike" ? 55_000 : ownership === "rented" ? 135_000 : ownership === "financed" ? 160_000 : 95_000,
      odometerKm: 8_000 + Math.floor(rnd() * 70_000),
      lessor: ownership === "rented" ? pick(["Max Dash", "Swift Link"]) : undefined,
      version: 1,
    });
  }
  out.push({ id: "veh-0025", plate: "TR/20431", type: "transport", make: "Toyota", model: "Hiace", year: 2023, ownership: "rented", mode: "transport", homeLocationId: "loc-hq", status: "in_service", monthlyCost: 320_000, odometerKm: 41_000, lessor: "Swift Link", version: 1 });
  return out;
};
