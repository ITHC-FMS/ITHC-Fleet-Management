import { overlaps } from "@/lib/dates";
import { timeToMin } from "./dates";
import type { Assignment, Shift, ShiftPattern } from "./types";

export const shiftsClash = (a: ShiftPattern, b: ShiftPattern) => a === "full" || b === "full" || a === b;

export interface AssignmentConflict { kind: "driver" | "vehicle"; otherId: string; message: string }

/** Overlap detection for a date-ranged assignment (inclusive end dates). Detects, never auto-resolves. */
export function assignmentConflicts(list: Assignment[], c: Pick<Assignment, "id" | "workerId" | "vehicleId" | "from" | "to" | "shift" | "kind">): AssignmentConflict[] {
  const out: AssignmentConflict[] = [];
  for (const a of list) {
    if (a.id === c.id) continue;
    if (!overlaps(a.from, a.to, c.from, c.to) || !shiftsClash(a.shift, c.shift)) continue;
    if (a.workerId === c.workerId) out.push({ kind: "driver", otherId: a.id, message: `Same worker already assigned ${a.from} to ${a.to ?? "open"} (${a.shift})` });
    else if (c.vehicleId && a.vehicleId === c.vehicleId) out.push({ kind: "vehicle", otherId: a.id, message: `Vehicle also assigned to another worker in an overlapping window (${a.from} to ${a.to ?? "open"}, ${a.shift})` });
  }
  return out;
}

export interface ScheduleConflict { key: string; kind: "driver" | "vehicle"; date: string; subjectId: string; shiftIds: [string, string] }

const clash = (a: Shift, b: Shift) => timeToMin(a.plannedStart) < timeToMin(b.plannedEnd) && timeToMin(b.plannedStart) < timeToMin(a.plannedEnd);

/** Pairs of shifts on the same day overlapping in time for the same driver, or the same vehicle with different drivers. */
export function scheduleConflicts(shifts: Shift[]): ScheduleConflict[] {
  const byDate = new Map<string, Shift[]>();
  for (const s of shifts) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const out: ScheduleConflict[] = [];
  for (const [date, list] of byDate)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (!clash(a, b)) continue;
        const ids = [a.id, b.id].sort() as [string, string];
        if (a.workerId === b.workerId) out.push({ key: `d:${ids.join("|")}`, kind: "driver", date, subjectId: a.workerId, shiftIds: ids });
        else if (a.vehicleId && a.vehicleId === b.vehicleId) out.push({ key: `v:${ids.join("|")}`, kind: "vehicle", date, subjectId: a.vehicleId, shiftIds: ids });
      }
  return out;
}
