import type { BizDate } from "@/lib/dates";

/** The seven manager roles Admin may create (the Group CEO and Company Admin are created by the dev team). */
export const MANAGER_ROLES = ["operations", "finance", "payroll", "fleet", "hr", "client", "housing"] as const;
export type ManagerRole = (typeof MANAGER_ROLES)[number];

export const ROLE_LABEL: Record<string, string> = {
  ceo: "Group CEO",
  admin: "Company Admin",
  operations: "Operations Manager",
  finance: "Finance / Commercial Manager",
  payroll: "Payroll Manager",
  fleet: "Fleet Manager",
  hr: "HR / Workforce Manager",
  client: "Client Manager",
  housing: "Housing Manager",
  supervisor: "Site Supervisor",
  handover: "Handover Desk Staff",
  worker: "Worker (Driver)",
};

export interface UserScope {
  employingCompanyIds: string[];
  contractCompanyIds: string[];
  /** Empty list = all clients. */
  clientIds: string[];
}

export interface ManagedUser {
  id: string; // "usr-0003"
  name: string;
  username: string; // fixed after creation
  email: string;
  role: ManagerRole;
  scope: UserScope;
  status: "active" | "offboarded";
  loginActive: boolean;
  mustChangePassword: boolean;
  tempPasswordExpires?: BizDate;
  createdAt: string;
  offboardedAt?: string;
  offboardReason?: string;
  version: number;
}

/** Generic admin audit trail: user, client, role, company and import actions. */
export interface AdminAuditEntry {
  id: string;
  at: string; // "YYYY-MM-DD HH:MM"
  actor: string;
  entity: "user" | "client" | "role" | "company" | "import";
  entityId: string;
  action: string;
  detail: string;
  reason?: string;
}

export interface OutboxEmail {
  id: string;
  to: string;
  recipientRole?: string;
  subject: string;
  body: string;
  kind: "credentials" | "alert" | "reset";
  sentAt: string;
  status: "simulated_sent" | "queued";
}

export interface ClientMeta {
  id: string; // = core client id
  active: boolean;
  type: string;
  linkedSites: string[]; // stores / zones linked where the client model needs them
  deactivatedReason?: string;
  version: number;
}

export interface CompanyProfile {
  id: string; // = core company id
  legalName: string;
  address: string;
  crNo: string;
  phone: string;
  letterheadLine: string;
  footer: string;
  version: number;
}

export type PermLevel = "none" | "view" | "edit" | "approve";
export interface PermissionRow {
  id: string; // module key
  module: string;
  levels: Record<string, PermLevel>; // roleSlug -> level
  version: number;
}
export interface CreationRule {
  id: string; // creator role slug
  creator: string;
  may: string[]; // role slugs this role may create
  how: string;
  version: number;
}

export type AlertDocType =
  | "civil_id" | "licence" | "passport" | "visa" | "health_card"
  | "vehicle_insurance" | "vehicle_registration" | "lessor_contract"
  | "client_contract" | "building_contract" | "stay_contract";

export interface AppNotification {
  id: string;
  recipientRole: string;
  docType: AlertDocType;
  recordKind: "worker" | "vehicle" | "contract" | "lessor" | "building" | "stay";
  recordId: string;
  recordLabel: string;
  expiresOn: BizDate;
  raisedOn: BizDate; // date the tier was reached
  read: boolean;
  emailId?: string;
  link: string;
}

export type AttendanceStatus = "present" | "absent" | "partial";
export interface AttendanceRecord {
  id: string; // `${workerId}|${date}`
  workerId: string;
  locationId: string;
  date: BizDate;
  status: AttendanceStatus;
  minutes: number; // worked minutes (integer)
  recordedBy: string;
  version: number;
}

export interface Shift {
  id: string;
  workerId: string;
  date: BizDate;
  start: string; // "HH:MM"
  end: string;
  clientId: string;
  store: string;
  vehicleId?: string; // pooled car for this shift
  deskId?: string;
}
export interface DedicatedVehicle {
  id: string;
  workerId: string;
  vehicleId: string;
  from: BizDate;
  to: BizDate | null; // inclusive end
}
export interface HandoverAck {
  id: string;
  workerId: string;
  eventId: string; // HandoverEvent reference, e.g. HO-20261109-014
  vehicleId: string;
  date: BizDate;
  kind: "handover" | "inspection";
  summary: string; // e.g. condition or inspection result
  result?: "pass" | "damage_noted";
  acknowledgedAt?: string;
  disputed?: boolean;
  note?: string;
}

export type ImportSheet = "lessor_contracts" | "buildings" | "workers" | "vehicles" | "assignments" | "stays" | "advances";
export interface ImportErrorRow { row: number; key: string; messages: string[]; raw: Record<string, string>; }
export interface ImportJob {
  id: string;
  sheet: ImportSheet;
  fileName: string;
  uploadedAt: string;
  sourceRows: number;
  validRows: number;
  errorRows: number;
  sourceTotal: number; // sum of the money / count column in the source, for reconciliation (fils or count)
  appliedTotal: number;
  status: "validated" | "committed";
  appliedRows: number;
  errors: ImportErrorRow[];
  openingBalances?: number; // fils (advances still owed)
  version: number;
}

export interface AssignmentAuditEntry {
  id: string;
  at: string;
  user: string;
  type: "driver_client" | "driver_vehicle" | "labour_placement" | "housing_occupancy";
  workerId?: string;
  vehicleId?: string;
  clientId?: string;
  change: string;
  reason: string;
  effectiveFrom: BizDate;
  effectiveTo?: BizDate | null;
  payrollPeriod: string; // "2026-10"
  periodClosed: boolean; // the affected payroll period was already closed
  handling?: string; // how a retroactive correction was posted
}
