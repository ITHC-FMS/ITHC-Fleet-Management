"use client";

import { useMemo, useState } from "react";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select } from "@/components/app/fields";
import { Button } from "@/components/ui/button";
import { scheduleConflicts } from "@/data/ops/conflicts";
import { STORES } from "@/data/ops/seed";
import { isBlockedOn } from "@/data/ops/statuses";
import { logAudit, segments, shifts, versionConflict } from "@/data/ops/store";
import { timeToMin } from "@/data/ops/dates";
import type { Shift } from "@/data/ops/types";
import { Notice, useActor, useNames } from "./shared";

type Draft = Omit<Shift, "id" | "version"> & { id?: string };

export function ShiftForm({ initial, preset, onClose }: { initial: Shift | null; preset?: Partial<Shift>; onClose: () => void }) {
  const names = useNames();
  const actor = useActor();
  const all = shifts.useAll();
  const segs = segments.useAll();
  const [d, setD] = useState<Draft>(initial ?? { date: "2026-11-09", workerId: "", clientId: "cli-americana", plannedStart: "07:00", plannedEnd: "15:00", ...preset });
  const [opened] = useState(initial?.version ?? 0);
  const [err, setErr] = useState("");
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const worker = names.wById.get(d.workerId);
  const blocked = worker ? isBlockedOn(segs, worker, d.date) : false;

  const preview = useMemo(() => {
    const draft: Shift = { ...d, id: d.id ?? "__draft", version: 0 };
    return scheduleConflicts([...all.filter((s) => s.id !== draft.id), draft]).filter((c) => c.shiftIds.includes(draft.id));
  }, [all, d]);

  const submit = async () => {
    if (!d.workerId) return setErr("Choose a driver.");
    if (blocked) return setErr("This worker is blocked and cannot be scheduled.");
    if (timeToMin(d.plannedEnd) <= timeToMin(d.plannedStart)) return setErr("Planned end must be after planned start.");
    const cur = initial ? shifts.getSync(initial.id) : undefined;
    if (initial && versionConflict(opened, cur)) return setErr(`Changed by someone else (now v${cur?.version}). Close and reopen.`);
    const rec: Shift = { ...d, id: d.id ?? shifts.nextId("sh"), version: (cur?.version ?? 0) + 1, vehicleId: d.vehicleId || undefined, place: d.place || undefined, actualStart: d.actualStart || undefined, actualEnd: d.actualEnd || undefined };
    await shifts.save(rec);
    await logAudit({ actor, entity: "shift", entityId: rec.id, action: initial ? "update" : "create", detail: `${names.worker(rec.workerId)} ${rec.date} ${rec.plannedStart}-${rec.plannedEnd}` });
    onClose();
  };

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={initial ? "Edit shift" : "New shift"} description="Planned and actual times. Conflicts are shown, not auto-resolved." onSubmit={submit} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Driver" className="col-span-2"><Select value={d.workerId} onChange={(e) => set({ workerId: e.target.value })}><option value="">Select…</option>{names.workers.filter((w) => w.roles.includes("driver")).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
        <Field label="Date"><Input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Vehicle"><Select value={d.vehicleId ?? ""} onChange={(e) => set({ vehicleId: e.target.value })}><option value="">No vehicle</option>{names.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} ({v.type})</option>)}</Select></Field>
        <Field label="Client"><Select value={d.clientId} onChange={(e) => set({ clientId: e.target.value, place: "" })}>{names.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Store / zone">{STORES[d.clientId] ? <Select value={d.place ?? ""} onChange={(e) => set({ place: e.target.value })}><option value="">—</option>{STORES[d.clientId].map((s) => <option key={s}>{s}</option>)}</Select> : <Input value={d.place ?? ""} onChange={(e) => set({ place: e.target.value })} />}</Field>
        <Field label="Planned start"><Input type="time" value={d.plannedStart} onChange={(e) => set({ plannedStart: e.target.value })} /></Field>
        <Field label="Planned end"><Input type="time" value={d.plannedEnd} onChange={(e) => set({ plannedEnd: e.target.value })} /></Field>
        <Field label="Actual start"><Input type="time" value={d.actualStart ?? ""} onChange={(e) => set({ actualStart: e.target.value })} /></Field>
        <Field label="Actual end"><Input type="time" value={d.actualEnd ?? ""} onChange={(e) => set({ actualEnd: e.target.value })} /></Field>
      </div>
      {blocked && <Notice tone="bad">Blocked worker: cannot be given shifts.</Notice>}
      {preview.length > 0 && <Notice tone="warn">This shift would overlap {preview.length} other shift(s): {preview.map((c) => (c.kind === "driver" ? "same driver double-booked" : "vehicle used by two drivers at once")).join("; ")}. You can still save it; resolve it from the conflict list.</Notice>}
      {err && <Notice tone="bad">{err}</Notice>}
      {initial && <Button type="button" variant="destructive" size="sm" onClick={async () => { await shifts.remove(initial.id); await logAudit({ actor, entity: "shift", entityId: initial.id, action: "delete", detail: `Removed shift ${initial.date}` }); onClose(); }}>Remove shift</Button>}
    </FormSheet>
  );
}
