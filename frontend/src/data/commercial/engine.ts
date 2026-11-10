import type { Contract, PricingModel, RateLine } from "../entities";
import type { BizDate } from "@/lib/dates";
import type { Fils } from "@/lib/money";
import type { RevenueTx } from "./types";

/**
 * Configuration-driven revenue engine. There is no per-contract-type calculator: a transaction is
 * priced by looking up the contract version in force on its date and applying that version's rate
 * lines. Only two key conventions exist, both visible in the rate-line editor:
 *   - a key ending in _car / _bike applies only to that vehicle type
 *   - a key ending in _b<N> applies only to batch N
 * Marketplace-batched contracts apply every rate line that matches the event (fees stack);
 * all other models price the one rate line named by the transaction.
 */
export function versionFor(all: Contract[], contractNo: string, date: BizDate): Contract | undefined {
  return all
    .filter((c) => c.contractNo === contractNo && c.validFrom <= date && (c.validTo === null || c.validTo >= date))
    .sort((a, b) => b.version - a.version)[0];
}

export const latestVersion = (all: Contract[], contractNo: string) =>
  all.filter((c) => c.contractNo === contractNo).sort((a, b) => b.version - a.version)[0];

export const batchNo = (batch?: string) => /(\d+)/.exec(batch ?? "")?.[1];

export function lineApplies(line: RateLine, ev: { vehicleType?: string; batch?: string }): boolean {
  const v = /_(car|bike)$/.exec(line.key);
  if (v && v[1] !== ev.vehicleType) return false;
  const b = /_b(\d+)$/.exec(line.key);
  if (b && b[1] !== batchNo(ev.batch)) return false;
  return true;
}

export interface PricedLine { key: string; label: string; qty: number; unitAmount: Fils; amount: Fils }
export interface Priced { amount: Fils; contract?: Contract; lines: PricedLine[] }

export function priceEvent(
  all: Contract[],
  ev: { contractNo: string; date: BizDate; qty: number; lineKey?: string; vehicleType?: string; batch?: string },
): Priced {
  const contract = versionFor(all, ev.contractNo, ev.date);
  if (!contract) return { amount: 0, lines: [] };
  const batched = contract.pricingModel === "marketplace_batched" && !ev.lineKey;
  const used = batched ? contract.rates.filter((l) => lineApplies(l, ev)) : contract.rates.filter((l) => l.key === ev.lineKey);
  const lines = used.map((l) => ({ key: l.key, label: l.label, qty: ev.qty, unitAmount: l.amount, amount: Math.round(ev.qty * l.amount) }));
  return { amount: lines.reduce((s, l) => s + l.amount, 0), contract, lines };
}

export const priceTx = (all: Contract[], tx: RevenueTx) => priceEvent(all, tx);

export interface PricedTx { tx: RevenueTx; priced: Priced; clientId?: string }

export function priceAll(all: Contract[], txs: RevenueTx[]): PricedTx[] {
  return txs.map((tx) => {
    const priced = priceTx(all, tx);
    return { tx, priced, clientId: priced.contract?.clientId ?? all.find((c) => c.contractNo === tx.contractNo)?.clientId };
  });
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Revenue by client for a month ("YYYY-MM"). */
export function revenueByClient(priced: PricedTx[], month: string): Map<string, Fils> {
  const m = new Map<string, Fils>();
  for (const p of priced) {
    if (!p.tx.date.startsWith(month) || !p.clientId) continue;
    m.set(p.clientId, (m.get(p.clientId) ?? 0) + p.priced.amount);
  }
  return m;
}
export function revenueByContractNo(priced: PricedTx[], month: string): Map<string, Fils> {
  const m = new Map<string, Fils>();
  for (const p of priced) {
    if (!p.tx.date.startsWith(month)) continue;
    m.set(p.tx.contractNo, (m.get(p.tx.contractNo) ?? 0) + p.priced.amount);
  }
  return m;
}

/** Starting rate lines when a new contract is created; fully editable afterwards. */
export function defaultRates(model: PricingModel): RateLine[] {
  switch (model) {
    case "order_based": return [{ key: "car", label: "Per order — car", unit: "order", amount: 1_000 }, { key: "bike", label: "Per order — bike", unit: "order", amount: 800 }];
    case "fixed_labour": return [{ key: "monthly", label: "Monthly fee per head", unit: "head/month", amount: 285_000 }];
    case "hourly": return [{ key: "hour", label: "Per hour", unit: "hour", amount: 1_650 }];
    case "bulk": return [{ key: "bulk", label: "Per parcel (single pickup)", unit: "parcel", amount: 700 }];
    case "marketplace_batched": return [{ key: "admin_fee", label: "Administrative fee", unit: "event", amount: 300 }, { key: "ops_fee", label: "Operational fee", unit: "event", amount: 450 }, { key: "ach_b1", label: "Achievement fee — batch 1", unit: "event", amount: 250 }];
  }
}
export const MODEL_LABEL: Record<PricingModel, string> = {
  order_based: "Order-based",
  fixed_labour: "Fixed labour",
  hourly: "Hourly",
  bulk: "Bulk / single pickup",
  marketplace_batched: "Marketplace batched",
};
