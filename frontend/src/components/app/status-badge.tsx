import { cn } from "@/lib/utils";

type Tone = "neutral" | "good" | "warn" | "bad" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  bad: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
};

export function StatusBadge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", TONES[tone], className)}>{children}</span>;
}

/** Common status words to a tone, so screens stay consistent. */
export function toneFor(status: string): Tone {
  const s = status.toLowerCase().replace(/[_\s]/g, "");
  if (["active", "built", "open", "approved", "signed", "present", "inservice", "paid", "done", "closed", "returned", "settled", "verified"].includes(s)) return "good";
  if (["pending", "probation", "training", "draft", "partial", "standby", "sickleave", "annualleave", "expiring", "underrepair", "repaying", "review"].includes(s)) return "warn";
  if (["blocked", "terminated", "absconded", "absent", "expired", "rejected", "missing", "overdue", "damaged", "inactive", "offfleet"].includes(s)) return "bad";
  return "neutral";
}
export const prettify = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
