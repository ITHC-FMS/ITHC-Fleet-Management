import { DEMO_USERS } from "@/lib/auth";
import type { AdminAuditEntry, ClientMeta, CompanyProfile, CreationRule, ManagedUser, ManagerRole, PermissionRow, PermLevel } from "./types";

const scope = () => ({ employingCompanyIds: ["cmp-ithc"], contractCompanyIds: ["cmp-ithc"], clientIds: [] as string[] });

export const seedManagedUsers = (): ManagedUser[] => {
  const base: ManagedUser[] = (["operations", "finance", "payroll", "fleet", "hr", "client", "housing"] as ManagerRole[]).map((role) => {
    const u = DEMO_USERS[role];
    return {
      id: `usr-${u.username.split("-").pop()}`, name: u.name, username: u.username, email: u.email, role,
      scope: role === "client" ? { ...scope(), clientIds: ["cli-americana", "cli-talabat", "cli-keeta"] } : scope(),
      status: "active", loginActive: true, mustChangePassword: false, createdAt: "2026-02-02 09:00", version: 1,
    };
  });
  return [
    ...base,
    { id: "usr-0101", name: "Noor Al-Qattan", username: "noor.alqattan-0101", email: "noor.alqattan@ithc.example", role: "hr", scope: scope(), status: "active", loginActive: true, mustChangePassword: true, tempPasswordExpires: "2026-11-11", createdAt: "2026-11-08 10:12", version: 1 },
    { id: "usr-0102", name: "Hessa Al-Otaibi", username: "hessa.alotaibi-0102", email: "hessa.alotaibi@ithc.example", role: "finance", scope: scope(), status: "active", loginActive: true, mustChangePassword: true, tempPasswordExpires: "2026-11-02", createdAt: "2026-10-30 14:40", version: 1 },
    { id: "usr-0103", name: "Yousef Al-Mazidi", username: "yousef.almazidi-0103", email: "yousef.almazidi@ithc.example", role: "operations", scope: scope(), status: "offboarded", loginActive: false, mustChangePassword: false, createdAt: "2026-03-10 09:30", offboardedAt: "2026-09-30 16:05", offboardReason: "Resigned; last working day 30 Sep", version: 3 },
  ];
};

export const seedAdminAudit = (): AdminAuditEntry[] => [
  { id: "aud-0001", at: "2026-02-02 09:00", actor: "Dev team", entity: "user", entityId: "usr-0002", action: "Account created", detail: "Company Admin created by the dev team on day one" },
  { id: "aud-0002", at: "2026-03-10 09:30", actor: "Mariam Al-Hajri", entity: "user", entityId: "usr-0103", action: "Account created", detail: "yousef.almazidi-0103 as Operations Manager; temporary password emailed" },
  { id: "aud-0003", at: "2026-09-30 16:05", actor: "Mariam Al-Hajri", entity: "user", entityId: "usr-0103", action: "Offboarded", detail: "Login deactivated automatically", reason: "Resigned; last working day 30 Sep" },
  { id: "aud-0004", at: "2026-10-30 14:40", actor: "Mariam Al-Hajri", entity: "user", entityId: "usr-0102", action: "Account created", detail: "hessa.alotaibi-0102 as Finance / Commercial Manager; temporary password emailed" },
  { id: "aud-0005", at: "2026-11-08 10:12", actor: "Mariam Al-Hajri", entity: "user", entityId: "usr-0101", action: "Account created", detail: "noor.alqattan-0101 as HR / Workforce Manager; temporary password emailed" },
  { id: "aud-0006", at: "2026-06-14 11:20", actor: "Mariam Al-Hajri", entity: "client", entityId: "cli-bean", action: "Client edited", detail: "Legal entity name corrected to Bean & Brew Trading", reason: "Invoice rejected: name did not match trade licence" },
  { id: "aud-0007", at: "2026-08-03 08:45", actor: "Mariam Al-Hajri", entity: "role", entityId: "attendance", action: "Permission changed", detail: "Attendance: Client Manager none -> view", reason: "Client Manager reviews hourly attendance before invoicing" },
];

