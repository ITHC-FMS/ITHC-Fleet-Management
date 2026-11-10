import { formatKD } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { monthLabel } from "@/data/ops/dates";
import { payslipLines } from "@/data/ops/payslip";
import type { PayrollEntry } from "@/data/ops/types";
import { csvOf, downloadFile } from "./shared";

type NameOf = (id: string) => string;
const kd = (n: number) => formatKD(n, { symbol: false });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const HEAD = ["Driver", "Worker ID", "Transition", "Paid days", "Base pay", "Excess pay", "Food", "Accommodation", "Incentive", "Marketplace bonus", "Gross", "Deductions", "Marketplace shortfall", "Net"];
const rowOf = (e: PayrollEntry, name: NameOf) => [name(e.workerId), e.workerId, e.transition ?? "", e.result.paidDays, kd(e.result.basePay), kd(e.result.excessPay), kd(e.result.food), kd(e.result.accommodation), kd(e.result.incentive), kd(e.result.marketplaceBonus), kd(e.result.gross), kd(e.result.deductionTotal), kd(e.result.marketplaceShortfall), kd(e.result.net)];

/** Excel opens an HTML table saved as .xls. */
export function exportExcel(month: string, entries: PayrollEntry[], name: NameOf, company: string) {
  const body = entries.map((e) => `<tr>${rowOf(e, name).map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`).join("");
  const html = `<html><head><meta charset="utf-8"></head><body><h3>${esc(company)} — Payroll ${monthLabel(month)}</h3><table border="1"><tr>${HEAD.map((h) => `<th>${h}</th>`).join("")}</tr>${body}</table></body></html>`;
  downloadFile(`payroll-${month}.xls`, html, "application/vnd.ms-excel");
}
export const exportCsv = (month: string, entries: PayrollEntry[], name: NameOf) => downloadFile(`payroll-${month}-accounting.csv`, csvOf([HEAD, ...entries.map((e) => rowOf(e, name))]));
export function exportJson(month: string, entries: PayrollEntry[], name: NameOf) {
  const data = entries.map((e) => ({ workerId: e.workerId, driver: name(e.workerId), month, transition: e.transition, components: Object.fromEntries(Object.entries({ basePay: e.result.basePay, excessPay: e.result.excessPay, food: e.result.food, accommodation: e.result.accommodation, incentive: e.result.incentive, marketplaceBonus: e.result.marketplaceBonus, marketplaceShortfall: e.result.marketplaceShortfall })), deductions: e.input.deductions, gross: e.result.gross, net: e.result.net, currency: "KWD", unit: "fils" }));
  downloadFile(`payroll-${month}-accounting.json`, JSON.stringify(data, null, 2), "application/json");
}

/** Letterhead payslips as a printable page; "Save as PDF" in the browser print dialog. */
export function printPayslips(month: string, entries: PayrollEntry[], name: NameOf, company: string) {
  const slips = entries.map((e) => {
    const s = payslipLines(e);
    const row = (l: { label: string; amount: number; note: string }) => `<tr><td>${esc(l.label)}<div class="n">${esc(l.note)}</div></td><td class="r">${kd(l.amount)}</td></tr>`;
    return `<section><div class="lh"><b>${esc(company)}</b><span>Payslip — ${monthLabel(month)}</span></div>
      <p><b>${esc(name(e.workerId))}</b> (${e.workerId})${e.transition ? ` <span class="t">TRANSITION: ${esc(e.transition)}</span>` : ""}</p>
      <table><tr><th>Earnings</th><th class="r">KD</th></tr>${s.earnings.map(row).join("")}<tr class="tot"><td>Gross</td><td class="r">${kd(s.gross)}</td></tr>
      <tr><th>Deductions</th><th class="r">KD</th></tr>${s.deductions.filter((d) => d.amount).map(row).join("") || '<tr><td colspan="2">None</td></tr>'}<tr class="tot"><td>Total deductions</td><td class="r">${kd(s.totalDeductions)}</td></tr>
      <tr class="tot net"><td>Net pay</td><td class="r">${kd(s.net)}</td></tr></table>
      <p class="n">Computed ${fmtDate("2026-11-09")}. No payment disbursement, WPS, PIFSS or indemnity calculation is included.</p></section>`;
  });
  const html = `<html><head><title>Payslips ${month}</title><style>body{font:13px sans-serif}section{page-break-after:always;padding:24px;max-width:640px}.lh{display:flex;justify-content:space-between;border-bottom:3px solid #1f3a5f;padding-bottom:8px;margin-bottom:12px}table{width:100%;border-collapse:collapse}td,th{padding:4px 6px;border-bottom:1px solid #ddd;text-align:left}.r{text-align:right}.n{font-size:11px;color:#666}.tot td{font-weight:bold}.net td{font-size:15px}.t{background:#fde68a;padding:1px 6px;border-radius:4px;font-size:11px}</style></head><body>${slips.join("")}</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
