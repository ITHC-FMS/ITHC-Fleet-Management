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
        r("A job starts from a damaged-vehicle record or an accident in service", "§7.4"),
        r("The vehicle's status is under repair while the job is open", "§5.3"),
        r("Any replacement vehicle issued is recorded against the job", "§7.4"),
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
        r("The vehicle goes back to the pool of its home desk", "§7.2"),
        r("A leased vehicle returns to the assignable list only while its lessor contract is valid", "decision"),
        r("Audit log on the status change", "§5.5"),
      ],
      future: [],
      shell: { columns: ["Vehicle", "Service job", "Completed", "Home desk"], actions: ["Return to fleet"] },
    },
  ],
};
