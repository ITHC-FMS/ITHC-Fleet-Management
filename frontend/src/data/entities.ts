import type { BizDate } from "@/lib/dates";
import type { Fils } from "@/lib/money";

/** Core entities shared by every area. Area-specific entities live in `data/<area>/`. */

export type WorkerRole = "driver" | "picker" | "warehouse" | "security" | "barista" | "handover" | "service" | "admin";
export type WorkerStatus =
  | "active" | "training" | "probation" | "accommodation" | "sick_leave" | "annual_leave"
  | "absconded" | "terminated" | "inactive" | "blocked" | "standby";

export interface Worker {
  id: string;            // "wrk-0001"
  username: string;      // "ahmed.ali-0042"
  name: string;
  nationality: string;
  roles: WorkerRole[];
  status: WorkerStatus;
  employingCompany: string;      // company id
  joiningDate: BizDate;
  phone: string;
  civilId?: string;              // optional at creation (spec 5.2)
  passportNo?: string;
  licenceNo?: string;            // driver role only
  riderId?: string;              // platform rider id (driver role)
  vehicleTypes?: ("car" | "bike")[];
  baseSalary: Fils;
  overtimeComponent: Fils;
  currentClientId?: string;
  currentLocationId?: string;    // placement site
  housingLocationId?: string;
  batch?: string;                // marketplace performance band
  version: number;               // optimistic locking
}

export interface Company { id: string; name: string; kind: "operating" | "lessor"; }

export interface Client { id: string; name: string; legalName: string; model: string; contactName: string; contactPhone: string; }

export type PricingModel = "order_based" | "fixed_labour" | "hourly" | "bulk" | "marketplace_batched";

/** One rate line inside a contract version; configuration-driven, never hard-coded. */
export interface RateLine { key: string; label: string; unit: string; amount: Fils; }

export interface Contract {
  id: string;                    // "con-0001"
  contractNo: string;            // stable across versions
  version: number;
  clientId: string;
  ownerCompanyId: string;
  pricingModel: PricingModel;
  validFrom: BizDate;
  validTo: BizDate | null;
  seatsContracted?: number;
  volumeFloor?: number;
  rates: RateLine[];
  status: "draft" | "active" | "superseded" | "expired";
}

export type LocationKind = "operating_building" | "handover_desk" | "housing" | "client_site" | "service_centre";
export interface Location { id: string; name: string; kind: LocationKind; address: string; monthlyCost?: Fils; }

export type OwnershipType = "rented" | "cash" | "financed";
export type AssignmentMode = "pooled" | "dedicated" | "transport";
export type VehicleStatus = "in_service" | "under_repair" | "off_fleet";
export interface Vehicle {
  id: string;                    // "veh-0001"
  plate: string;
  type: "car" | "bike" | "transport";
  make: string;
  model: string;
  year: number;
  ownership: OwnershipType;
  mode: AssignmentMode;
  homeLocationId: string;
  status: VehicleStatus;
  monthlyCost: Fils;             // common-basis monthly cost
  odometerKm: number;
  lessor?: string;
  version: number;
}
