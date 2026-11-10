import type { ModulePage, Requirement } from "../types";
import { adminStatus } from "./admin";
import { commercialStatus } from "./commercial";
import { fleetStatus } from "./fleet";
import { opsStatus } from "./ops";
import { peopleStatus } from "./people";
import type { StatusMap } from "./types";

const all: StatusMap = { ...opsStatus, ...fleetStatus, ...peopleStatus, ...commercialStatus, ...adminStatus };

export interface RequirementView extends Requirement {
  index: number;
  built: boolean;
  note?: string;
}

/**
 * A page with no entry in the status files is entirely "Pending".
 * A page with an entry is "built" for every requirement not listed under `pending`.
 */
export function requirementViews(roleSlug: string, page: ModulePage): RequirementView[] {
  const entry = all[`${roleSlug}/${page.slug}`];
  return page.requirements.map((req, index) => {
    if (!entry) return { ...req, index, built: false, note: "Screen not built yet" };
    const note = entry.pending?.[index];
    return { ...req, index, built: note === undefined, note };
  });
}
