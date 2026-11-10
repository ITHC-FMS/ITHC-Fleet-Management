import { defineCollection } from "@/data/store";
import { fleetSeed } from "./seed";
import type {
  AuditEntry, CostSchedule, DeskUser, FuelTransaction, HandoverEvent, Incident, Inspection, LeaseLink, LessorContract, ServiceJob,
  TransportRoute, VehicleAssignment, VehicleDocument,
} from "./types";
import { nowStamp } from "./time";

export const handoverEvents = defineCollection<HandoverEvent>("fleet_handover_events", () => fleetSeed().events);
export const inspections = defineCollection<Inspection>("fleet_inspections", () => fleetSeed().inspections);
export const incidents = defineCollection<Incident>("fleet_incidents", () => fleetSeed().incidents);
export const serviceJobs = defineCollection<ServiceJob>("fleet_service_jobs", () => fleetSeed().jobs);
export const fuelTxns = defineCollection<FuelTransaction>("fleet_fuel", () => fleetSeed().fuel);
export const transportRoutes = defineCollection<TransportRoute>("fleet_transport_routes", () => fleetSeed().routes);
export const vehicleAssignments = defineCollection<VehicleAssignment>("fleet_vehicle_assignments", () => fleetSeed().assignments);
export const lessorContracts = defineCollection<LessorContract>("fleet_lessor_contracts", () => fleetSeed().contracts);
export const leaseLinks = defineCollection<LeaseLink>("fleet_lease_links", () => fleetSeed().leases);
export const costSchedules = defineCollection<CostSchedule>("fleet_cost_schedules", () => fleetSeed().schedules);
export const vehicleDocs = defineCollection<VehicleDocument>("fleet_vehicle_docs", () => fleetSeed().docs);
export const deskUsers = defineCollection<DeskUser>("fleet_desk_users", () => fleetSeed().deskUsers);
export const fleetAudit = defineCollection<AuditEntry>("fleet_audit", () => fleetSeed().audit);

/** Append an audit entry. Call from event handlers only. */
export async function logAudit(actor: string, entity: string, entityId: string, action: string, detail: string, reason?: string) {
  const id = `aud-${String(Date.now()).slice(-9)}${Math.floor(Math.random() * 90 + 10)}`;
  await fleetAudit.save({ id, at: nowStamp(), actor, entity, entityId, action, detail, reason });
}

export * from "./types";
export * from "./rules";
export * from "./time";
export * from "./checklist";
