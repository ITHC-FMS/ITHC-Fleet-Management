import type { Vehicle } from "../entities";
import type { FuelTx } from "./types";

export const TANK_L: Record<Vehicle["type"], number> = { car: 45, bike: 14, transport: 70 };
export interface FuelStat { vehicleId: string; fills: number; litres: number; cost: number; km: number; lPer100: number | null }
export interface FuelAnomaly { id: string; vehicleId: string; date: string; kind: "overfill" | "high_consumption" | "same_day_fills"; detail: string }

export function fuelStats(fuel: FuelTx[], vehicles: Vehicle[]): FuelStat[] {
  return vehicles.map((v) => {
    const tx = fuel.filter((f) => f.vehicleId === v.id).sort((a, b) => a.date.localeCompare(b.date));
    const litres = tx.reduce((a, f) => a + f.litres, 0);
    const km = tx.length > 1 ? tx[tx.length - 1].odometerKm - tx[0].odometerKm : 0;
    const used = litres - (tx.length ? tx[tx.length - 1].litres : 0); // last fill is not yet burnt
    return { vehicleId: v.id, fills: tx.length, litres, cost: tx.reduce((a, f) => a + f.cost, 0), km, lPer100: km > 0 ? (used / km) * 100 : null };
  });
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export function fuelAnomalies(fuel: FuelTx[], vehicles: Vehicle[]): FuelAnomaly[] {
  const out: FuelAnomaly[] = [];
  const byV = new Map(vehicles.map((v) => [v.id, v]));
  for (const f of fuel) {
    const v = byV.get(f.vehicleId);
    if (v && f.litres > TANK_L[v.type]) out.push({ id: `ov:${f.id}`, vehicleId: f.vehicleId, date: f.date, kind: "overfill", detail: `${f.litres.toFixed(1)} L exceeds ${TANK_L[v.type]} L tank` });
  }
  const seen = new Map<string, number>();
  for (const f of fuel) seen.set(`${f.vehicleId}|${f.date}`, (seen.get(`${f.vehicleId}|${f.date}`) ?? 0) + 1);
  for (const [k, n] of seen) if (n > 1) { const [vehicleId, date] = k.split("|"); out.push({ id: `sd:${k}`, vehicleId, date, kind: "same_day_fills", detail: `${n} fills on the same day` }); }
  const stats = fuelStats(fuel, vehicles).filter((s) => s.lPer100 !== null);
  for (const type of ["car", "bike", "transport"] as const) {
    const grp = stats.filter((s) => byV.get(s.vehicleId)?.type === type);
    const med = median(grp.map((s) => s.lPer100 as number));
    for (const s of grp) if (med > 0 && (s.lPer100 as number) > med * 1.3) out.push({ id: `hc:${s.vehicleId}`, vehicleId: s.vehicleId, date: "", kind: "high_consumption", detail: `${(s.lPer100 as number).toFixed(1)} L/100 km vs ${med.toFixed(1)} median for ${type}s` });
  }
  return out;
}
