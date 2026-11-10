import { addDays, type BizDate } from "@/lib/dates";

export const monthStart = (m: string): BizDate => `${m}-01`;
export const daysInMonth = (m: string): number => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};
export const monthEnd = (m: string): BizDate => `${m}-${String(daysInMonth(m)).padStart(2, "0")}`;
export const prevMonth = (m: string): string => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 2, 1));
  return d.toISOString().slice(0, 7);
};
export const nextMonth = (m: string): string => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
};
export const monthLabel = (m: string): string => {
  const [y, mo] = m.split("-");
  return `${["January","February","March","April","May","June","July","August","September","October","November","December"][Number(mo) - 1]} ${y}`;
};
/** Monday of the week containing d. */
export const weekStartOf = (d: BizDate): BizDate => {
  const dow = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon=0
  return addDays(d, -dow);
};
export const dowOf = (d: BizDate) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const eachDay = (from: BizDate, to: BizDate): BizDate[] => {
  const out: BizDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
/** Days of [from,to] (to null = open) that fall in the month, inclusive. */
export const daysInRangeForMonth = (from: BizDate, to: BizDate | null, m: string): number => {
  const a = from > monthStart(m) ? from : monthStart(m);
  const b = to && to < monthEnd(m) ? to : monthEnd(m);
  if (a > b) return 0;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
};
export const timeToMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
