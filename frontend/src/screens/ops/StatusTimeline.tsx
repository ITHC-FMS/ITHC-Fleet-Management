"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/status-badge";
import { addDays, daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { overlappingSegments, STATUS_COLOR, STATUS_KEYS, STATUS_LABEL } from "@/data/ops/statuses";
import { segments, logAudit } from "@/data/ops/store";
import { addStatusSegment, syncCoreStatus } from "@/data/ops/worker-ops";
import type { AccommodationReason } from "@/data/ops/payroll-engine";
import type { StatusKey } from "@/data/ops/types";
import { Notice, useActor } from "./shared";

const REASONS: AccommodationReason[] = ["onboarding", "between_assignments", "standby", "sick_housing", "refused_work"];

export function StatusTimeline({ workerId, editable }: { workerId: string; editable: boolean }) {
  const actor = useActor();
  const all = segments.useAll();
  const segs = useMemo(() => all.filter((s) => s.workerId === workerId).sort((a, b) => b.from.localeCompare(a.from)), [all, workerId]);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<{ status: StatusKey; from: string; to: string; reason: AccommodationReason; note: string }>({ status: "active", from: TODAY, to: "", reason: "onboarding", note: "" });
  const [err, setErr] = useState("");

  const winStart = addDays(TODAY, -120), winEnd = addDays(TODAY, 15), span = daysBetween(winStart, winEnd);
  const add = async () => {
    if (f.to && f.to < f.from) return setErr("End date (inclusive) cannot be before the start date.");
    const clash = overlappingSegments(all, { id: "", workerId, from: f.from, to: f.to || null }).filter((s) => !(f.to === "" && s.to === null && s.from < f.from));
    if (clash.length) return setErr(`Overlaps ${STATUS_LABEL[clash[0].status]} (${fmtDate(clash[0].from)} to ${clash[0].to ? fmtDate(clash[0].to) : "open"}). Statuses are additive across a month but a day has one status: end the other segment first.`);
    await addStatusSegment({ workerId, status: f.status, from: f.from, to: f.to || null, reason: f.status === "accommodation" ? f.reason : undefined, note: f.note || undefined, actor });
    setAdding(false); setErr("");
  };

  return (
    <div className="space-y-3">
      <div className="relative h-7 overflow-hidden rounded border bg-muted/40" aria-label="Status timeline">
        {segs.map((s) => {
          const a = Math.max(0, daysBetween(winStart, s.from)), b = Math.min(span, daysBetween(winStart, s.to ?? winEnd) + 1);
          if (b <= 0 || a >= span) return null;
          return <div key={s.id} title={`${STATUS_LABEL[s.status]} ${s.from} → ${s.to ?? "open"}`} className={`absolute top-0 h-full ${STATUS_COLOR[s.status]}`} style={{ insetInlineStart: `${(a / span) * 100}%`, width: `${((b - a) / span) * 100}%` }} />;
        })}
        <div className="absolute top-0 h-full w-0.5 bg-black" style={{ insetInlineStart: `${(daysBetween(winStart, TODAY) / span) * 100}%` }} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">{STATUS_KEYS.map((k) => <span key={k} className="inline-flex items-center gap-1"><span className={`size-2.5 rounded-sm ${STATUS_COLOR[k]}`} />{STATUS_LABEL[k]}</span>)}</div>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-start"><th className="py-1 text-start">Status</th><th className="text-start">From</th><th className="text-start">To (inclusive)</th><th className="text-start">Note</th><th /></tr></thead>
        <tbody>
          {segs.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="py-1"><StatusBadge>{STATUS_LABEL[s.status]}</StatusBadge>{s.reason && <span className="ms-1 text-xs text-muted-foreground">{s.reason.replace(/_/g, " ")}</span>}</td>
              <td>{fmtDate(s.from)}</td><td>{s.to ? fmtDate(s.to) : "Open"}</td><td className="text-xs text-muted-foreground">{s.note}</td>
              <td className="text-end">{editable && <Button size="xs" variant="ghost" onClick={async () => { await segments.remove(s.id); await syncCoreStatus(workerId); await logAudit({ actor, entity: "worker_status", entityId: workerId, action: "remove_segment", detail: `${s.status} ${s.from} to ${s.to ?? "open"}` }); }}>Remove</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable && !adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus /> Add status segment</Button>}
      {editable && adding && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as StatusKey })}>{STATUS_KEYS.map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}</Select></Field>
            {f.status === "accommodation" ? <Field label="Accommodation reason" hint="Refused work does not earn the allowance"><Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value as AccommodationReason })}>{REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}</Select></Field> : <div />}
            <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="To (inclusive)" hint="Empty = open ended; closes the previous open segment"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          </div>
          <Field label="Note"><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="min-h-12" /></Field>
          {err && <Notice tone="bad">{err}</Notice>}
          <div className="flex gap-2"><Button size="sm" onClick={add}>Save segment</Button><Button size="sm" variant="ghost" onClick={() => { setAdding(false); setErr(""); }}>Cancel</Button></div>
        </div>
      )}
    </div>
  );
}
