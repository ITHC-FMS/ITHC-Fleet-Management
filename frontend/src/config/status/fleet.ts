import { built, type StatusMap } from "./types";

const EMAIL = "Alert is shown in the app only; no email is actually sent in the demo.";

/** Written by the fleet agent: one entry per "<role>/<page>" it built. */
export const fleetStatus: StatusMap = {
  "handover/home": built(),
  "handover/handover": built({
    0: "Running 60 s timer is shown, but the time has not been validated with real desk staff",
    2: "Large single-hand targets only; English-only copy and not tested with desk staff",
    10: "Arabic / RTL not built (English only; logical CSS properties used so it can be added)",
    11: "Prototype is clickable but has not been tested by desk staff",
  }),
  "handover/inspection": built(),
  "handover/offline": built({
    1: "Offline is simulated with a toggle on the page; there is no service worker or real device storage beyond the browser's local storage",
  }),
  "handover/incident": built(),

  "fleet/home": built(),
  "fleet/vehicles": built({
    7: "Paste-CSV import only (no spreadsheet file or driver import); the 260-vehicle day-one migration is not run",
    13: EMAIL,
    15: "Matching leased vehicles to hired drivers with compliance checks belongs to the HR area and is not on this screen",
  }),
  "fleet/lessors": built({
    5: EMAIL,
    7: "Contract documents are recorded by file name and dates only (no real upload); expiry is not wired into the Compliance Watchlist, which is another area",
  }),
  "fleet/locations": built(),
  "fleet/vehicle-assignments": built(),
  "fleet/inspections": built(),
  "fleet/damaged": built(),
  "fleet/jobs": built(),
  "fleet/return": built(),
  "fleet/fuel": built({
    1: "Import is paste-CSV rows only, not a spreadsheet file",
  }),
  "fleet/transport": built({
    4: "Per-contract transport cost is shown, but net labour-supply margin (after housing) is computed in the finance area, not here",
  }),
  "fleet/documents": built({
    0: "Only the file name is stored; the file itself is not uploaded or previewed",
    4: "Documents within 60 days are flagged 'on watchlist' here, but the single Compliance Watchlist is another area",
  }),
  "fleet/utilisation": built(),
  "fleet/desk-users": built({
    7: "Temporary password is simulated: no real email is sent and no password exists",
    8: "A 'must change password' flag is recorded, but first-login enforcement belongs to the platform sign-in area",
  }),

  "admin/vehicles": built({
    8: "Import is an edit action and is hidden in the read-only view by design",
  }),
  "ceo/utilisation": built(),
};
