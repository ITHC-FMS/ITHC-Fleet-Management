"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/status-badge";
import { withDeductions } from "@/data/ops/payroll-run";
import type { EntryDeduction, PayConfigItem, PayrollEntry } from "@/data/ops/types";
import { formatKD, parseKD } from "@/lib/money";
import { cn } from "@/lib/utils";

const kd = (n: number) => formatKD(n, { symbol: false });
const th = "whitespace-nowrap px-2 py-2 font-medium text-end";

function AmountInput({ value, onCommit, disabled }: { value: number; onCommit: (v: number) => void; disabled?: boolean }) {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <Input
      disabled={disabled} className="h-8 w-28 text-end tabular-nums" inputMode="decimal"
      value={txt ?? kd(value)} onFocus={(e) => { setTxt(String(value / 1000)); e.target.select(); }}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => { if (txt !== null) { const v = parseKD(txt); if (Number.isFinite(v) && v >= 0 && v !== value) onCommit(v); } setTxt(null); }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function DeductionEditor({ entry, types, onChange, editable }: { entry: PayrollEntry; types: PayConfigItem[]; onChange: (e: PayrollEntry) => void; editable: boolean }) {
  const [type, setType] = useState(types[0]?.key ?? "other");
  const [label, setLabel] = useState("");
  const [amt, setAmt] = useState("");
  const lines = entry.input.deductions;
  const apply = (next: EntryDeduction[]) => onChange(withDeductions(entry, next));
  const add = () => {
    const v = parseKD(amt);
    if (!Number.isFinite(v) || v <= 0) return;
    apply([...lines, { type, label: label.trim() || types.find((t) => t.key === type)?.label || type, amount: v, manual: true }]);
    setLabel(""); setAmt("");
  };
  return (
    <div className="space-y-2 p-3">
      <p className="text-xs text-muted-foreground">Deductions for this driver this period. Instalment lines come from advances and fine plans; manual lines are one-off. Changes recompute the entry immediately.</p>
      {lines.length === 0 && <p className="text-sm text-muted-foreground">No deductions.</p>}
      {lines.map((d, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge>{d.type.replace(/_/g, " ")}</StatusBadge>
          <span className="min-w-48 flex-1">{d.label}{d.planId ? <span className="ms-2 text-xs text-muted-foreground">instalment ({d.planId})</span> : null}</span>
          <AmountInput value={d.amount} disabled={!editable} onCommit={(v) => apply(lines.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
          {editable && <Button variant="ghost" size="icon-sm" aria-label="Remove deduction" onClick={() => apply(lines.filter((_, j) => j !== i))}><Trash2 /></Button>}
        </div>
      ))}
      {editable && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2">
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-44">{types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Description" className="w-56" />
          <Input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="KD" inputMode="decimal" className="w-24 text-end" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
          <Button size="sm" variant="outline" onClick={add}><Plus /> Add</Button>
        </div>
      )}
    </div>
  );
}

export function PayrollTable({ entries, nameOf, editable, types, onChange, onPayslip }: {
  entries: PayrollEntry[]; nameOf: (id: string) => string; editable: boolean; types: PayConfigItem[];
  onChange: (e: PayrollEntry) => void; onPayslip: (e: PayrollEntry) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const tot = entries.reduce((a, e) => ({ gross: a.gross + e.result.gross, ded: a.ded + e.result.deductionTotal, short: a.short + e.result.marketplaceShortfall, net: a.net + e.result.net }), { gross: 0, ded: 0, short: 0, net: 0 });
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="w-8" />
            <th className="px-2 py-2 text-start font-medium">Driver</th>
            <th className={th}>Paid days</th><th className={th}>Base</th><th className={th}>Excess</th><th className={th}>Food</th><th className={th}>Accomm.</th>
            <th className={th}>Incentive</th><th className={th}>Mkt bonus</th><th className={th}>Gross</th><th className={th}>Deductions</th><th className={th}>Mkt shortfall</th><th className={th}>Net (KD)</th>
            <th className="px-2 py-2 text-start font-medium">Flags</th><th />
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && <tr><td colSpan={15} className="px-3 py-10 text-center text-muted-foreground">No entries.</td></tr>}
          {entries.map((e) => {
            const r = e.result, isOpen = open === e.id;
            return (
              <Fragment key={e.id}>
                <tr className={cn("border-t", r.net < 0 && "bg-red-50")}>
                  <td className="ps-2"><button type="button" aria-label="Adjust deductions" onClick={() => setOpen(isOpen ? null : e.id)}>{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button></td>
                  <td className="px-2 py-1.5 font-medium">{nameOf(e.workerId)}</td>
                  <td className="px-2 text-end tabular-nums">{r.paidDays}</td>
                  <td className="px-2 text-end tabular-nums">{kd(r.basePay)}</td>
                  <td className="px-2 text-end tabular-nums">{kd(r.excessPay)}</td>
                  <td className="px-2 text-end tabular-nums">{kd(r.food)}</td>
                  <td className="px-2 text-end tabular-nums">{kd(r.accommodation)}</td>
                  <td className={cn("px-2 text-end tabular-nums", r.incentive < 0 && "text-red-600")}>{kd(r.incentive)}</td>
                  <td className="px-2 text-end tabular-nums">{kd(r.marketplaceBonus)}</td>
                  <td className="px-2 text-end tabular-nums font-medium">{kd(r.gross)}</td>
                  <td className="px-2 text-end"><button type="button" className="tabular-nums underline decoration-dotted" onClick={() => setOpen(isOpen ? null : e.id)}>{kd(r.deductionTotal)}</button></td>
                  <td className="px-2 text-end tabular-nums">{kd(r.marketplaceShortfall)}</td>
                  <td className="px-2 text-end tabular-nums font-semibold">{kd(r.net)}</td>
                  <td className="px-2"><span className="flex gap-1">{e.transition && <StatusBadge tone="warn">Transition</StatusBadge>}{e.placed && <StatusBadge tone="info">Placed</StatusBadge>}{r.net < 0 && <StatusBadge tone="bad">Negative</StatusBadge>}{r.flags.filter((f) => !f.startsWith("Negative")).map((f) => <StatusBadge key={f} tone="bad">Check days</StatusBadge>)}</span></td>
                  <td className="pe-2"><Button variant="ghost" size="icon-sm" aria-label="Open payslip" onClick={() => onPayslip(e)}><FileText /></Button></td>
                </tr>
                {isOpen && <tr className="border-t bg-muted/20"><td /><td colSpan={14}><DeductionEditor entry={e} types={types} editable={editable} onChange={onChange} /></td></tr>}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot className="border-t bg-muted/40 font-semibold">
          <tr><td colSpan={9} className="px-2 py-2 text-end">Totals</td><td className="px-2 text-end tabular-nums">{kd(tot.gross)}</td><td className="px-2 text-end tabular-nums">{kd(tot.ded)}</td><td className="px-2 text-end tabular-nums">{kd(tot.short)}</td><td className="px-2 text-end tabular-nums">{kd(tot.net)}</td><td colSpan={2} /></tr>
        </tfoot>
      </table>
    </div>
  );
}
