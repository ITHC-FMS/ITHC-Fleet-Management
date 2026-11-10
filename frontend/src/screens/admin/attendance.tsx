"use client";

import { ChevronLeft, ChevronRight, Check, Minus, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Select } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { attendance, isWeekend, type AttendanceStatus } from "@/data/admin";
import { TODAY, addDays, fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Notice } from "./shared";
import { fmtMinutes, useSite } from "./site";

type Draft = { status: AttendanceStatus; minutes: number };

const BTN: Record<AttendanceStatus, { label: string; icon: typeof Check; on: string }> = {
  present: { label: "Present", icon: Check, on: "bg-emerald-600 text-white border-emerald-600" },
  absent: { label: "Absent", icon: X, on: "bg-red-600 text-white border-red-600" },
  partial: { label: "Partial", icon: Minus, on: "bg-amber-500 text-white border-amber-500" },
};

export default function AttendanceScreen() {
  const site = useSite();
  const all = attendance.useAll();
  const [date, setDate] = useState(TODAY);
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const hourly = site.contract?.pricingModel === "hourly";

  const existing = useMemo(() => new Map(all.filter((a) => a.date === date && a.locationId === site.locationId).map((a) => [a.workerId, a])), [all, date, site.locationId]);
  const current = (wid: string): Draft | undefined => edits[`${date}|${wid}`] ?? (existing.get(wid) ? { status: existing.get(wid)!.status, minutes: existing.get(wid)!.minutes } : undefined);
  const set = (wid: string, d: Draft) => { setMsg(null); setEdits((e) => ({ ...e, [`${date}|${wid}`]: d })); };
  const choose = (wid: string, status: AttendanceStatus) => {
    const prev = current(wid);
    set(wid, { status, minutes: status === "absent" ? 0 : status === "present" ? 480 : prev?.status === "partial" ? prev.minutes : 240 });
  };
  const dirty = site.placed.filter((w) => edits[`${date}|${w.id}`]);
  const recorded = site.placed.filter((w) => current(w.id)).length;
  const weekend = isWeekend(date);

  const save = async () => {
    for (const w of dirty) {
      const d = edits[`${date}|${w.id}`];
      if (d.status === "partial" && (d.minutes <= 0 || d.minutes >= 1440)) return setMsg({ tone: "bad", text: `${w.name}: enter the hours worked for a partial day.` });
      if (d.status === "present" && hourly && d.minutes <= 0) return setMsg({ tone: "bad", text: `${w.name}: hours are required on an hourly contract.` });
    }
    await attendance.saveMany(
      dirty.map((w) => {
        const d = edits[`${date}|${w.id}`];
        const prev = existing.get(w.id);
        return { id: `${w.id}|${date}`, workerId: w.id, locationId: site.locationId, date, status: d.status, minutes: d.minutes, recordedBy: site.recorder, version: (prev?.version ?? 0) + 1 };
      }),
    );
    setEdits({});
    setMsg({ tone: "good", text: `Attendance saved for ${dirty.length} worker${dirty.length === 1 ? "" : "s"} on ${fmtDate(date)}.` });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Daily Attendance" description={site.location ? `${site.location.name}${site.client ? ` for ${site.client.name}` : ""}` : undefined} />
      {site.clientContact && <Notice>Trusted client contact: you can only see and record your own site.</Notice>}
      {!site.locked && (
        <Select value={site.locationId} onChange={(e) => { site.setSite(e.target.value); setEdits({}); }} aria-label="Site (monitoring view)" className="h-12 text-base">
          {site.sites.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" className="h-12 w-14" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><ChevronLeft className="size-6" /></Button>
        <div className="text-center">
          <p className="text-lg font-semibold">{date === TODAY ? "Today" : fmtDate(date)}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(date)}{weekend ? " (weekend)" : ""}</p>
        </div>
        <Button variant="outline" className="h-12 w-14" aria-label="Next day" disabled={date >= TODAY} onClick={() => setDate(addDays(date, 1))}><ChevronRight className="size-6" /></Button>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span>{recorded} of {site.placed.length} recorded</span>
        {hourly && <StatusBadge tone="info">Hourly contract: hours required</StatusBadge>}
      </div>
      <Button variant="outline" className="h-12 w-full text-base" onClick={() => site.placed.forEach((w) => !current(w.id) && choose(w.id, "present"))}>Mark everyone not yet recorded as present</Button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <ul className="space-y-3">
        {site.placed.map((w) => {
          const d = current(w.id);
          const changed = !!edits[`${date}|${w.id}`];
          const showHours = d && (d.status === "partial" || (d.status === "present" && hourly));
          return (
            <li key={w.id} className={cn("space-y-3 rounded-xl border bg-card p-3", changed && "ring-2 ring-sky-400")}>
              <div className="flex items-center justify-between">
                <div><p className="font-semibold">{w.name}</p><p className="text-xs text-muted-foreground">{w.id}, {w.roles.join(", ")}</p></div>
                {["sick_leave", "annual_leave"].includes(w.status) && <StatusBadge tone="warn">{w.status.replace("_", " ")}</StatusBadge>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(BTN) as AttendanceStatus[]).map((s) => {
                  const I = BTN[s].icon;
                  return (
                    <button key={s} type="button" onClick={() => choose(w.id, s)} aria-pressed={d?.status === s}
                      className={cn("flex h-14 flex-col items-center justify-center rounded-xl border text-sm font-medium", d?.status === s ? BTN[s].on : "bg-background hover:bg-muted")}>
                      <I className="size-5" />{BTN[s].label}
                    </button>
                  );
                })}
              </div>
              {showHours && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                  <span className="text-sm">Hours worked</span>
                  <span className="flex items-center gap-3">
                    <Button variant="outline" className="size-12" aria-label="Less time" onClick={() => set(w.id, { ...d, minutes: Math.max(0, d.minutes - 30) })}><Minus className="size-5" /></Button>
                    <span className="w-16 text-center text-lg font-semibold tabular-nums">{fmtMinutes(d.minutes)}</span>
                    <Button variant="outline" className="size-12" aria-label="More time" onClick={() => set(w.id, { ...d, minutes: Math.min(960, d.minutes + 30) })}><Plus className="size-5" /></Button>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-2">
        <Button className="h-14 w-full text-base shadow-lg" disabled={!dirty.length} onClick={save}>Save attendance{dirty.length ? ` (${dirty.length})` : ""}</Button>
      </div>
    </div>
  );
}
