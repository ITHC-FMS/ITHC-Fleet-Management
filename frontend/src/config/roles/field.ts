import { pick } from "../library";
import type { Role } from "../types";

export const supervisor: Role = {
  slug: "supervisor",
  title: "Site Supervisor",
  count: "One per site",
  use: "Records attendance for placed workers at a client site. May be an ITHC employee or a trusted client contact with restricted access.",
  layout: "mobile",
  pages: [
    pick("supervisor", "attendance", { patch: { title: "Home — Daily Attendance" } }),
    pick("supervisor", "summary"),
  ],
};

export const worker: Role = {
  slug: "worker",
  title: "Workers",
  count: "~260 drivers",
  use: "Minimal read-only view: shift, vehicle and handover acknowledgement. Not a dispatch application.",
  layout: "mobile",
  pages: [
    pick("worker", "shift"),
    pick("worker", "vehicle"),
    pick("worker", "acknowledge"),
  ],
};
