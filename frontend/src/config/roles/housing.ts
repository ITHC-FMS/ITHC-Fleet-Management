import { accountRequirements, notificationsPage, pick } from "../library";
import { r, type Role } from "../types";

export const housing: Role = {
  slug: "housing",
  title: "Housing Manager",
  count: "1–2 users",
  use: "Properties, building and stay contracts, worker-to-accommodation assignment, occupancy, and site supervisors.",
  layout: "desktop",
  pages: [
    {
      slug: "home",
      title: "Home — Housing Dashboard",
      summary: "Occupancy, vacancy and lease expiries.",
      ref: "§7.1c, §7.1a",
      phase: "phase1",
      requirements: [
        r("Occupancy and vacancy by property", "§7.1c"),
        r("Who lives where", "§7.1c"),
        r("Lease expiries", "§7.1c"),
        r("Worker document expiry for residents, linked to the compliance watchlist", "§7.1a"),
        r("Housing cost per head", "§7.1c"),
      ],
      future: [],
      shell: { kpis: ["Occupied beds", "Vacant beds", "Leases ending ≤60 days", "Cost per head (KD)"] },
    },
    pick("housing", "properties", {
      extra: [r("A building is listed for bed assignment only while its building contract is valid", "decision")],
    }),
    pick("housing", "occupancy"),
    pick("housing", "leases", {
      patch: {
        title: "Building Contracts & Renewals",
        summary: "Building contracts, their periods and renewals.",
      },
      extra: [
        r("Lease expiry feeds the single compliance watchlist", "§7.1a, decision"),
        r("An expired building contract removes the building from the list for new bed assignments; renewal restores it", "decision"),
        r("Residents already housed are handled manually; the Housing Manager is notified in the app and by email", "decision"),
      ],
    }),
    {
      slug: "stays",
      title: "Stay Contracts",
      summary: "Each worker's accommodation stay, with its period and renewals.",
      ref: "§3.7, decision",
      phase: "phase1",
      requirements: [
        r("A stay contract for each worker's accommodation, with start and end dates", "decision"),
        r("Stay contracts are managed and renewed when they run out", "decision"),
        r("Linked to the occupancy ledger and the building", "§7.1c"),
        r("Housing Manager is notified in the app and by email before a stay contract expires", "decision"),
        r("Moving a resident out after expiry is a manual action", "decision"),
        r("Stay documents stored with dates and feeding the Compliance Watchlist", "§7.1a"),
        r("Audit log on every change", "§5.5"),
      ],
      future: [],
      shell: {
        columns: ["Worker", "Property", "Unit", "Stay start", "Stay end", "Days left", "Status"],
        actions: ["New stay", "Renew", "Move out"],
      },
    },
    {
      slug: "supervisors",
      title: "Site Supervisors",
      summary: "Onboard and offboard the supervisors for each site.",
      ref: "Roles doc, p.8, decision",
      phase: "phase1",
      requirements: [
        r("Housing Manager creates and offboards site supervisors", "decision"),
        r("Each supervisor is linked to their own site and sees only that site", "§4"),
        r("Trusted client contacts can be given a supervisor login for their site", "§4"),
        ...accountRequirements("site supervisors"),
      ],
      future: [],
      shell: {
        columns: ["Name", "Username", "Site", "Status"],
        actions: ["Add supervisor", "Change site", "Offboard"],
      },
    },
    notificationsPage("building contracts and worker stay contracts"),
  ],
};
