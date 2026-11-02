import { Badge } from "@/components/ui/badge";
import { PHASE_LABEL, type Phase } from "@/config";
import { cn } from "@/lib/utils";

const STYLE: Record<Phase, string> = {
  phase1: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  p1: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  p2: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

export function PhaseBadge({ phase, className }: { phase: Phase; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("shrink-0 border-0", STYLE[phase], className)}>
      {PHASE_LABEL[phase]}
    </Badge>
  );
}
