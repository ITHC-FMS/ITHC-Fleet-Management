import { built, type StatusMap } from "./types";

const AUDIT_NOTES = {
  1: "Live entries are written only by commercial screens (contracts, approvals, revenue, cash, costs, stores). Compensation and assignment changes from other areas appear as seeded examples; other areas do not write to this log yet.",
  4: "Payroll reopen reasons are seeded examples only; the payroll area does not write to this log yet.",
};
const CONTRACT_NOTES = {
  1: "Rates are fully editable through new versions, but the five pricing models are a fixed list in the core types; a brand-new contract type cannot be added without a code change.",
  2: "Keeta VDA suite is P2 and not built; Keeta uses the bulk model as a draft contract.",
};

export const commercialStatus: StatusMap = {
  "ceo/home": built({
    3: "Utilisation tile is a proxy (vehicles with an active driver); real used-versus-available hours live on the utilisation page.",
    9: "Dashboard shows three-month P&L bars only; daily P&L and vehicle TCO are on their own pages, no TCO tile here.",
  }),
  "ceo/approvals": built({
    2: "Items below the escalation threshold are flagged and aged on screen; no scheduled weekly escalation message is sent.",
    5: "Finance can request approval from Signed Opportunities; the Client & Deployment request action belongs to the client pipeline page, not built here.",
  }),
  "ceo/margin": built(),
  "ceo/group-pnl": built(),
  "ceo/vehicle-tco": built(),
  "ceo/loss-making": built(),
  "ceo/contact-log": built(),
  "ceo/audit-log": built(AUDIT_NOTES),
  "ceo/all-modules": built(),
  "finance/home": built(),
  "finance/contracts": built({
    ...CONTRACT_NOTES,
    13: "Expiry banner on the page only; no in-app notification record or email is created (notifications are a separate page).",
  }),
  "finance/signed": built(),
  "finance/revenue": built({
    2: "Prorated head-months are seeded values; they are not computed from supervisor attendance records.",
    3: "Hours are seeded values; they are not computed from supervisor attendance records.",
  }),
  "finance/cash": built({
    2: "Shortfall is queued as a deduction on the cash row (visible here); the Payroll Run screen does not read this queue yet.",
  }),
  "finance/reconciliation": built({
    3: "Attendance summary is per client and month from the seeded revenue transactions, not per site from supervisor attendance.",
  }),
  "finance/costs": built(),
  "finance/documents": built({
    3: "Expiry dates are shown with expiring/expired badges here, but nothing is pushed to the Compliance Watchlist screen.",
  }),
  "admin/contracts": built(CONTRACT_NOTES),
  "admin/audit-log": built(AUDIT_NOTES),
  "operations/stores": built({
    1: "Stores and zones are maintained here; the schedule screen does not yet read them to schedule drivers against stores.",
    3: "Order entry and schedule do not yet read this store and zone list (separate areas).",
  }),
  "client/loss-making": built(),
};
