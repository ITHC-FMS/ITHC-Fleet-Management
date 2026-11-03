import { r, type Role } from "../types";

export const fleet: Role = {
  slug: "fleet",
  title: "Fleet / Service Team",
  count: "Small team",
  use: "Receives damaged vehicles, records service and return-to-fleet.",
  layout: "tablet",
  pages: [
    {
      slug: "damaged",
      title: "Damaged Vehicles",
      summary: "Vehicles routed from handover after damage or an accident.",
      ref: "§7.4",
      phase: "phase1",
      requirements: [
        r("Receive vehicles routed from an incident", "§7.4"),
        r("Show incident, handover event, damage assessment and photographs", "§5.3"),
        r("Vehicle is off the available pool while here", "§7.4"),
      ],
      future: [],
      shell: { columns: ["Vehicle", "Incident", "Received", "Damage", "Replacement issued"] },
    },
    {
      slug: "jobs",
      title: "Service Jobs",
      summary: "Work performed and cost.",
      ref: "§5.3, §7.4",
      phase: "phase1",
      requirements: [
        r("ServiceJob: vehicle out of service, work performed, cost, return-to-fleet date", "§5.3"),
        r("Service job tracked to completion", "§7.4"),
        r("Service cost feeds Cost per vehicle", "§5.3"),
      ],
      future: [],
      shell: { columns: ["Vehicle", "Work", "Cost (KD)", "Opened", "Return date", "Status"], actions: ["New service job"] },
    },
    {
      slug: "return",
      title: "Return to Fleet",
      summary: "Service complete; vehicle returns to the pool.",
      ref: "§7.4",
      phase: "phase1",
      requirements: [
        r("Vehicle returns to the pool when the service job completes", "§7.4"),
        r("Vehicle status moves from under repair to in service", "§5.3"),
        r("Return recorded with date", "§5.3"),
      ],
      future: [],
      shell: { columns: ["Vehicle", "Service job", "Completed", "Home desk"], actions: ["Return to fleet"] },
    },
  ],
};
