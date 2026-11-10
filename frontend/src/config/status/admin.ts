import { built, type StatusMap } from "./types";

const DEMO = "demo mode only";
const alertsSeeded = "Alerts are seeded demo data keyed to core ids; they are not generated from the other modules' live records";

/** Written by the admin agent: one entry per "<role>/<page>" it built. */
export const adminStatus: StatusMap = {
  "admin/home": built({ 4: "Links to the Contracts and Documents pages (owned elsewhere); editing and audit happen there, not on this page" }),
  "admin/clients": built({ 3: "Linked stores and zones are free-text names on the client, not linked to the Operations Stores & Zones records" }),
  "admin/users": built({
    7: `Must-change flag is stored and shown (with expiry); enforcement at sign-in needs a real backend (${DEMO})`,
    13: "Data-model rule only; nothing to show on this page",
    14: "Employing company, contract-owning company and client scope are stored per user; nothing in the demo enforces them",
  }),
  "admin/roles": built({
    5: "Desk scoping is described in the scoping tab; not enforced in the demo",
    6: "Site scoping is described in the scoping tab; not enforced in the demo",
    7: "Company scoping is shown per company and per user; not enforced in the demo",
  }),
  "admin/company": built(),
  "admin/assignment-audit": built({ 0: "Seeded entries only; other modules do not yet write assignment changes to this log" }),
  "admin/go-live-import": built({
    1: "CSV upload only (no .xlsx parsing). Only workers and vehicles write to live records; lessor contracts, buildings, stays, assignments and advances are validated and staged but not applied to their modules",
    5: "Opening advance balances are totalled on the load record; not posted to the Advances ledger",
  }),
  "admin/notifications": built({ 3: alertsSeeded }),
  "finance/notifications": built({ 3: alertsSeeded }),
  "fleet/notifications": built({ 3: alertsSeeded }),
  "hr/notifications": built({ 3: alertsSeeded, 7: "Alert links to the worker documents page; the Renew / Block / Terminate choices are not offered from the alert" }),
  "housing/notifications": built({ 3: alertsSeeded }),
  "supervisor/attendance": built({
    3: "Records go to the admin-area attendance collection; the earnings engine and revenue screens are not wired to read it",
    5: "Open question in the spec: there is no capture route for sites without ITHC staff",
  }),
  "supervisor/summary": built({ 4: "Summary exports CSV; the Finance reconciliation screen does not read it yet" }),
  "worker/shift": built({ 5: `Worker sign-in with username and password is ${DEMO}; the demo user is matched to a seeded worker by username or name, otherwise the first driver is shown` }),
  "worker/vehicle": built(),
  "worker/acknowledge": built({
    2: "Acknowledgement is stored with the handover event reference in the admin-area collection; not linked to the Handover area's events",
    3: "English only; Arabic is added later",
  }),
  "platform/rules": built({
    4: "Enforced on Manager Users only; no single place demonstrates it here",
    7: "Email delivery is simulated on Manager Users and Notifications only",
    10: "Version checks exist on the admin edit forms; not demonstrated on this page",
    11: "Audit logs exist on the admin screens; not demonstrated on this page",
    13: "English only; Arabic and RTL come later",
  }),
  "platform/sign-in": built({
    0: `No real password check (${DEMO}); /login is a role picker`,
    1: `Table shows each role's landing page; the /login picker does the landing (${DEMO})`,
    3: `Deactivated accounts cannot be blocked without a real backend (${DEMO})`,
    5: `Temporary-password redirect needs a real backend (${DEMO})`,
  }),
  "platform/forgot-password": built({
    1: `Email verification and choosing a new password need a real backend (${DEMO})`,
    2: `No email is sent (${DEMO})`,
    3: `Needs real accounts and HR manual route (${DEMO})`,
    4: `No reset attempts occur, so none are recorded (${DEMO})`,
  }),
  "platform/first-login": built({
    0: `Not triggered by a real sign-in (${DEMO})`,
    1: `Password cannot be set (${DEMO}); only the strength checks are previewed`,
    2: `Temporary password expiry and single use need a real backend (${DEMO})`,
    3: `No sign-in to continue from (${DEMO})`,
  }),
  "platform/account": built({ 2: `No password exists to change (${DEMO}); the form is shown disabled` }),
  "platform/technical": built({
    5: "Not measured here; recorded by hand in the acceptance gate tracker",
    6: "Not measured here; recorded by hand in the acceptance gate tracker",
    7: "Not measured here; recorded by hand in the acceptance gate tracker",
    8: "Repository process (branch protection, CI); only listed in the gate tracker",
    9: "Documentation deliverables are only listed, not hosted in the app",
  }),
  "platform/roadmap": built(),
};
