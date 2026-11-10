"use client";

import { useMemo, useState } from "react";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { companies } from "@/data/core";
import { fmtDate, overlaps } from "@/lib/dates";
import { monthEnd, monthStart } from "@/data/ops/dates";
import { assignmentConflicts } from "@/data/ops/conflicts";
import { STORES } from "@/data/ops/seed";
import { isBlockedOn } from "@/data/ops/statuses";
import { assignments, logAudit, periods, segments, versionConflict } from "@/data/ops/store";
import type { Assignment, ShiftPattern } from "@/data/ops/types";
import { Notice, useActor, useNames } from "./shared";

type Draft = Omit<Assignment, "id" | "version"> & { id?: string; version?: number };

export function AssignmentForm({ open, onClose, initial, substitution }: { open: boolean; onClose: () => void; initial: Assignment | null; substitution: boolean }) {
  const names = useNames();
  const actor = useActor();
  const all = assignments.useAll();
  const segs = segments.useAll();
  const pers = periods.useAll();
  const cos = companies.useAll().filter((c) => c.kind === "operating");
  const blank: Draft = { workerId: "", clientId: "cli-americana", place: "", from: "2026-11-09", to: null, ownerCompanyId: "cmp-ithc", kind: substitution ? "substitution" : "regular", shift: "full" };
  const [d, setD] = useState<Draft>(initial ?? blank);
  const [opened] = useState(initial?.version ?? 0);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState("");
  const worker = names.wById.get(d.workerId);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const conflicts = useMemo(() => (d.workerId ? assignmentConflicts(all, { id: d.id ?? "", workerId: d.workerId, vehicleId: d.vehicleId, from: d.from, to: d.to, shift: d.shift, kind: d.kind }) : []), [all, d]);
  const closedTouched = pers.filter((p) => p.state === "closed" && overlaps(d.from, d.to, monthStart(p.month), monthEnd(p.month)));
  const blocked = worker ? isBlockedOn(segs, worker, d.from) : false;

  const cover = (id: string) => {
    const a = all.find((x) => x.workerId === id && x.kind === "regular" && overlaps(x.from, x.to, d.from, d.from));
    set({ substitutesWorkerId: id, ...(a ? { clientId: a.clientId, place: a.place } : {}) });
  };

  const submit = async () => {
    if (!d.workerId) return setErr("Choose a worker.");
    if (blocked) return setErr("This worker is blocked (or terminated/inactive) on the start date and cannot be given assignments.");
    if (!d.from) return setErr("Start date is required.");
    if (d.to && d.to < d.from) return setErr("End date (inclusive) cannot be before the start date.");
    if (d.kind === "substitution" && !d.substitutesWorkerId) return setErr("Choose whose route is being covered.");
    if (d.kind === "substitution" && d.substitutesWorkerId === d.workerId) return setErr("A worker cannot substitute for themselves.");
    if (conflicts.length && !ack) return setErr("Overlaps detected. Tick the acknowledgement to save anyway (the conflict will stay flagged).");
    if (closedTouched.length && reason.trim().length < 5) return setErr(`This range touches closed payroll period ${closedTouched.map((p) => p.month).join(", ")}. A reason is required; the closed period is not recomputed unless it is reopened.`);
    const cur = initial ? assignments.getSync(initial.id) : undefined;
    if (initial && versionConflict(opened, cur)) return setErr(`This assignment was changed by someone else (now v${cur?.version}). Close and reopen it.`);
    const rec: Assignment = { ...d, id: d.id ?? assignments.nextId("asg"), version: (cur?.version ?? 0) + 1, place: d.place || undefined };
    await assignments.save(rec);
    await logAudit({ actor, entity: "assignment", entityId: rec.id, action: initial ? "update" : "create", reason: reason.trim() || undefined, detail: `${names.worker(rec.workerId)} → ${names.client(rec.clientId)} ${rec.from} to ${rec.to ?? "open"} (${rec.shift})${closedTouched.length ? " [retroactive: closed period not recomputed]" : ""}` });
    onClose();
  };

  const title = initial ? "Edit assignment" : substitution ? "New substitution" : "New assignment";
  return (
    <FormSheet open={open} onOpenChange={(o) => !o && onClose()} title={title} description="Date-ranged. The end date is inclusive; leave it empty for an open-ended assignment." onSubmit={submit} submitLabel="Save assignment" wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label={substitution || d.kind === "substitution" ? "Covering worker" : "Worker"} className="col-span-2">
          <Select value={d.workerId} onChange={(e) => set({ workerId: e.target.value })}>
            <option value="">Select…</option>
            {names.workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.status}){isBlockedOn(segs, w, d.from) ? " — blocked" : ""}</option>)}
          </Select>
        </Field>
        {d.kind === "substitution" && (
          <Field label="Covering the route of" className="col-span-2">
            <Select value={d.substitutesWorkerId ?? ""} onChange={(e) => cover(e.target.value)}>
              <option value="">Select…</option>
              {names.workers.filter((w) => w.roles.includes("driver")).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Client"><Select value={d.clientId} onChange={(e) => set({ clientId: e.target.value, place: "" })}>{names.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Store / zone / site">
          {STORES[d.clientId] ? <Select value={d.place ?? ""} onChange={(e) => set({ place: e.target.value })}><option value="">—</option>{STORES[d.clientId].map((s) => <option key={s}>{s}</option>)}</Select> : <Input value={d.place ?? ""} onChange={(e) => set({ place: e.target.value })} />}
        </Field>
        <Field label="From"><Input type="date" value={d.from} onChange={(e) => set({ from: e.target.value })} /></Field>
        <Field label="To (inclusive)" hint="Empty = open ended"><Input type="date" value={d.to ?? ""} onChange={(e) => set({ to: e.target.value || null })} /></Field>
        <Field label="Shift"><Select value={d.shift} onChange={(e) => set({ shift: e.target.value as ShiftPattern })}><option value="full">Full day</option><option value="am">Morning</option><option value="pm">Afternoon</option></Select></Field>
        <Field label="Contract-owning company" hint="Recorded explicitly, separate from employing company">
          <Select value={d.ownerCompanyId} onChange={(e) => set({ ownerCompanyId: e.target.value })}>{cos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Vehicle" hint="Worker-to-vehicle assignments are edited by the Fleet Manager" className="col-span-2">
          <Input disabled value={d.vehicleId ? names.plate(d.vehicleId) : "No vehicle linked"} readOnly />
        </Field>
      </div>
      <Field label={closedTouched.length ? "Reason (mandatory: touches a closed payroll period)" : "Change note (optional)"}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      {blocked && <Notice tone="bad">Blocked worker: no assignments or tasks can be given.</Notice>}
      {closedTouched.length > 0 && <Notice tone="warn">Touches closed payroll period {closedTouched.map((p) => p.month).join(", ")}. The locked period will not change unless it is reopened by the Payroll Manager.</Notice>}
      {conflicts.length > 0 && (
        <Notice tone="warn">
          <p className="font-medium">Overlap detected</p>
          <ul className="list-disc ps-5">{conflicts.map((c, i) => <li key={i}>{c.message} ({fmtDate(all.find((a) => a.id === c.otherId)?.from)})</li>)}</ul>
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I accept the overlap; leave it flagged for resolution</label>
        </Notice>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
    </FormSheet>
  );
}
