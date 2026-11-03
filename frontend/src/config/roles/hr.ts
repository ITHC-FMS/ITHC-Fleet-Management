import { pick, ROLES_DOC } from "../library";
import { r, type ModulePage, type Role } from "../types";

export const complianceWatchlist: ModulePage = {
  slug: "watchlist",
  title: "Compliance Watchlist",
  summary: "One screen across workers, vehicles, contracts and leases.",
  ref: "§7.1a",
  phase: "phase1",
  requirements: [
    r("Single screen: whose documents expire in the next 30 and 60 days, and what is missing entirely", "§7.1a"),
    r("Includes worker documents, vehicle documents, contract documents and lease documents", "§5.3a, decision"),
    r("Tiered expiry alerting with configurable tiers (reference: civil ID and licence 30 days; passport, visa, health card 60 days)", "§7.1a"),
    r("DocumentAlert is derived, not stored", "§5.3a"),
    r("Vehicle, contract and lease items link to Fleet, Finance and Housing for action", ROLES_DOC),
    r("Notification centre for alerts", "§10.1", "p2"),
  ],
  future: ["Notification centre (P2)"],
  shell: {
    kpis: ["Expiring ≤30 days", "Expiring ≤60 days", "Missing"],
    columns: ["Owner", "Type", "Document", "Expires", "Days left", "Tier"],
  },
};

export const hr: Role = {
  slug: "hr",
  title: "HR / Workforce Manager",
  count: "1–2 users",
  use: "Onboarding and offboarding, worker documents and compliance management.",
  layout: "desktop",
  pages: [
    {
      slug: "home",
      title: "Home — Workforce Overview",
      summary: "Draft content; the roles doc defines no dashboard for this role.",
      ref: "§7.1, §7.1a",
      phase: "phase1",
      draft: true,
      requirements: [
        r("Workers by role and current status", "§5.2"),
        r("Onboarding in progress and leavers in progress", "§7.1"),
        r("Documents expiring in 30 and 60 days, and missing", "§7.1a"),
        r("Hires needed for leased vehicles, with compliance status", "Roles doc p.1"),
      ],
      future: [],
      shell: { kpis: ["Active workers", "Onboarding", "Expiring ≤30 days", "Missing documents"] },
    },
    pick("operations", "workers", {
      extra: [
        r("Initial pay parameters entered at onboarding; later changes are made by the Payroll Manager", "decision"),
        r("Hiring of drivers for leased vehicles with compliance checks", "Roles doc p.1"),
      ],
    }),
    pick("operations", "offboarding"),
    {
      slug: "documents",
      title: "Worker Documents",
      summary: "Storage plus dates. Deliberately not an HR suite.",
      ref: "§5.3a, §7.1a",
      phase: "phase1",
      requirements: [
        r("PDF and image upload against worker records", "§7.1a"),
        r("Types: civil ID, driving licence, passport, visa and residency, health card", "§7.1a"),
        r("Employment contracts, warnings and leave records", "§7.1a"),
        r("Carries issue and expiry dates, issuing authority, upload audit trail", "§5.3a"),
        r("Renewal supersedes the prior version; it does not delete it", "§7.1a"),
        r("All of a worker's current documents retrievable in one place", "§7.1a"),
        r("Out of scope: statutory filings, WPS, PIFSS, indemnity, ministry returns", "§7.1a"),
      ],
      future: [],
      shell: { columns: ["Worker", "Type", "Issued", "Expires", "Authority", "Version"], actions: ["Upload document"] },
    },
    complianceWatchlist,
  ],
};
