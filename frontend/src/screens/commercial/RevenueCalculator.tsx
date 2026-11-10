"use client";

import { useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/app/fields";
import { contracts } from "@/data/core";
import { MODEL_LABEL, priceEvent, versionFor, batchNo } from "@/data/commercial/engine";
import { TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import { Card2, Money } from "./ui";

/** Rate-config-driven calculator: nothing here knows about contract types beyond the rate lines themselves. */
export function RevenueCalculator() {
  const all = contracts.useAll();
  const nos = [...new Set(all.map((c) => c.contractNo))];
  const [no, setNo] = useState(nos[0] ?? "");
  const [date, setDate] = useState(TODAY);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState("Batch 1");
  const [veh, setVeh] = useState<"car" | "bike">("car");

  const v = versionFor(all, no, date);
  const batched = v?.pricingModel === "marketplace_batched";
  const batches = useMemo(() => [...new Set((v?.rates ?? []).map((r) => /_b(\d+)$/.exec(r.key)?.[1]).filter(Boolean))].map((n) => `Batch ${n}`).concat("Batch 99 (no tier)"), [v]);

  const result = useMemo(() => {
    if (!v) return null;
    if (batched) return priceEvent(all, { contractNo: no, date, qty: Number(qty.__orders) || 0, batch: batchNo(batch) ? batch : "Batch 99", vehicleType: veh });
    const lines = v.rates.map((r) => {
      const q = Number(qty[r.key]) || 0;
      return { key: r.key, label: r.label, qty: q, unitAmount: r.amount, amount: Math.round(q * r.amount) };
    });
    return { amount: lines.reduce((s, l) => s + l.amount, 0), contract: v, lines };
  }, [v, batched, all, no, date, qty, batch, veh]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card2 className="space-y-3">
        <h3 className="text-sm font-semibold">Inputs</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contract"><Select value={no} onChange={(e) => setNo(e.target.value)}>{nos.map((n) => <option key={n}>{n}</option>)}</Select></Field>
          <Field label="Transaction date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {!v && <p className="text-sm text-amber-700">No contract version is in force for {no} on {date}; revenue would be zero.</p>}
        {v && <p className="text-sm text-muted-foreground">Version in force on {date}: <b>v{v.version}</b> ({MODEL_LABEL[v.pricingModel]}), valid {v.validFrom} to {v.validTo ?? "open"}.</p>}
        {v && batched && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Orders"><Input inputMode="numeric" value={qty.__orders ?? ""} onChange={(e) => setQty({ ...qty, __orders: e.target.value })} /></Field>
            <Field label="Batch (snapshot)"><Select value={batch} onChange={(e) => setBatch(e.target.value)}>{batches.map((b) => <option key={b}>{b}</option>)}</Select></Field>
            <Field label="Vehicle type"><Select value={veh} onChange={(e) => setVeh(e.target.value as "car" | "bike")}><option value="car">Car</option><option value="bike">Bike</option></Select></Field>
          </div>
        )}
        {v && !batched && (
          <div className="space-y-2">
            {v.rates.map((r) => (
              <Field key={r.key} label={`${r.label} (${formatKD(r.amount)} per ${r.unit})`}>
                <Input inputMode="decimal" placeholder={`Quantity in ${r.unit}s`} value={qty[r.key] ?? ""} onChange={(e) => setQty({ ...qty, [r.key]: e.target.value })} />
              </Field>
            ))}
          </div>
        )}
      </Card2>
      <Card2>
        <h3 className="mb-2 text-sm font-semibold">Computed revenue</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-start text-xs text-muted-foreground"><th className="text-start">Line</th><th className="text-end">Qty</th><th className="text-end">Rate</th><th className="text-end">Amount</th></tr></thead>
          <tbody>
            {result?.lines.map((l) => (
              <tr key={l.key} className="border-t"><td className="py-1">{l.label}</td><td className="text-end tabular-nums">{l.qty}</td><td className="text-end tabular-nums">{formatKD(l.unitAmount)}</td><td className="text-end tabular-nums">{formatKD(l.amount)}</td></tr>
            ))}
            <tr className="border-t font-semibold"><td className="py-1" colSpan={3}>Total</td><td className="text-end"><Money v={result?.amount ?? 0} /></td></tr>
          </tbody>
        </table>
        {batched && <p className="mt-2 text-xs text-muted-foreground">Fees stack: every rate line that matches the vehicle type and batch applies per order. A batch without an achievement line earns only the base fees.</p>}
      </Card2>
    </div>
  );
}
