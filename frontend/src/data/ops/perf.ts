import type { WeeklyPerf } from "./types";

export const BATCHES = ["Batch 1", "Batch 2", "Batch 3"] as const;
export const CRITERIA = [
  { key: "acceptance", label: "Acceptance rate" },
  { key: "hours", label: "Actual vs planned hours" },
  { key: "utilisation", label: "Utilisation" },
  { key: "lateLogin", label: "Late-login rate (lower is better)" },
  { key: "special", label: "Special-hours coverage" },
] as const;
export const THRESHOLDS = { batch1: 80, batch2: 65, watchMargin: 5 };

/** Five-criteria equal-weighted score, 0-100. */
export function scoreOf(w: WeeklyPerf) {
  const parts = {
    acceptance: w.acceptance,
    hours: Math.min(100, (w.actualHours / Math.max(1, w.plannedHours)) * 100),
    utilisation: w.utilisation,
    lateLogin: 100 - w.lateLogin,
    special: w.specialCoverage,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0) / 5;
  return { parts, score: Math.round(total * 10) / 10 };
}
export const batchForScore = (score: number) => (score >= THRESHOLDS.batch1 ? "Batch 1" : score >= THRESHOLDS.batch2 ? "Batch 2" : "Batch 3");
/** Distance (points) above the nearest demotion threshold for the current batch; small = at risk. */
export function demotionMargin(batch: string | undefined, score: number): number | null {
  if (batch === "Batch 1") return score - THRESHOLDS.batch1;
  if (batch === "Batch 2") return score - THRESHOLDS.batch2;
  return null;
}