export const seedClientMeta = (): ClientMeta[] => [
  { id: "cli-americana", active: true, type: "Store-based", linkedSites: ["Salmiya Hub", "Hawally Store", "Farwaniya Store", "Zone North"], version: 1 },
  { id: "cli-talabat", active: true, type: "Marketplace", linkedSites: ["Zone Hawally", "Zone Salmiya"], version: 1 },
  { id: "cli-keeta", active: true, type: "Marketplace", linkedSites: [], version: 1 },
  { id: "cli-alshaya", active: true, type: "Labour supply", linkedSites: ["Alshaya DC — Amghara"], version: 1 },
  { id: "cli-bean", active: true, type: "Labour supply (hourly)", linkedSites: ["Avenues Mall"], version: 2 },
];

export const seedCompanyProfiles = (): CompanyProfile[] => [
  { id: "cmp-ithc", legalName: "ITHC Logistics Co. W.L.L.", address: "Shuwaikh Industrial, Block 2, Kuwait", crNo: "CR-311842", phone: "+965 2481 0000", letterheadLine: "ITHC Logistics Co. W.L.L. | Fleet, Labour and Delivery Services", footer: "Shuwaikh Industrial, Block 2, Kuwait | CR 311842 | info@ithc.example", version: 1 },
  { id: "cmp-maxdash", legalName: "Max Dash General Trading", address: "Kuwait City", crNo: "External lessor", phone: "-", letterheadLine: "", footer: "", version: 1 },
  { id: "cmp-swiftlink", legalName: "Swift Link Vehicle Rental", address: "Kuwait City", crNo: "External lessor", phone: "-", letterheadLine: "", footer: "", version: 1 },
];

export const PERM_ROLES = ["ceo", "admin", "operations", "finance", "payroll", "fleet", "hr", "client", "housing", "supervisor", "handover", "worker"] as const;
const L: Record<string, PermLevel> = { n: "none", v: "view", e: "edit", a: "approve" };
const row = (id: string, module: string, codes: string): PermissionRow => ({
  id, module, version: 1,
  levels: Object.fromEntries(PERM_ROLES.map((r, i) => [r, L[codes[i]]])),
});
export const seedPermissions = (): PermissionRow[] => [
  row("workers", "Workers", "vvvnvnevnnnn"),
  row("assignments", "Assignments", "vvenvevvnnvn"),
  row("vehicles", "Vehicles", "vvvvnevnnnvv"),
  row("lessors", "Lessors and lessor contracts", "vnnvnannnnnn"),
  row("contracts", "Client contracts and rates", "vevavnnvnnnn"),
  row("revenue", "Revenue engine", "vnvennnvnnnn"),
  row("payroll", "Payroll run", "vnvvanvnnnnn"),
  row("payparams", "Pay parameters", "vnnnenvnnnnn"),
  row("advances", "Advances and deductions", "vnvnenvnnnnn"),
  row("workerdocs", "Worker documents", "vennnnennnnn"),
  row("vehicledocs", "Vehicle documents", "vennnennnnnn"),
  row("watchlist", "Compliance watchlist", "vvnvnvvnvnnn"),
  row("housing", "Housing, stays and supervisors", "vvnnnnvnennn"),
  row("handover", "Handover and inspections", "vvvnnennnnev"),
  row("attendance", "Attendance", "vvvvvnvvvenn"),
  row("audit", "Audit log", "vvnnnnnnnnnn"),
  row("users", "Users and roles", "vannnnnnnnnn"),
  row("notifications", "Notifications", "veeeeeeeeenn"),
];

export const seedCreationRules = (): CreationRule[] => [
  { id: "admin", creator: "admin", may: ["operations", "finance", "payroll", "fleet", "hr", "client", "housing"], how: "Manager accounts on the Manager Users page", version: 1 },
  { id: "hr", creator: "hr", may: ["worker"], how: "Worker logins at onboarding", version: 1 },
  { id: "fleet", creator: "fleet", may: ["handover"], how: "Handover desk users on the Desk Users page", version: 1 },
  { id: "housing", creator: "housing", may: ["supervisor"], how: "Site supervisors on the Site Supervisors page", version: 1 },
];
