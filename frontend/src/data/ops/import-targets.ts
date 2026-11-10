import type { Client, Vehicle, Worker } from "../entities";
import { parseKD } from "@/lib/money";
import type { FuelTx, Order, PayConfigItem } from "./types";

export type TargetKey = "drivers" | "vehicles" | "orders" | "deductions" | "fuel";
export interface FieldDef { key: string; label: string; required?: boolean; aliases: string[] }
export interface ImportCtx { workers: Worker[]; vehicles: Vehicle[]; clients: Client[]; orders: Order[]; fuel: FuelTx[]; deductionTypes: PayConfigItem[] }
export interface RowResult { errors: string[]; rec?: Record<string, unknown> }
type Row = Record<string, string>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const guessColumn = (field: FieldDef, headers: string[]): number => {
  const names = [field.key, field.label, ...field.aliases].map(norm);
  return headers.findIndex((h) => names.includes(norm(h)));
};
export function parseDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}
const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);
const num = (s: string) => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : NaN);
const findWorker = (ctx: ImportCtx, key: string) => { const k = key.trim().toLowerCase(); return ctx.workers.find((w) => w.name.toLowerCase() === k || w.username.toLowerCase() === k || w.riderId?.toLowerCase() === k); };

export const TARGETS: Record<TargetKey, { label: string; fields: FieldDef[]; validate: (r: Row, ctx: ImportCtx, seen: Set<string>) => RowResult; sample: (ctx: ImportCtx) => string }> = {
  drivers: {
    label: "Drivers",
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["driver name", "full name", "employee"] },
      { key: "nationality", label: "Nationality", aliases: ["country"] }, { key: "phone", label: "Phone", aliases: ["mobile", "whatsapp"] },
      { key: "civilId", label: "Civil ID", aliases: ["civil no"] }, { key: "passportNo", label: "Passport", aliases: ["passport no"] },
      { key: "licenceNo", label: "Licence", aliases: ["license", "driving licence"] }, { key: "riderId", label: "Rider ID", aliases: ["platform id", "talabat id"] },
      { key: "vehicleType", label: "Vehicle type", aliases: ["type", "car/bike"] }, { key: "baseSalary", label: "Base salary (KD)", aliases: ["salary", "basic"] },
      { key: "overtime", label: "Overtime (KD)", aliases: ["ot"] }, { key: "joiningDate", label: "Joining date", aliases: ["joined", "start date"] },
    ],
    validate: (r, ctx, seen) => {
      const e: string[] = [];
      if (!r.name?.trim()) e.push("Name is required");
      const key = `${r.name?.toLowerCase()}|${r.phone}`;
      if (seen.has(key) || ctx.workers.some((w) => w.name.toLowerCase() === r.name?.toLowerCase() && w.phone === r.phone)) e.push("Duplicate worker (same name and phone)");
      seen.add(key);
      const base = r.baseSalary ? parseKD(r.baseSalary) : 180_000, ot = r.overtime ? parseKD(r.overtime) : 40_000;
      if (!Number.isFinite(base) || !Number.isFinite(ot)) e.push("Salary or overtime is not a number");
      const jd = r.joiningDate ? parseDate(r.joiningDate) : "2026-11-09";
      if (!jd) e.push("Joining date is not a valid date");
      const vt = (r.vehicleType || "car").toLowerCase();
      if (vt !== "car" && vt !== "bike") e.push("Vehicle type must be car or bike");
      return { errors: e, rec: e.length ? undefined : { ...r, base, ot, jd, vt } };
    },
    sample: () => ["Driver Name,Nationality,Mobile,Civil No,Licence,Platform ID,Car/Bike,Salary,OT,Joined", ...Array.from({ length: 260 }, (_, i) => `Imported Driver ${i + 1},${["Nepal", "India", "Kenya"][i % 3]},+965 6${String(2_000_000 + i * 37)},${i % 11 === 0 ? "" : `29${String(1e9 + i * 977).slice(0, 10)}`},DL${900000 + i},${i % 4 === 0 ? `TLB-${5000 + i}` : ""},${i % 3 ? "car" : "bike"},${190 + (i % 4) * 10}.000,40.000,${i % 5 === 0 ? "02/11/2026" : "2026-11-02"}`), "Imported Driver 3,Kenya,+965 6xyz,,DL1,,truck,abc,40.000,31/31/2026"].join("\n"),
  },
  vehicles: {
    label: "Vehicles",
    fields: [
      { key: "plate", label: "Plate", required: true, aliases: ["registration", "reg no"] }, { key: "type", label: "Type", required: true, aliases: ["vehicle type"] },
      { key: "make", label: "Make", required: true, aliases: ["brand"] }, { key: "model", label: "Model", aliases: [] }, { key: "year", label: "Year", aliases: [] },
      { key: "ownership", label: "Ownership", aliases: ["ownership type"] }, { key: "monthlyCost", label: "Monthly cost (KD)", aliases: ["cost", "rent"] }, { key: "odometer", label: "Odometer (km)", aliases: ["km", "mileage"] },
    ],
    validate: (r, ctx, seen) => {
      const e: string[] = [];
      if (!r.plate?.trim()) e.push("Plate is required");
      else if (seen.has(r.plate) || ctx.vehicles.some((v) => v.plate === r.plate)) e.push("Plate already exists");
      seen.add(r.plate ?? "");
      if (!["car", "bike", "transport"].includes((r.type ?? "").toLowerCase())) e.push("Type must be car, bike or transport");
      if (!r.make?.trim()) e.push("Make is required");
      const own = (r.ownership || "rented").toLowerCase();
      if (!["rented", "cash", "financed"].includes(own)) e.push("Ownership must be rented, cash or financed");
      const cost = r.monthlyCost ? parseKD(r.monthlyCost) : 135_000;
      if (!Number.isFinite(cost)) e.push("Monthly cost is not a number");
      return { errors: e, rec: e.length ? undefined : { ...r, own, cost } };
    },
    sample: () => ["Reg No,Vehicle Type,Brand,Model,Year,Ownership Type,Rent,KM", ...Array.from({ length: 12 }, (_, i) => `NEW/${60000 + i},${i % 3 ? "car" : "bike"},Toyota,Yaris,2025,rented,135.000,${1000 * i}`), "NEW/60000,car,Kia,Rio,2024,rented,130.000,500", "NEW/70000,boat,Kia,Rio,2024,leased,130.000,500"].join("\n"),
  },
  orders: {
    label: "Orders (historical)",
    fields: [
      { key: "date", label: "Date", required: true, aliases: ["day", "order date"] }, { key: "driver", label: "Driver", required: true, aliases: ["rider", "driver name", "rider id"] },
      { key: "client", label: "Client", aliases: ["customer", "platform"] }, { key: "place", label: "Store / zone", aliases: ["store", "zone", "branch"] },
      { key: "orders", label: "Orders", aliases: ["no of orders", "order count", "count"] }, { key: "pickups", label: "Pickups", aliases: ["pickup"] }, { key: "dropoffs", label: "Dropoffs", aliases: ["dropoff", "deliveries"] },
    ],
    validate: (r, ctx, seen) => {
      const e: string[] = [];
      const date = parseDate(r.date ?? "");
      if (!date) e.push("Date is not valid");
      const w = findWorker(ctx, r.driver ?? "");
      if (!w) e.push(`Driver "${r.driver}" not found`);
      const client = r.client ? ctx.clients.find((c) => c.name.toLowerCase() === r.client.toLowerCase()) : ctx.clients.find((c) => c.id === w?.currentClientId);
      if (!client) e.push("Client not found");
      const marketplace = client?.model.toLowerCase().includes("marketplace");
      if (marketplace) { if (Number.isNaN(int(r.pickups ?? "")) || Number.isNaN(int(r.dropoffs ?? ""))) e.push("Marketplace orders need whole-number pickups and dropoffs"); }
      else if (Number.isNaN(int(r.orders ?? ""))) e.push("Order count must be a whole number");
      const key = `${w?.id}|${date}|${client?.id}`;
      if (seen.has(key) || ctx.orders.some((o) => o.workerId === w?.id && o.date === date && o.clientId === client?.id)) e.push("An order row already exists for this driver, client and date");
      seen.add(key);
      return { errors: e, rec: e.length ? undefined : { date, workerId: w!.id, clientId: client!.id, place: r.place || "", marketplace: !!marketplace, orders: int(r.orders ?? ""), pickups: int(r.pickups ?? ""), dropoffs: int(r.dropoffs ?? ""), batch: w!.batch ?? "Batch 3" } };
    },
    sample: (ctx) => {
      const am = ctx.workers.filter((w) => w.currentClientId === "cli-americana").slice(0, 3), tl = ctx.workers.filter((w) => w.currentClientId === "cli-talabat").slice(0, 2);
      return ["Date,Rider,Customer,Branch,No. of Orders,Pickups,Dropoffs", ...am.map((w, i) => `2026-08-${10 + i},${w.name},Americana,Salhiya Mall,${25 + i},,`), ...tl.map((w, i) => `15/08/2026,${w.riderId ?? w.name},Talabat,Zone Hawalli,,${20 + i},${19 + i}`), "2026-08-12,Nobody Known,Americana,Salhiya Mall,20,,", "2026-08-13,"+(am[0]?.name ?? "x")+",Americana,Salhiya Mall,many,,"].join("\n");
    },
  },
  deductions: {
    label: "Deductions",
    fields: [
      { key: "driver", label: "Driver", required: true, aliases: ["worker", "name", "employee"] }, { key: "kind", label: "Type", aliases: ["deduction type", "category"] }, { key: "description", label: "Description", aliases: ["reference", "notes"] },
      { key: "total", label: "Total (KD)", required: true, aliases: ["amount", "fine"] }, { key: "instalment", label: "Per period (KD)", aliases: ["instalment", "monthly"] }, { key: "startMonth", label: "Start month", aliases: ["from month"] },
    ],
    validate: (r, ctx) => {
      const e: string[] = [];
      const w = findWorker(ctx, r.driver ?? "");
      if (!w) e.push(`Worker "${r.driver}" not found`);
      const kind = (r.kind || "other").toLowerCase().replace(/\s+/g, "_");
      if (!ctx.deductionTypes.some((t) => t.key === kind)) e.push(`Unknown deduction type "${r.kind}"`);
      const total = parseKD(r.total ?? "");
      if (!Number.isFinite(total) || total <= 0) e.push("Total must be a positive KD amount");
      const inst = r.instalment ? parseKD(r.instalment) : total;
      if (!Number.isFinite(inst) || inst <= 0 || inst > total) e.push("Per-period amount must be positive and not above the total");
      return { errors: e, rec: e.length ? undefined : { workerId: w!.id, kind, description: r.description || kind, total, inst, startMonth: r.startMonth || "2026-11" } };
    },
    sample: (ctx) => ["Employee,Category,Reference,Fine,Monthly,From month", `${ctx.workers[0]?.name},traffic_fine,TF-1001,60.000,20.000,2026-11`, `${ctx.workers[1]?.name},equipment,Lost bag,25.000,12.500,2026-11`, `${ctx.workers[2]?.name},cod_shortfall,COD 3 Nov,9.500,9.500,2026-11`, "Ghost Driver,traffic_fine,TF-2,10.000,10.000,2026-11", `${ctx.workers[3]?.name},speeding,TF-3,abc,10,2026-11`].join("\n"),
  },
  fuel: {
    label: "Fuel",
    fields: [
      { key: "date", label: "Date", required: true, aliases: ["fill date"] }, { key: "plate", label: "Plate", required: true, aliases: ["vehicle", "registration"] }, { key: "driver", label: "Driver", aliases: ["rider"] },
      { key: "litres", label: "Litres", required: true, aliases: ["liters", "qty"] }, { key: "cost", label: "Cost (KD)", required: true, aliases: ["amount", "total"] }, { key: "odometer", label: "Odometer (km)", aliases: ["km"] },
    ],
    validate: (r, ctx) => {
      const e: string[] = [];
      const date = parseDate(r.date ?? "");
      if (!date) e.push("Date is not valid");
      const v = ctx.vehicles.find((x) => x.plate === r.plate?.trim());
      if (!v) e.push(`Vehicle ${r.plate} not found`);
      const litres = num(r.litres ?? ""), cost = parseKD(r.cost ?? "");
      if (!(litres > 0)) e.push("Litres must be a positive number");
      if (!Number.isFinite(cost) || cost <= 0) e.push("Cost must be a positive KD amount");
      return { errors: e, rec: e.length ? undefined : { date, vehicleId: v!.id, workerId: r.driver ? findWorker(ctx, r.driver)?.id : undefined, litres, cost, odometerKm: Number(r.odometer) || 0 } };
    },
    sample: (ctx) => ["Fill date,Vehicle,Rider,Qty,Amount,KM", ...ctx.vehicles.slice(0, 6).map((v, i) => `2026-11-0${(i % 8) + 1},${v.plate},,${25 + i}.5,${(25 + i) * 0.165},${v.odometerKm + 100 + i}`), `2026-11-04,ZZ/00000,,30,4.950,100`].join("\n"),
  },
};
