import { defineCollection } from "@/data/store";
import * as seed from "./seed";
import type {
  BenchRecord, ContactEntry, DocAudit, DocRecord, Escalation, HousingProperty, HousingUnit, Lease, Occupancy, Opportunity,
  PeopleSettings, Placement, Renewal, SeatRequirement, SiteSupervisor, Stay, UserAudit,
} from "./types";

export const properties = defineCollection<HousingProperty>("people.properties", seed.seedProperties);
export const units = defineCollection<HousingUnit>("people.units", seed.seedUnits);
export const leases = defineCollection<Lease>("people.leases", seed.seedLeases);
export const occupancy = defineCollection<Occupancy>("people.occupancy", seed.seedOccupancy);
export const stays = defineCollection<Stay>("people.stays", seed.seedStays);
export const documents = defineCollection<DocRecord>("people.documents", seed.seedDocuments);
export const docAudit = defineCollection<DocAudit>("people.docAudit", seed.seedDocAudit);
export const placements = defineCollection<Placement>("people.placements", seed.seedPlacements);
export const opportunities = defineCollection<Opportunity>("people.opportunities", seed.seedOpportunities);
export const seatRequirements = defineCollection<SeatRequirement>("people.seatRequirements", seed.seedSeatRequirements);
export const contactLog = defineCollection<ContactEntry>("people.contactLog", seed.seedContactLog);
export const renewals = defineCollection<Renewal>("people.renewals", seed.seedRenewals);
export const benchRecords = defineCollection<BenchRecord>("people.bench", seed.seedBench);
export const escalations = defineCollection<Escalation>("people.escalations", seed.seedEscalations);
export const supervisors = defineCollection<SiteSupervisor>("people.supervisors", seed.seedSupervisors);
export const userAudit = defineCollection<UserAudit>("people.userAudit", seed.seedUserAudit);
export const peopleSettings = defineCollection<PeopleSettings>("people.settings", seed.seedSettings);

/** The single settings row. */
export function useSettings(): PeopleSettings {
  const all = peopleSettings.useAll();
  return all[0] ?? seed.seedSettings()[0];
}

export * from "./types";
export * from "./docTypes";
