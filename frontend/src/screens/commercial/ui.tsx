"use client";

import type { ReactNode } from "react";
import { Select } from "@/components/app/fields";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth";
import { formatKD } from "@/lib/money";
import { monthLabel, monthsList } from "@/data/commercial/margin";

export function useActor() {
  const u = useSession();
  return { name: u?.name ?? "Demo user", role: u?.roleSlug ?? "demo" };
}

export function MonthSelect({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <Select className="w-44" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Month">
      {monthsList.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
    </Select>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** KD amount, red when negative. */
export function Money({ v, className }: { v: number; className?: string }) {
  return <span className={cn("tabular-nums", v < 0 && "text-red-600", className)}>{formatKD(v)}</span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "bad"; children: ReactNode }) {
  const t = { info: "border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200", warn: "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200", bad: "border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200" }[tone];
  return <div className={cn("rounded-lg border px-3 py-2 text-sm", t)}>{children}</div>;
}

/** Horizontal bar list; bars may be negative. */
export function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[9rem_1fr_8rem] items-center gap-2 text-xs">
          <span className="truncate">{r.label}</span>
          <div className="h-2 rounded bg-muted">
            <div className={cn("h-2 rounded", r.value < 0 ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} />
          </div>
          <Money v={r.value} className="text-end" />
        </div>
      ))}
    </div>
  );
}

export const Card2 = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn("rounded-lg border bg-card p-4", className)}>{children}</div>;
