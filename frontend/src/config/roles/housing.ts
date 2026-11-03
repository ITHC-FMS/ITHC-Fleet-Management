import { pick } from "../library";
import { r, type Role } from "../types";

export const housing: Role = {
  slug: "housing",
  title: "Housing Manager",
  count: "1–2 users",
  use: "Properties, leases, worker-to-accommodation assignment and occupancy.",
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
    pick("housing", "properties"),
    pick("housing", "occupancy"),
    pick("housing", "leases", {
      extra: [r("Lease expiry feeds the single compliance watchlist", "§7.1a, decision")],
    }),
  ],
};
