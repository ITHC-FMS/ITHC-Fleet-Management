export type Phase = "phase1" | "p1" | "p2";
export type Layout = "desktop" | "tablet" | "mobile";

export const PHASE_LABEL: Record<Phase, string> = {
  phase1: "Phase 1",
  p1: "P1 (follows Phase 1)",
  p2: "P2 (recorded, not built)",
};

export interface Requirement {
  text: string;
  /** Section of ITHC_FLEET_PLATFORM_SPEC.pdf */
  ref: string;
  phase: Phase;
}

/** Static outline shown in the page body. No data, no logic. */
export interface PageShell {
  kpis?: string[];
  columns?: string[];
  actions?: string[];
}

export interface ModulePage {
  slug: string;
  title: string;
  summary: string;
  ref: string;
  phase: Phase;
  /** Everything this module needs in order to be complete. */
  requirements: Requirement[];
  /** Planned for later phases or explicitly deferred. */
  future: string[];
  shell: PageShell;
  /** Shows links to every role's pages (read-only monitoring). */
  directory?: boolean;
  /** Content drafted by us; not stated in the spec or the roles doc. */
  draft?: boolean;
}

export interface Role {
  slug: string;
  title: string;
  count: string;
  use: string;
  layout: Layout;
  /** Shows the All / single company selector. */
  companySelector?: boolean;
  pages: ModulePage[];
}

export const r = (
  text: string,
  ref: string,
  phase: Phase = "phase1",
): Requirement => ({ text, ref, phase });
