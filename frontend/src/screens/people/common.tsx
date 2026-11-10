"use client";

import type { ReactNode } from "react";
import { StatusBadge } from "@/components/app/status-badge";
import { useSession } from "@/lib/auth";
import { TODAY } from "@/lib/dates";

export function useActor() {
  const u = useSession();
  return u?.name ?? "Demo user";
}
export const stamp = () => `${TODAY} ${new Date().toTimeString().slice(0, 5)}`;

export function Errors({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <ul className="space-y-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
      {list.map((e) => <li key={e}>{e}</li>)}
    </ul>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "bad" | "good"; children: ReactNode }) {
  const c = { info: "border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200", warn: "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200", bad: "border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200", good: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" }[tone];
  return <div className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>;
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return <StatusBadge>No expiry</StatusBadge>;
  if (days < 0) return <StatusBadge tone="bad">Expired {-days}d ago</StatusBadge>;
  if (days <= 30) return <StatusBadge tone="warn">{days}d left</StatusBadge>;
  if (days <= 60) return <StatusBadge tone="info">{days}d left</StatusBadge>;
  return <StatusBadge tone="good">{days}d left</StatusBadge>;
}

export const kdInput = (fils: number) => (fils ? (fils / 1000).toFixed(3) : "");
export const csvSafe = (s: string) => s;
