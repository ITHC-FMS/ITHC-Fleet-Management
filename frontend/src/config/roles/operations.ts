import { pick, ROLES_DOC } from "../library";
import { r, type Role } from "../types";

export const operations: Role = {
  slug: "operations",
  title: "Operations Manager",
  count: "1 user",
  use: "Runs delivery work day to day: orders, driver-client assignments, schedule, reports and marketplace performance.",
  layout: "desktop",
  pages: [
    {
      slug: "home",
      title: "Home — Operations Dashboard",
      summary: "Daily view for the Operations Manager.",
      ref: "§6.1, §7.8",
      phase: "phase1",
      requirements: [
        r("Order entry status", "§6.1"),
        r("Payroll period state (not generated, open, closed)", "§5.5"),
        r("Drivers in transition (client or contract changed this period)", "§7.7"),
        r("Schedule conflicts (overlapping assignments)", "§7.3"),
        r("Expiring documents", "§7.1a"),
        r("Fuel anomalies", "§7.8"),
        r("Client invoice reconciliation status", "§7.8"),
      ],
      future: [],
      shell: {
        kpis: ["Orders today", "Payroll period", "Schedule conflicts", "Fuel anomalies"],
      },
    },
    pick("operations", "orders", {
      extra: [r("Order intake mechanism (manual grid, import or API) to be confirmed", "§8.4, §7.13")],
    }),
    pick("operations", "assignments", {
      extra: [r("Edits driver-to-client assignments; worker-to-vehicle assignments are edited by the Fleet Manager", ROLES_DOC)],
    }),
    pick("operations", "schedule"),
    pick("operations", "stores"),
    pick("operations", "imports"),
    pick("operations", "reports", {
      extra: [
        r("Driver rankings", "§7.8", "p1"),
        r("Day-of-week and week-over-week trend views", "§7.8", "p1"),
        r("Cross-company reports follow the company selector", ROLES_DOC),
      ],
    }),
    pick("operations", "performance", {
      extra: [
        r("Marketplace operations dashboard: batch distribution, pace against target, KPI alerts", "§7.8", "p1"),
      ],
    }),
    pick("operations", "workers", { readOnlyBy: "HR / Workforce Manager" }),
  ],
};
