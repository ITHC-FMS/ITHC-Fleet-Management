import { client } from "./pages/client";
import { supervisor, worker } from "./pages/field";
import { fleet } from "./pages/fleet";
import { handover } from "./pages/handover";
import { housing } from "./pages/housing";
import { operations } from "./pages/operations";
import { principal } from "./pages/principal";
import { r, type ModulePage, type Requirement } from "./types";

/** Source of the 12-role structure. */
export const ROLES_DOC = "Roles doc, p.8";

const pool = [principal, operations, handover, fleet, housing, client, supervisor, worker];

interface PickOptions {
  /** Requirements appended after the original ones. */
  extra?: Requirement[];
  patch?: Partial<Omit<ModulePage, "requirements">>;
  /** Marks the page as a view; names the role that edits it. */
  readOnlyBy?: string;
}

/** Reuses a page from the original single-role pages, with optional changes. */
export function pick(from: string, slug: string, opts: PickOptions = {}): ModulePage {
  const base = pool.find((x) => x.slug === from)?.pages.find((p) => p.slug === slug);
  if (!base) throw new Error(`Unknown page ${from}/${slug}`);

  let page: ModulePage = {
    ...base,
    ...opts.patch,
    requirements: [...base.requirements, ...(opts.extra ?? [])],
  };
  if (opts.readOnlyBy) {
    page = {
      ...page,
      title: `${page.title} (read-only)`,
      requirements: [
        r(`Read-only view. Editing is done by ${opts.readOnlyBy}`, ROLES_DOC),
        ...page.requirements,
      ],
    };
  }
  return page;
}
