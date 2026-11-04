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
      extraFuture: ["Hourly platform APIs (P2)"],
      extra: [r("Order intake mechanism (manual grid, import or API) to be confirmed", "§8.4, §7.13")],
    }),
    pick("operations", "assignments", {
      extra: [
        r("Edits driver-to-client assignments; worker-to-vehicle assignments are edited by the Fleet Manager", ROLES_DOC),
        r("A blocked worker cannot be given assignments or tasks", "decision"),
      ],
    }),
    pick("operations", "schedule", {
      extraFuture: ["Shift recommendation (P2)", "AI-assisted schedule extraction (P2)"],
    }),
    pick("operations", "stores"),
    pick("operations", "imports", {
      extraFuture: ["AI-assisted import (P2)", "Hourly platform APIs (P2)"],
    }),
    pick("operations", "reports", {
      extraFuture: ["Heatmaps (P2)"],
      extra: [
        r("Driver rankings", "§7.8", "p1"),
        r("Day-of-week and week-over-week trend views", "§7.8", "p1"),
      ],
    }),
    pick("operations", "performance", {
      extraFuture: ["Keeta VDA suite (P2)"],
      extra: [
        r("Marketplace operations dashboard: batch distribution, pace against target, KPI alerts", "§7.8", "p1"),
      ],
    }),
    pick("operations", "workers", { readOnlyBy: "HR / Workforce Manager" }),
  ],
};
