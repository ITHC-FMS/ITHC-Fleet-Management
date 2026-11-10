"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/status-badge";
import { CRITERIA, THRESHOLDS } from "@/data/ops/perf";
import { logAudit, specialHours, weeklyPerf } from "@/data/ops/store";
import type { WeeklyPerf } from "@/data/ops/types";
import { cn } from "@/lib/utils";
import { Notice, parseDelimited, useActor, useNames } from "./shared";

export const Bar = ({ v, max, tone = "bg-sky-500" }: { v: number; max: number; tone?: string }) => <div className="h-3 w-full rounded bg-muted"><div className={cn("h-3 rounded", tone)} style={{ width: `${max ? Math.min(100, (v / max) * 100) : 0}%` }} /></div>;

const SAMPLE = (riders: string[]) => ["Rider ID,Week start,Acceptance %,Planned hrs,Actual hrs,Utilisation %,Late logins %,Special hrs coverage %", ...riders.slice(0, 4).map((r, i) => `${r},2026-11-09,${88 - i * 6},40,${39 - i * 3},${80 - i * 5},${3 + i * 4},${75 - i * 8}`), "TLB-0000,2026-11-09,90,40,40,80,2,80"].join("\n");

/** P1: weekly performance sheet ingestion, joined on platform rider ID. */
export function WeeklySheet() {
  const names = useNames();
  const actor = useActor();
  const all = weeklyPerf.useAll();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "warn" | "bad"; text: string } | null>(null);
  const riders = names.workers.filter((w) => w.riderId).map((w) => w.riderId!);
  const ingest = async () => {
    const rows = parseDelimited(text).slice(1);
    let n = 0;
    const missing: string[] = [];
    for (const r of rows) {
      const w = names.workers.find((x) => x.riderId?.toLowerCase() === r[0]?.toLowerCase());
      const nums = r.slice(2, 8).map(Number);
      if (!w) { missing.push(r[0]); continue; }
      if (nums.some((x) => !Number.isFinite(x))) { missing.push(`${r[0]} (bad number)`); continue; }
      const prev = all.find((x) => x.workerId === w.id && x.weekStart === r[1]);
      const rec: WeeklyPerf = { id: prev?.id ?? weeklyPerf.nextId("wpf"), workerId: w.id, riderId: w.riderId!, weekStart: r[1], acceptance: nums[0], plannedHours: nums[1], actualHours: nums[2], utilisation: nums[3], lateLogin: nums[4], specialCoverage: nums[5] };
      await weeklyPerf.save(rec); n++;
    }
    await logAudit({ actor, entity: "performance_sheet", entityId: "weekly", action: "ingest", detail: `${n} rows joined on rider ID; ${missing.length} unmatched` });
    setMsg({ tone: missing.length ? "warn" : "good", text: `${n} row(s) matched on rider ID and stored.${missing.length ? ` Not matched: ${missing.join(", ")}` : ""}` });
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Paste or load the weekly performance sheet from the platform. Rows join to drivers on the platform rider ID.</p>
      <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setText(SAMPLE(riders))}>Load sample sheet</Button><Button size="sm" disabled={!text.trim()} onClick={ingest}>Ingest sheet</Button></div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" rows={7} />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <p className="text-xs text-muted-foreground">{all.length} weekly records stored.</p>
    </div>
  );
}

/** P1: SpecialHoursSchedule entity for the platform's peak-hour blocks. */
export function SpecialHoursPanel() {
  const rows = specialHours.useAll();
  const [f, setF] = useState({ label: "", day: "Daily", from: "12:00", to: "14:00", multiplier: "" });
  return (
    <div className="space-y-3">
      <div className="divide-y rounded-lg border bg-card">
        {rows.map((r) => <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm"><b className="w-48">{r.label}</b><span className="w-24">{r.day}</span><span className="flex-1">{r.from} to {r.to}</span>{r.multiplier && <StatusBadge tone="info">{r.multiplier}</StatusBadge>}<Button size="icon-sm" variant="ghost" aria-label="Remove block" onClick={() => specialHours.remove(r.id)}><Trash2 /></Button></div>)}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Label"><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} className="w-44" /></Field>
        <Field label="Day"><Select value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} className="w-28">{["Daily", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <option key={d}>{d}</option>)}</Select></Field>
        <Field label="From"><Input type="time" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="w-28" /></Field>
        <Field label="To"><Input type="time" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="w-28" /></Field>
        <Field label="Multiplier"><Input value={f.multiplier} onChange={(e) => setF({ ...f, multiplier: e.target.value })} className="w-20" placeholder="1.5x" /></Field>
        <Button size="sm" disabled={!f.label.trim() || f.to <= f.from} onClick={async () => { await specialHours.save({ id: specialHours.nextId("sph"), label: f.label.trim(), day: f.day, from: f.from, to: f.to, multiplier: f.multiplier || undefined }); setF({ ...f, label: "" }); }}><Plus /> Add block</Button>
      </div>
    </div>
  );
}

export function ScoreCells({ parts }: { parts: Record<string, number> }) {
  return <>{CRITERIA.map((c) => <td key={c.key} className="px-2 text-end tabular-nums">{Math.round(parts[c.key])}</td>)}</>;
}
export const rulesNote = `Score is the equal-weighted average of five criteria. Batch 1 at ${THRESHOLDS.batch1}+, Batch 2 at ${THRESHOLDS.batch2}+, otherwise Batch 3. Proposals only: a person confirms each change with a reason.`;
