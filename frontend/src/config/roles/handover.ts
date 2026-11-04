import { pick } from "../library";
import { r, type Role } from "../types";

export const handover: Role = {
  slug: "handover",
  title: "Handover Desk Staff",
  count: "2 per desk, 12-hour shifts, continuous cover",
  use: "Vehicle out / in events and inspections. Tablet-based, standing, high-speed, repetitive.",
  layout: "tablet",
  pages: [
    {
      slug: "home",
      title: "Home — Desk Screen",
      summary: "A home screen for the desk, not a dashboard.",
      ref: "§6.2",
      phase: "phase1",
      requirements: [
        r("Vehicles homed at this desk", "§6.2"),
        r("Who has what vehicle out", "§6.2"),
        r("Pending returns", "§6.2"),
        r("Vehicles flagged for service", "§7.4"),
        r("Large touch targets, one-handed, scoped to the operator's own desk", "§6.2"),
      ],
      future: [],
      shell: { kpis: ["At desk", "Out now", "Pending returns", "Flagged for service"], actions: ["Issue vehicle", "Return vehicle"] },
    },
    pick("handover", "handover"),
    pick("handover", "inspection"),
    pick("handover", "offline", {
      extra: [
        r("Sync conflicts are not merged automatically; apart from damage they are held for customer support to resolve", "decision"),
        r("Vehicle damage is recorded in the system; the Fleet Manager may reassign the driver to another vehicle", "decision"),
      ],
    }),
    pick("handover", "incident"),
  ],
};
