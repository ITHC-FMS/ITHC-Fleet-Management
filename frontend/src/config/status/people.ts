import { built, type StatusMap } from "./types";

const EMAIL = "Email delivery and the notification centre are not simulated";

/** Written by the people agent: one entry per "<role>/<page>" it built. */
export const peopleStatus: StatusMap = {
  "housing/home": built({
    3: "Resident expiries are listed from the same derived data as the watchlist, but there is no link to a watchlist page (the Housing role has none)",
  }),
  "housing/properties": built({
    1: "Lease documents are managed on the Leases page; the property detail shows lease dates and cost but does not list the documents",
  }),
  "housing/occupancy": built({
    4: "Cost per head is shown per resident and in the CSV export; nothing feeds margin reports, which belong to another area",
    5: "No link to accommodation pay status in the earnings engine (payroll area)",
  }),
  "housing/leases": built({
    5: "Housing Manager is told through an in-app banner on this page only; " + EMAIL,
  }),
  "housing/stays": built({
    3: "Expiring and lapsed stays are flagged on this page only; " + EMAIL,
    5: "Stay end dates feed the watchlist, but the stay document stores only a file name, not a versioned file",
  }),
  "housing/supervisors": built({
    1: "Each supervisor is linked to one site, but the 'sees only that site' scoping is enforced by the supervisor screens, not here",
    6: "The temporary password is not generated or stored; the email is simulated by a confirmation message",
    7: "The must-change-password flag is recorded; enforcement belongs to the first-login flow",
  }),
  "hr/home": built({
    3: "Hires needed are estimated from leased vehicles against compliant drivers; there is no link to real vehicle assignments (Fleet area)",
  }),
  "hr/documents": built(),
  "hr/watchlist": built({
    1: "HR sees worker items only (scoped view); vehicle, contract and building items are on the Admin watchlist, and lessor contracts are not included",
    4: "Links to Fleet, Finance and Housing appear on the Admin view; HR's scoped view has none",
    5: "Notification centre and email alerts are not part of this screen",
    6: "Owner department is shown per item, but no notification is sent",
  }),
  "admin/documents": built(),
  "admin/watchlist": built({
    2: "Lessor contracts are not included (lessor data belongs to the Fleet area); worker, vehicle, client contract, building contract and stay items are",
    6: "Notification centre and email alerts are not part of this screen",
    7: "Owner department is shown per item, but no notification is sent",
  }),
  "client/home": built({
    4: "Loss-making list is a local estimate (placement revenue against carrying cost); it does not read the margin-per-worker report",
  }),
  "client/placements": built({
    4: "Role-to-module mapping is shown as an informational note; it does not switch modules on or off",
  }),
  "client/pipeline": built({
    7: "The approval request is recorded here and the written approval reference is entered by hand; there is no approval screen on the Group CEO side",
  }),
  "client/seat-fill": built(),
  "client/bench": built(),
  "client/contact-log": built({
    2: "Contracts without contact in 30 days are flagged on this page; the principal's own contact log (another area) does not read this flag",
  }),
  "client/renewals": built({
    4: "'Notify Finance' stamps a date on the renewal; " + EMAIL,
  }),
};
