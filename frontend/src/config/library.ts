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
  /** Future items appended after the original ones. */
  extraFuture?: string[];
  patch?: Partial<Omit<ModulePage, "requirements">>;
  /** Marks the page as a view; names the role that edits it. */
  readOnlyBy?: string;
}

/** Account lifecycle shared by every role that onboards other users. */
export function accountRequirements(managed: string): Requirement[] {
  return [
    r(`Onboarding ${managed}: enter the person's details and assign the role in one step`, "decision"),
    r("The system creates the profile from those details, with a generated username that is fixed afterwards", "decision"),
    r("Username is Latin letters, words joined by a dot, and a unique number after a hyphen (for example ahmed.ali-0042); Arabic names are written in Latin letters", "decision"),
    r("A temporary password is created and emailed to the person", "decision"),
    r("The person must change the temporary password at first login", "decision"),
    r("The initial role can be changed later, within the roles this role may assign", "decision"),
    r(`Offboarding ${managed} deactivates the login automatically; accounts are never deleted by hand`, "decision"),
    r("Audit log on account creation, role changes and offboarding", "§5.5"),
  ];
}

/** In-app and email alerts for the records a role owns. */
export function notificationsPage(owns: string, extra: Requirement[] = []): ModulePage {
  return {
    slug: "notifications",
    title: "Notifications",
    summary: `Expiry alerts for ${owns}.`,
    ref: "§10.1, decision",
    phase: "phase1",
    requirements: [
      r("Notification centre moved from P2 to Phase 1 so owners are told before records expire", "§10.1, decision"),
      r(`Alerts for ${owns}`, "decision"),
      r("Each alert is shown in the app and also sent by email", "decision"),
      r("Recipient is derived from who owns the expiring record", "decision"),
      r("Alert timing follows the tiers on the Compliance Watchlist", "§7.1a"),
      r("Read and unread state; each alert links to the record it concerns", "decision"),
      r("Alerts only inform; any action (renew, block, terminate, reassign) is taken manually on the module page", "decision"),
      ...extra,
    ],
    future: ["WhatsApp delivery of alerts, which can be added later"],
    shell: { columns: ["When", "Record", "Type", "Expires", "Status"], actions: ["Mark as read"] },
  };
}

/** Reuses a page from the original single-role pages, with optional changes. */
export function pick(from: string, slug: string, opts: PickOptions = {}): ModulePage {
  const base = pool.find((x) => x.slug === from)?.pages.find((p) => p.slug === slug);
  if (!base) throw new Error(`Unknown page ${from}/${slug}`);

  let page: ModulePage = {
    ...base,
    ...opts.patch,
    requirements: [...base.requirements, ...(opts.extra ?? [])],
    future: [...(opts.patch?.future ?? base.future), ...(opts.extraFuture ?? [])],
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
