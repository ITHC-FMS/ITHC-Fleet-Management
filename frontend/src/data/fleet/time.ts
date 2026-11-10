import { addDays, fmtDate, TODAY, type BizDate } from "@/lib/dates";
import type { Stamp } from "./types";

export const dateOf = (s: Stamp): BizDate => s.slice(0, 10);
export const timeOf = (s: Stamp): string => s.slice(11, 16);
const ms = (s: Stamp) => Date.parse(`${s.length === 10 ? s + "T00:00" : s}:00Z`.replace("::", ":"));
export const hoursBetween = (a: Stamp, b: Stamp) => Math.max(0, (ms(b) - ms(a)) / 3_600_000);
export const minutesBetween = (a: Stamp, b: Stamp) => (ms(b) - ms(a)) / 60_000;
export const fmtStamp = (s?: Stamp) => (s ? `${fmtDate(dateOf(s))} ${timeOf(s)}` : "—");
export const mk = (d: BizDate, hhmm: string): Stamp => `${d}T${hhmm}`;
export const hhmm = (h: number, m = 0) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/** Demo clock: fixed business date, real time of day. Only call from event handlers or effects. */
export function nowStamp(): Stamp {
  const n = new Date();
  return mk(TODAY, hhmm(n.getHours(), n.getMinutes()));
}
export const addDaysTo = addDays;
