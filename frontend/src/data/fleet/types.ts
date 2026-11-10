import type { AssignmentMode, OwnershipType } from "@/data/entities";
import type { BizDate } from "@/lib/dates";
import type { Fils } from "@/lib/money";

/** Timestamps are local business time "YYYY-MM-DDTHH:mm" (Asia/Kuwait), same convention as BizDate. */
export type Stamp = string;

export type Grade = "ok" | "minor" | "major";
export interface Photo { name: string; thumb?: string }
export interface ChecklistItem { key: string; label: string; grade: Grade; note?: string }
export type InspectionResult = "pass" | "minor" | "fail";
export type SyncState = "synced" | "queued" | "syncing" | "failed" | "held";

export interface HandoverEvent {
  id: string;
  direction: "issue" | "return";
  vehicleId: string;
  driverId: string;
  deskId: string;
  at: Stamp;
  operatorId: string;
  operatorName: string;
  odometerKm: number;
  /** Fuel gauge in eighths, 0 (empty) to 8 (full). */
  fuelEighths: number;
  inspectionId?: string;
  inspectionResult: InspectionResult;
  photos: Photo[];
  notes: string;
  mode: AssignmentMode;
  durationSec?: number;
  sync: SyncState;
  queuedAt?: Stamp;
  /** Vehicle version the desk saw when the event was recorded offline (optimistic locking). */
  vehicleVersionSeen?: number;
  conflict?: string;
  syncedAt?: Stamp;
}

export interface Inspection {
  id: string;
  handoverId: string;
  vehicleId: string;
  driverId: string;
  deskId: string;
  at: Stamp;
  operatorName: string;
  items: ChecklistItem[];
  result: InspectionResult;
  photos: Photo[];
  incidentId?: string;
}

export type IncidentStatus = "routed" | "received" | "in_service" | "closed";
export interface Incident {
  id: string;
  vehicleId: string;
  handoverId?: string;
  driverId?: string;
  deskId: string;
  at: Stamp;
  kind: "damage" | "accident";
  severity: "minor" | "major" | "total_loss";
  description: string;
  assessment: string;
  photos: Photo[];
  replacementVehicleId?: string;
  replacementHandoverId?: string;
  status: IncidentStatus;
  receivedOn?: BizDate;
  serviceJobId?: string;
  attributedTo?: "driver" | "previous_driver" | "third_party" | "wear" | "undetermined";
  attributionNote?: string;
  reassignedNote?: string;
  recordedBy: string;
  version: number;
}

export interface ServiceJob {
  id: string;
  vehicleId: string;
  incidentId?: string;
  source: "damaged" | "accident";
  opened: BizDate;
  work: string;
  costFils: Fils;
  expectedReturn: BizDate;
  completedOn?: BizDate;
  returnedOn?: BizDate;
  replacementVehicleId?: string;
  status: "open" | "completed" | "returned";
  version: number;
}

export interface FuelTransaction {
  id: string;
  date: BizDate;
  vehicleId: string;
  driverId?: string;
  handoverId?: string;
  litres: number;
  costFils: Fils;
  odometerKm?: number;
  station: string;
  source: "card" | "import" | "manual";
  reviewNote?: string;
}

export interface TransportRoute {
  id: string;
  name: string;
  fromLocationId: string;
  toLocationId: string;
  vehicleId: string;
  driverId: string;
  contractId: string;
  departs: string; // "HH:mm"
  durationMin: number;
  days: string;
  heads: number;
  driverCostFils: Fils; // monthly
  fuelCostFils: Fils;   // monthly
  status: "active" | "draft" | "suspended";
  version: number;
}

export interface VehicleAssignment {
  id: string;
  vehicleId: string;
  workerId: string;
  from: BizDate;
  /** Inclusive end; null = open ended. */
  to: BizDate | null;
  source: "manual" | "handover" | "fleet_reassign";
  handoverId?: string;
  avgDailyHours?: number;
  note?: string;
  version: number;
}

export interface LessorContract {
  id: string;
  lessorId: string; // companies id (kind lessor)
  contractNo: string;
  contractVersion: number;
  start: BizDate;
  end: BizDate;
  terms: string;
  renewalOfId?: string;
  status: "active" | "superseded";
  documents: { name: string; type: string; issued: BizDate; expires: BizDate }[];
  version: number;
}

/** Which lessor contract a rented vehicle is on. id = vehicle id. */
export interface LeaseLink { id: string; contractId: string }

/** Cost schedule per vehicle. id = vehicle id. Fields used depend on the ownership type. */
export interface CostSchedule {
  id: string;
  ownership: OwnershipType;
  monthlyCharge?: Fils;   // rented
  returnConditions?: string; // rented
  purchasePrice?: Fils;   // cash
  residual?: Fils;        // cash
  lifeMonths?: number;    // cash
  deposit?: Fils;         // financed
  instalment?: Fils;      // financed
  termMonths?: number;    // financed
}

export type DocType = "registration" | "insurance" | "inspection_cert" | "lease";
export interface VehicleDocument {
  id: string;
  vehicleId: string;
  type: DocType;
  issued: BizDate;
  expires: BizDate;
  authority: string;
  docVersion: number;
  supersedesId?: string;
  status: "current" | "superseded";
  fileName: string;
  uploadedBy: string;
  uploadedAt: Stamp;
}

export interface DeskUser {
  id: string;
  name: string;
  username: string;
  email: string;
  deskId: string;
  role: "desk_operator" | "desk_lead";
  status: "active" | "offboarded";
  mustChangePassword: boolean;
  createdAt: Stamp;
  offboardedAt?: Stamp;
  version: number;
}

export interface AuditEntry {
  id: string;
  at: Stamp;
  actor: string;
  entity: string;
  entityId: string;
  action: string;
  detail: string;
  reason?: string;
}
