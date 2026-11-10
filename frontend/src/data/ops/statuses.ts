import { TODAY, type BizDate } from "@/lib/dates";
import type { Worker } from "../entities";
import { daysInRangeForMonth } from "./dates";
import type { StatusDays } from "./payroll-engine";
import type { StatusKey, StatusSegment } from "./types";

export const STATUS_KEYS: StatusKey[] = ["active", "training", "probation", "accommodation", "sick_leave", "annual_leave", "standby", "inactive", "blocked", "absconded", "terminated"];
export const STATUS_LABEL: Record<StatusKey, string> = {
  active: "Active", training: "Training", probation: "Probation", accommodation: "Accommodation", sick_leave: "Sick leave", annual_leave: "Annual leave",
  standby: "Standby", inactive: "Inactive", blocked: "Blocked", absconded: "Absconded", terminated: "Terminated",
};
export const STATUS_COLOR: Record<StatusKey, string> = {
  active: "bg-emerald-500", training: "bg-sky-500", probation: "bg-amber-500", accommodation: "bg-violet-500", sick_leave: "bg-orange-500",
  annual_leave: "bg-teal-500", standby: "bg-slate-400", inactive: "bg-zinc-400", blocked: "bg-red-600", absconded: "bg-red-800", terminated: "bg-neutral-700",
};
/** Statuses that stop a person being given work. */
export const NO_WORK: StatusKey[] = ["blocked", "terminated", "absconded", "inactive"];

export function segmentOn(segs: StatusSegment[], workerId: string, date: BizDate): StatusSegment | undefined {
  return segs
    .filter((s) => s.workerId === workerId && s.from <= date && (s.to === null || s.to >= date))
    .sort((a, b) => b.from.localeCompare(a.from))[0];
}
export const statusOn = (segs: StatusSegment[], w: Worker, date: BizDate = TODAY): StatusKey =>
  (segmentOn(segs, w.id, date)?.status ?? (w.status as StatusKey));
export const isBlockedOn = (segs: StatusSegment[], w: Worker, date: BizDate = TODAY) => NO_WORK.includes(statusOn(segs, w, date));

/** Days per status (and accommodation reason) inside a month; statuses are additive. */
export function segmentDays(segs: StatusSegment[], workerId: string, month: string): StatusDays[] {
  const acc = new Map<string, StatusDays>();
  for (const s of segs) {
    if (s.workerId !== workerId) continue;
    const d = daysInRangeForMonth(s.from, s.to, month);
    if (!d) continue;
    const key = `${s.status}|${s.reason ?? ""}`;
    const cur = acc.get(key);
    if (cur) cur.days += d;
    else acc.set(key, { status: s.status, days: d, reason: s.reason });
  }
  return [...acc.values()];
}

/** Segments of the same worker whose date ranges overlap the candidate (would double count days). */
export function overlappingSegments(segs: StatusSegment[], c: Pick<StatusSegment, "id" | "workerId" | "from" | "to">) {
  return segs.filter((s) => s.workerId === c.workerId && s.id !== c.id && s.from <= (c.to ?? "9999-12-31") && c.from <= (s.to ?? "9999-12-31"));
}
