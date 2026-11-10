"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/app/form-sheet";
import { StatusBadge } from "@/components/app/status-badge";
import { payslipLines } from "@/data/ops/payslip";
import { monthLabel } from "@/data/ops/dates";
import type { PayrollEntry } from "@/data/ops/types";
import { formatKD } from "@/lib/money";
import { printPayslips } from "./payroll-exports";

export function PayslipSheet({ entry, month, name, company, onClose }: { entry: PayrollEntry | null; month: string; name: string; company: string; onClose: () => void }) {
  const s = entry ? payslipLines(entry) : null;
  return (
    <FormSheet open={!!entry} onOpenChange={(o) => !o && onClose()} title={`Payslip: ${name}`} description={`${company} · ${monthLabel(month)}`} wide hideSubmit>
      {entry && s && (
        <div className="space-y-4 text-sm">
          {entry.transition && <StatusBadge tone="warn">Transition: {entry.transition}</StatusBadge>}
          {entry.placed && <StatusBadge tone="info">Placed labour: no orders, no vehicle, order-based components are zero</StatusBadge>}
          <table className="w-full">
            <thead><tr className="border-b text-start"><th className="py-1 text-start">Earnings</th><th className="py-1 text-end">KD</th></tr></thead>
            <tbody>
              {s.earnings.map((l) => (
                <tr key={l.key} className="border-b align-top">
                  <td className="py-1.5">{l.label}<div className="text-xs text-muted-foreground">{l.note}</div></td>
                  <td className="py-1.5 text-end tabular-nums">{formatKD(l.amount, { symbol: false })}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">Gross</td><td className="py-1.5 text-end tabular-nums">{formatKD(s.gross, { symbol: false })}</td></tr>
            </tbody>
            <thead><tr className="border-b text-start"><th className="pt-3 text-start">Deductions</th><th className="pt-3 text-end">KD</th></tr></thead>
            <tbody>
              {s.deductions.filter((d) => d.amount).length === 0 && <tr><td className="py-1.5 text-muted-foreground">No deductions</td><td className="text-end">0.000</td></tr>}
              {s.deductions.filter((d) => d.amount).map((l) => (
                <tr key={l.key} className="border-b align-top">
                  <td className="py-1.5">{l.label}<div className="text-xs text-muted-foreground">{l.note}</div></td>
                  <td className="py-1.5 text-end tabular-nums">{formatKD(l.amount, { symbol: false })}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">Total deductions</td><td className="py-1.5 text-end tabular-nums">{formatKD(s.totalDeductions, { symbol: false })}</td></tr>
              <tr className="text-base font-semibold"><td className="py-2">Net pay</td><td className="py-2 text-end tabular-nums">{formatKD(s.net)}</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">Daily rate {formatKD(entry.result.dailyRate, { symbol: false })} KD · paid days {entry.result.paidDays} · days in month {entry.input.daysInMonth}.</p>
          <Button variant="outline" size="sm" onClick={() => printPayslips(month, [entry], () => name, company)}><Printer /> Print / save as PDF</Button>
        </div>
      )}
    </FormSheet>
  );
}
