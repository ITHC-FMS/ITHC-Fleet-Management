"use client";

import { Clock, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { clients } from "@/data/core";
import { TODAY, fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Notice } from "./shared";
import { useMyWorker } from "./worker-common";

export default function WorkerShiftScreen() {
  const { me, shifts, picker, fallback } = useMyWorker();
  const cls = clients.useAll();
  const upcoming = shifts.filter((s) => s.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const past = shifts.filter((s) => s.date < TODAY).sort((a, b) => b.date.localeCompare(a.date));
  const today = upcoming.find((s) => s.date === TODAY);
  const next = today ?? upcoming[0];

  const card = (s: (typeof shifts)[number], big = false) => (
    <li key={s.id} className={cn("rounded-xl border bg-card p-4", big && "border-2 border-foreground/70")}>
      <div className="flex items-center justify-between">
        <p className={cn("font-semibold", big ? "text-xl" : "text-base")}>{s.date === TODAY ? "Today" : fmtDate(s.date)}</p>
        {s.date === TODAY && <StatusBadge tone="good">Today</StatusBadge>}
      </div>
      <p className={cn("mt-2 flex items-center gap-2 tabular-nums", big ? "text-2xl" : "text-lg")}><Clock className="size-5" />{s.start} to {s.end}</p>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" />{cls.find((c) => c.id === s.clientId)?.name}, {s.store}</p>
    </li>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="My Shift" description={me ? me.name : undefined} />
      {picker}
      {fallback && <Notice tone="warn">Demo: no worker record matches the demo user, so {me?.name} is shown.</Notice>}
      {!me ? <Notice>No worker found.</Notice> : (
        <>
          {next ? <ul>{card(next, true)}</ul> : <Notice>No shift assigned.</Notice>}
          {upcoming.length > (today ? 1 : 1) && (
            <section className="space-y-2"><h2 className="font-semibold">Coming up</h2><ul className="space-y-2">{upcoming.filter((s) => s !== next).map((s) => card(s))}</ul></section>
          )}
          {past.length > 0 && (
            <section className="space-y-2"><h2 className="font-semibold">Recent</h2><ul className="space-y-2">{past.slice(0, 3).map((s) => card(s))}</ul></section>
          )}
          <p className="text-center text-xs text-muted-foreground">Read-only. Shifts are set by Operations.</p>
        </>
      )}
    </div>
  );
}
