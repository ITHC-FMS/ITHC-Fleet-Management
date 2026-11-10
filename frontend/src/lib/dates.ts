/** Business dates are plain "YYYY-MM-DD" strings in Asia/Kuwait, never UTC timestamps. */
export type BizDate = string;

/** The demo's fixed "today" so seeded data always lines up. */
export const TODAY: BizDate = "2026-11-09";

export const addDays = (d: BizDate, n: number): BizDate => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export const daysBetween = (a: BizDate, b: BizDate): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export const fmtDate = (d?: BizDate | null): string => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m) - 1];
  return `${day} ${mon} ${y}`;
};

/** Inclusive date-range overlap (end null = open ended). */
export const overlaps = (aStart: BizDate, aEnd: BizDate | null, bStart: BizDate, bEnd: BizDate | null) =>
  aStart <= (bEnd ?? "9999-12-31") && bStart <= (aEnd ?? "9999-12-31");

export const monthOf = (d: BizDate) => d.slice(0, 7);
