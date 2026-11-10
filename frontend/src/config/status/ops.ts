import { built, type StatusMap } from "./types";

const XLSX = "CSV, TSV and paste-from-Excel only; .xlsx workbooks are not parsed (no spreadsheet package available)";
const ATTENDANCE = "Derived from each worker's status timeline, not from site supervisor attendance records (supervisor module is a separate area)";
const WORKERS_RO = built();
const ASSIGN_RO = built();

/** Written by the ops agent: one entry per "<role>/<page>" it built. */
export const opsStatus: StatusMap = {
  "operations/home": built(),
  "operations/orders": built({
    6: `Historical order import works through the shared import wizard and a paste-from-Excel box on the grid. ${XLSX}`,
    8: "Intake decision is still pending: manual grid and CSV/paste are provided, API intake is not built",
  }),
  "operations/assignments": built(),
  "operations/schedule": built(),
  "operations/imports": built({
    0: XLSX,
    3: "The real operations workbook was not supplied; sample files mimic plausible headings and the column mapper auto-matches common names",
  }),
  "operations/reports": built({ 5: ATTENDANCE }),
  "operations/performance": built(),
  "operations/workers": WORKERS_RO,
  "payroll/home": built(),
  "payroll/payroll": built({
    12: "No reference figures were supplied; the engine is exact in integer fils and the self-check covers five hand-derived scenarios only",
    17: "PDF payslips open as a printable page (browser Save as PDF) and Excel is an HTML table saved as .xls; the letterhead is a text header, no logo or real template",
  }),
  "payroll/advances": built({ 4: `Deduction import uses the shared wizard. ${XLSX}` }),
  "payroll/pay-parameters": built(),
  "payroll/payroll-config": built({
    3: "Deduction types flow through advances, deductions and payroll with no code change; bonus types are stored but the engine only consumes its built-in bonus components",
  }),
  "hr/workers": built({
    14: "Blocked workers are refused on assignments, shifts and order rows in this area; other areas' screens do not check it",
    18: "Email delivery is simulated: the screen reports the temporary password as emailed but nothing is sent",
    20: "Show-once and per-view logging work; expiry of the temporary password is not modelled",
    24: "Email delivery is simulated: nothing is actually sent",
  }),
  "hr/offboarding": built(),
  "admin/workers": built(),
  "admin/assignments": ASSIGN_RO,
  "ceo/reports": built({ 6: ATTENDANCE }),
};
