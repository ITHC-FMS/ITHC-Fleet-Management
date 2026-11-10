"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { addDays, fmtDate, TODAY } from "@/lib/dates";
import { assignmentConflicts, scheduleConflicts, type ScheduleConflict } from "@/data/ops/conflicts";
import { DOW, weekStartOf } from "@/data/ops/dates";
import { assignments, conflictAcks, logAudit, shifts } from "@/data/ops/store";
import type { Shift } from "@/data/ops/types";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../types";
import { ShiftForm } from "./ShiftForm";
import { Notice, ReasonSheet, useActor, useNames } from "./shared";

export default function ScheduleScreen({ readOnly, editedBy }: ScreenProps) {
  const names = useNames();
  const actor = useActor();
  const all = shifts.useAll();
  const acks = conflictAcks.useAll();
  const asg = assignments.useAll();
  const [week, setWeek] = useState(weekStartOf(TODAY));
  const [by, setBy] = useState<"driver" | "vehicle">("driver");
  const [client, setClient] = useState("");
  const [form, setForm] = useState<{ s: Shift | null; preset?: Partial<Shift> } | null>(null);
  const [ackFor, setAckFor] = useState<ScheduleConflict | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const inWeek = useMemo(() => all.filter((s) => s.date >= week && s.date <= addDays(week, 6) && (!client || s.clientId === client)), [all, week, client]);
  const conflicts = useMemo(() => scheduleConflicts(all).filter((c) => c.date >= week && c.date <= addDays(week, 6)), [all, week]);
  const ackKeys = new Set(acks.map((a) => a.key));
  const open = conflicts.filter((c) => !ackKeys.has(c.key));
  const conflictOf = (id: string) => conflicts.filter((c) => c.shiftIds.includes(id));
  const asgOverlaps = useMemo(() => asg.filter((a) => assignmentConflicts(asg, a).length).length, [asg]);
  const shiftById = useMemo(() => new Map(all.map((s) => [s.id, s])), [all]);

  const rowKeys = useMemo(() => {
    const ids = [...new Set(inWeek.map((s) => (by === "driver" ? s.workerId : s.vehicleId ?? "none")))];
    return ids.sort((a, b) => (by === "driver" ? names.worker(a).localeCompare(names.worker(b)) : names.plate(a).localeCompare(names.plate(b))));
  }, [inWeek, by, names]);

  const chip = (s: Shift) => {
    const cs = conflictOf(s.id);
    const state = cs.length === 0 ? "ok" : cs.every((c) => ackKeys.has(c.key)) ? "ack" : "bad";
    return (
      <button key={s.id} type="button" onClick={() => !readOnly && setForm({ s })}
        className={cn("block w-full rounded border px-1.5 py-1 text-start text-[11px] leading-tight", state === "bad" ? "border-red-400 bg-red-100 text-red-900" : state === "ack" ? "border-amber-400 bg-amber-100 text-amber-900" : "bg-sky-50 text-sky-900")}>
        <span className="font-medium">{state !== "ok" && <TriangleAlert className="me-1 inline size-3" />}{s.plannedStart}–{s.plannedEnd}</span>
        <span className="block truncate">{by === "driver" ? `${names.client(s.clientId)} · ${s.vehicleId ? names.plate(s.vehicleId) : "no vehicle"}` : `${names.worker(s.workerId)} · ${s.place ?? names.client(s.clientId)}`}</span>
        {s.actualStart && <span className="block text-muted-foreground">actual {s.actualStart}{s.actualEnd ? `–${s.actualEnd}` : ""}</span>}
      </button>
    );
  };

  const describe = (c: ScheduleConflict) => {
    const [a, b] = c.shiftIds.map((id) => shiftById.get(id));
    return c.kind === "driver"
      ? `${names.worker(c.subjectId)} is booked twice on ${fmtDate(c.date)}: ${a?.plannedStart}–${a?.plannedEnd} (${names.client(a?.clientId)}) and ${b?.plannedStart}–${b?.plannedEnd} (${names.client(b?.clientId)})`
      : `Vehicle ${names.plate(c.subjectId)} is used by ${names.worker(a?.workerId)} (${a?.plannedStart}–${a?.plannedEnd}) and ${names.worker(b?.workerId)} (${b?.plannedStart}–${b?.plannedEnd}) on ${fmtDate(c.date)}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Shift Schedule" description="Weekly schedule with overlapping driver and vehicle bookings flagged. Resolving a conflict is a human decision; nothing is auto-optimised." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Shifts this week" value={inWeek.length} />
        <KpiCard label="Open conflicts" value={open.length} tone={open.length ? "bad" : "good"} />
        <KpiCard label="Acknowledged conflicts" value={conflicts.length - open.length} tone="warn" />
        <KpiCard label="Assignment overlaps" value={asgOverlaps} hint="See Assignments" tone={asgOverlaps ? "warn" : "good"} />
      </KpiGrid>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week"><ChevronLeft /></Button>
        <Input type="date" value={week} onChange={(e) => e.target.value && setWeek(weekStartOf(e.target.value))} className="w-40" />
        <Button variant="outline" size="icon" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week"><ChevronRight /></Button>
        <Button variant="ghost" size="sm" onClick={() => setWeek(weekStartOf(TODAY))}>This week</Button>
        <span className="text-sm text-muted-foreground">{fmtDate(week)} to {fmtDate(addDays(week, 6))}</span>
        <Select value={by} onChange={(e) => setBy(e.target.value as "driver" | "vehicle")} className="ms-auto w-36"><option value="driver">By driver</option><option value="vehicle">By vehicle</option></Select>
        <Select value={client} onChange={(e) => setClient(e.target.value)} className="w-40"><option value="">All clients</option>{names.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        {!readOnly && <Button size="sm" onClick={() => setForm({ s: null, preset: { date: week > TODAY ? week : TODAY <= addDays(week, 6) ? TODAY : week } })}><Plus /> New shift</Button>}
      </div>
      {open.length > 0 && (
        <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-900">Conflicts to resolve ({open.length})</p>
          {open.map((c) => (
            <div key={c.key} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-72 flex-1">{describe(c)}</span>
              {!readOnly && <>
                {c.shiftIds.map((id, i) => <Button key={id} size="xs" variant="outline" onClick={() => setForm({ s: shiftById.get(id) ?? null })}>Edit shift {i + 1}</Button>)}
                <Button size="xs" variant="ghost" onClick={() => setAckFor(c)}>Keep as is</Button>
              </>}
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-44 px-2 py-2 text-start font-medium">{by === "driver" ? "Driver" : "Vehicle"}</th>
              {days.map((d, i) => <th key={d} className={cn("px-2 py-2 text-start font-medium", d === TODAY && "bg-sky-100")}>{DOW[i]} <span className="text-xs font-normal text-muted-foreground">{d.slice(8)}/{d.slice(5, 7)}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {rowKeys.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No shifts planned this week.</td></tr>}
            {rowKeys.map((k) => (
              <tr key={k} className="border-t align-top">
                <td className="px-2 py-1.5 font-medium">{by === "driver" ? names.worker(k) : k === "none" ? "No vehicle" : names.plate(k)}</td>
                {days.map((d) => {
                  const cell = inWeek.filter((s) => s.date === d && (by === "driver" ? s.workerId === k : (s.vehicleId ?? "none") === k)).sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
                  return (
                    <td key={d} className={cn("space-y-1 px-1 py-1", d === TODAY && "bg-sky-50/50")}>
                      {cell.map(chip)}
                      {!readOnly && by === "driver" && <button type="button" aria-label="Add shift" className="w-full rounded text-[10px] text-muted-foreground opacity-40 hover:bg-muted hover:opacity-100" onClick={() => setForm({ s: null, preset: { date: d, workerId: k } })}>+</button>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Notice tone="info">Legend: red = open conflict, amber = acknowledged by a person, blue = no conflict. Planned times are shown; actual times appear once recorded.</Notice>
      {form && <ShiftForm key={form.s?.id ?? "new"} initial={form.s} preset={form.preset} onClose={() => setForm(null)} />}
      {ackFor && (
        <ReasonSheet open onOpenChange={(o) => !o && setAckFor(null)} title="Keep conflict as is" description={describe(ackFor)} submitLabel="Acknowledge"
          onConfirm={async (note) => {
            await conflictAcks.save({ id: conflictAcks.nextId("ack"), key: ackFor.key, note, by: actor, at: TODAY });
            await logAudit({ actor, entity: "schedule_conflict", entityId: ackFor.key, action: "acknowledge", reason: note, detail: describe(ackFor) });
            setAckFor(null);
          }} />
      )}
    </div>
  );
}
