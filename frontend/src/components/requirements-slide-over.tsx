"use client";

import { ListChecks } from "lucide-react";
import { useSyncExternalStore } from "react";
import { PhaseBadge } from "@/components/phase-badge";
import { StatusBadge } from "@/components/app/status-badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { RequirementView } from "@/config/status";

const listeners = new Set<() => void>();
const keyFor = (id: string) => `ithc.verified.${id}`;

function readTicks(id: string): string {
  try {
    return window.localStorage.getItem(keyFor(id)) ?? "[]";
  } catch {
    return "[]";
  }
}

/**
 * Side button + slide-over with the page's requirements.
 * Two independent marks per requirement:
 *  - "Built by Claude" / "Pending": written by Claude in src/config/status/*
 *  - checkbox: ticked ONLY by the user after verifying; saved in this browser.
 */
export function RequirementsSlideOver({ id, title, requirements, future }: { id: string; title: string; requirements: RequirementView[]; future: string[] }) {
  const raw = useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => readTicks(id),
    () => "[]",
  );
  const ticks = new Set<number>(JSON.parse(raw) as number[]);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const toggle = (i: number) => {
    const next = new Set(ticks);
    if (next.has(i)) next.delete(i); else next.add(i);
    try { window.localStorage.setItem(keyFor(id), JSON.stringify([...next])); } catch {}
    listeners.forEach((fn) => fn());
  };

  const builtCount = requirements.filter((r) => r.built).length;
  const verified = requirements.filter((r) => ticks.has(r.index)).length;

  return (
    <Sheet>
      <SheetTrigger
        className="fixed end-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-s-lg border border-e-0 bg-primary px-2 py-3 text-xs font-medium text-primary-foreground shadow-md hover:bg-primary/90"
        aria-label="Open requirements"
      >
        <ListChecks className="size-4" />
        <span className="[writing-mode:vertical-rl]">Requirements</span>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}: requirements</SheetTitle>
          <SheetDescription>
            Built {builtCount} of {requirements.length} · Verified {mounted ? verified : 0} of {requirements.length}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
          <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
            &ldquo;Built by Claude&rdquo; means implemented in the demo UI against mock data. The checkbox is yours: tick it once you have verified the requirement.
          </p>
          <ul className="divide-y rounded-lg border">
            {requirements.map((req) => (
              <li key={req.index} className="flex items-start gap-3 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-foreground"
                  checked={mounted && ticks.has(req.index)}
                  onChange={() => toggle(req.index)}
                  aria-label={`Verified: ${req.text}`}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p>{req.text}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={req.built ? "good" : "warn"}>{req.built ? "Built by Claude" : "Pending"}</StatusBadge>
                    <span className="text-xs text-muted-foreground">{req.ref}</span>
                    {req.phase !== "phase1" && <PhaseBadge phase={req.phase} />}
                  </div>
                  {!req.built && req.note && <p className="text-xs text-muted-foreground">Missing: {req.note}</p>}
                </div>
              </li>
            ))}
          </ul>
          <section>
            <h3 className="text-sm font-semibold">Planned for the future</h3>
            {future.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {future.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <StatusBadge>Not in this build</StatusBadge>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Nothing is deferred for this page.</p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
