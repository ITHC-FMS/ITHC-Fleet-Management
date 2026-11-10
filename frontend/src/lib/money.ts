/**
 * Money is stored as integer FILS (1 KD = 1,000 fils) everywhere in the demo.
 * Never use floats for money. Always display with exactly 3 decimals.
 */
export type Fils = number;

export const kdToFils = (kd: number): Fils => Math.round(kd * 1000);
export const filsToKd = (fils: Fils): number => fils / 1000;

/** "1,234.500" (no currency label). */
export function formatKD(fils: Fils, opts: { symbol?: boolean; sign?: boolean } = {}): string {
  const neg = fils < 0;
  const abs = Math.abs(Math.round(fils));
  const whole = Math.floor(abs / 1000).toLocaleString("en-US");
  const frac = String(abs % 1000).padStart(3, "0");
  const body = `${whole}.${frac}`;
  const sign = neg ? "-" : opts.sign ? "+" : "";
  return `${sign}${body}${opts.symbol === false ? "" : " KD"}`;
}

/** Parse "12.345" typed by a user into fils. Returns NaN when invalid. */
export function parseKD(input: string): Fils {
  const n = Number(input.replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.round(n * 1000) : NaN;
}

/** Fils amount shown as a bare "250 fils" style rate (bonus rates are quoted in fils). */
export const formatFils = (fils: Fils) => `${Math.round(fils).toLocaleString("en-US")} fils`;
