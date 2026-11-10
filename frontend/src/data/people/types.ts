import type { BizDate } from "@/lib/dates";
import type { Fils } from "@/lib/money";

/** Entities owned by the people area. Core ids (workers, contracts, clients, locations, vehicles) are referenced by id. */

export interface HousingProperty {
  id: string;            // "hp-0001"
  locationId: string;    // core Location (kind housing)
  name: string;
  address: string;
  landlord: string;
  version: number;
}

export interface HousingUnit {
  id: string;            // "hu-0001"
  propertyId: string;
  unitNo: string;
  beds: number;          // capacity
  note?: string;
}

/** A lease document period for a property. Renewal supersedes; old versions retained. */
export interface Lease {
  id: string;            // "ls-0001"
  propertyId: string;
  leaseNo: string;
  landlord: string;
  start: BizDate;
  end: BizDate;
  monthlyCost: Fils;
  status: "current" | "superseded";
  version: number;
  supersedesId?: string;
  documentId?: string;
}

/** HousingOccupancy: date-ranged bed assignment. End date inclusive, null = still living there. */
export interface Occupancy {
  id: string;            // "occ-0001"
  workerId: string;      // "" for a guest
  guestName?: string;
  propertyId: string;
  unitId: string;
  bed: number;
  moveIn: BizDate;
  moveOut: BizDate | null;
  stayId?: string;
  note?: string;
}

/** Stay contract: worker (or guest) accommodation period. */
export interface Stay {
  id: string;            // "stay-0001"
  kind: "worker" | "guest";
  workerId?: string;
  guestName?: string;
  guestSponsor?: string;
  propertyId: string;
  unitId: string;
  start: BizDate;
  end: BizDate;
  status: "active" | "ended";
  renewedFromId?: string;
  fileName?: string;     // stay document (name only in the demo)
  version: number;
}

export type OwnerKind = "worker" | "vehicle" | "contract" | "property";

export interface DocType {
  key: string;
  label: string;
  owner: OwnerKind;
  group: string;
  expires: boolean;
  /** Required for the owner to be "complete"; absent = missing alert. */
  required: boolean;
  /** Reference watchlist tier in days. */
  tierDays: number;
}

export interface DocRecord {
  id: string;            // "doc-0001"
  ownerKind: OwnerKind;
  ownerId: string;
  typeKey: string;
  issueDate: BizDate | null;
  expiryDate: BizDate | null;
  authority: string;
  fileName: string;
  fileSize: number;
  mime: string;
  dataUrl?: string;      // only for small uploads
  version: number;
  status: "current" | "superseded";
  supersededById?: string;
  uploadedBy: string;
  uploadedAt: BizDate;
  notes?: string;
}

export interface DocAudit { id: string; docId: string; at: string; by: string; action: string; reason?: string; }

export interface Placement {
  id: string;            // "plc-0001"
  workerId: string;
  clientId: string;
  contractId: string;
  siteLocationId: string;
  from: BizDate;
  to: BizDate | null;    // inclusive
  version: number;
}

export type Stage = "lead" | "proposal" | "negotiation" | "signed" | "lost";
export interface Opportunity {
  id: string;            // "opp-0001"
  clientId: string;      // core client id, or "" for a prospect
  prospectName?: string;
  contractType: "fixed_labour" | "hourly";
  heads: number;
  revenuePerHead: Fils;  // per head per month
  breakEvenPerHead: Fils;
  startDate: BizDate;
  stage: Stage;
  owner: string;
  approval: "none" | "requested" | "approved";
  approvalRef?: string;
  approvalDate?: BizDate;
  lastEscalated?: BizDate;
  convertedContractId?: string;
  notes?: string;
  version: number;
}

export interface SeatRequirement {
  id: string;            // "seat-0001"
  contractId: string;
  from: BizDate;
  to: BizDate;
  heads: number;
  volumeFloor: number;   // client minimum heads
  note?: string;
}

export interface ContactEntry {
  id: string;            // "cl-0001"
  date: BizDate;
  clientId: string;
  contractId: string;
  type: "visit" | "call" | "meeting" | "email";
  contactPerson: string;
  outcome: string;
  loggedBy: string;
}

export interface Renewal {
  id: string;            // "ren-0001"
  contractId: string;
  status: "upcoming" | "in_talks" | "renewed" | "lost";
  note?: string;
  financeNotifiedOn?: BizDate;
}

export interface BenchRecord { id: string; workerId: string; since: BizDate; reason: string; }

export interface Escalation {
  id: string;            // "esc-0001"
  kind: "seat_floor" | "gate_low" | "gate_approval";
  refId: string;
  date: BizDate;
  note: string;
  by: string;
}

export interface SiteSupervisor {
  id: string;            // "sup-0001"
  name: string;
  email: string;
  username: string;
  roleLabel: string;
  siteLocationId: string;
  clientId?: string;     // trusted client contact
  status: "active" | "offboarded";
  loginActive: boolean;
  mustChangePassword: boolean;
  createdOn: BizDate;
  offboardedOn?: BizDate;
  version: number;
}

export interface UserAudit { id: string; at: string; by: string; subjectId: string; action: string; detail: string; }

export interface PeopleSettings {
  id: string;            // "cfg-people"
  /** Alert lead days per doc type key (configurable tiers). */
  tiers: Record<string, number>;
  /** Contract economics gate thresholds in hundredths: 200 = 2.0x. */
  gateApprovalX100: number;
  gateEscalateX100: number;
  seatTargetPct: number;
  benchMinPct: number;
  benchMaxPct: number;
  contactLimitDays: number;
  contactWarnDays: number;
  /** Monthly carrying cost components in fils. */
  foodMonthly: Fils;
  insuranceMonthly: Fils;
  permitTotal: Fils;
  permitMonths: number;
  includeBasePay: boolean;
  /** Typical break-even cost per head per month by contract type (fils). */
  breakEven: Record<string, Fils>;
  version: number;
}
