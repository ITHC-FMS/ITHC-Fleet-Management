"use client";

import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PhaseBadge } from "@/components/phase-badge";
import type { Requirement } from "@/config";

export function RequirementsPanel({ requirements }: { requirements: Requirement[] }) {
  return (
    <Collapsible defaultOpen className="rounded-lg border bg-card">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="font-semibold">
          Module requirements{" "}
          <span className="font-normal text-muted-foreground">({requirements.length})</span>
        </span>
        <ChevronDown className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y border-t">
          {requirements.map((req) => (
            <li key={req.text} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/40" />
              <span className="flex-1">{req.text}</span>
              <span className="shrink-0 whitespace-nowrap pt-0.5 text-xs text-muted-foreground">{req.ref}</span>
              {req.phase !== "phase1" && <PhaseBadge phase={req.phase} />}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
