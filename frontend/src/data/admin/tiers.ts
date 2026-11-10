import type { AlertDocType } from "./types";

/** Alert tiers (days before expiry), mirroring the Compliance Watchlist reference tiers. Configurable in one place. */
export const TIER_DAYS: Record<AlertDocType, number> = {
  civil_id: 30, licence: 30, passport: 60, visa: 60, health_card: 60,
  vehicle_insurance: 30, vehicle_registration: 30, lessor_contract: 60,
  client_contract: 60, building_contract: 60, stay_contract: 30,
};
export const DOC_LABEL: Record<AlertDocType, string> = {
  civil_id: "Civil ID", licence: "Driving licence", passport: "Passport", visa: "Residence visa", health_card: "Health card",
  vehicle_insurance: "Vehicle insurance", vehicle_registration: "Vehicle registration", lessor_contract: "Lessor contract",
  client_contract: "Client contract", building_contract: "Building contract", stay_contract: "Stay contract",
};
/** Who owns (and is notified about) each kind of expiring record. */
export const OWNER_ROLE: Record<AlertDocType, string> = {
  civil_id: "hr", licence: "hr", passport: "hr", visa: "hr", health_card: "hr",
  vehicle_insurance: "fleet", vehicle_registration: "fleet", lessor_contract: "fleet",
  client_contract: "finance", building_contract: "housing", stay_contract: "housing",
};
export const NOTIFICATION_ROLES = ["admin", "finance", "fleet", "hr", "housing"] as const;
