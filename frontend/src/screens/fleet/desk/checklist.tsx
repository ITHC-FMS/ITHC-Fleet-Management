"use client";

import type { ChecklistItem, Grade } from "@/data/fleet";
import { cn } from "@/lib/utils";

const GRADES: { g: Grade; label: string; cls: string }[] = [
  { g: "ok", label: "OK", cls: "border-emerald-600 bg-emerald-600 text-white" },
  { g: "minor", label: "Minor", cls: "border-amber-500 bg-amber-500 text-white" },
  { g: "major", label: "Damage", cls: "border-red-600 bg-red-600 text-white" },
];

/** Itemised checklist with big OK / Minor / Damage buttons per line. */
export function Checklist({ items, onChange, readOnly }: { items: ChecklistItem[]; onChange?: (items: ChecklistItem[]) => void; readOnly?: boolean }) {
  const set = (key: string, patch: Partial<ChecklistItem>) => onChange?.(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.key} className="rounded-xl border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-lg font-medium">{it.label}</span>
            <div className="flex gap-2">
              {GRADES.map((x) => (
                <button
                  key={x.g}
                  type="button"
                  disabled={readOnly}
                  onClick={() => set(it.key, { grade: x.g })}
                  className={cn("min-h-14 min-w-20 rounded-lg border-2 px-3 text-base font-semibold", it.grade === x.g ? x.cls : "border-border bg-background text-muted-foreground", readOnly && "pointer-events-none")}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          {it.grade !== "ok" && (
            readOnly ? (
              it.note ? <p className="mt-2 text-sm text-muted-foreground">{it.note}</p> : null
            ) : (
              <input
                value={it.note ?? ""}
                onChange={(e) => set(it.key, { note: e.target.value })}
                placeholder="What is wrong? (optional)"
                className="mt-2 h-12 w-full rounded-lg border bg-background px-3 text-base"
              />
            )
          )}
        </div>
      ))}
    </div>
  );
}
