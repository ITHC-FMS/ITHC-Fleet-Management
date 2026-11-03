import { pick } from "../library";
import { r, type Role } from "../types";

export const client: Role = {
  slug: "client",
  title: "Client & Deployment Manager",
  count: "1 user",
  use: "Keeps contracts staffed and the bench small. Reports seats; does not approve contracts.",
  layout: "desktop",
  pages: [
    {
      slug: "home",
      title: "Home — Deployment Dashboard",
      summary: "Seat-fill, bench and pipeline at a glance.",
      ref: "§7.14",
      phase: "p1",
      requirements: [
        r("Seat-fill per contract (target 95%) and gaps against client minimums", "§7.14", "p1"),
        r("Bench size and cost (target 10–15%)", "§7.14", "p1"),
        r("Pipeline in seats", "§7.14", "p1"),
        r("Renewal calendar", "§7.14", "p1"),
        r("Loss-making worker list", "§7.14", "p1"),
        r("Contract economics gate alerts", "§7.14", "p1"),
      ],
      future: [],
      shell: { kpis: ["Seat-fill", "Bench %", "Open seats", "Gate alerts"] },
    },
    pick("client", "placements"),
    pick("client", "pipeline", {
      extra: [
        r("Mark an opportunity as signed; it is handed to Finance to create the contract", "§5.4, decision", "p1"),
        r("Request written approval from the Group CEO below 2.0×", "§7.14, decision", "p1"),
      ],
    }),
    pick("client", "seat-fill"),
    pick("client", "bench"),
    pick("client", "contact-log"),
    pick("client", "renewals"),
    pick("principal", "loss-making"),
  ],
};
