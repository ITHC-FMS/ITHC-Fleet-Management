import type { DocType, OwnerKind } from "./types";

/** Document type catalogue. tierDays is the reference watchlist tier; the live value comes from PeopleSettings.tiers. */
export const DOC_TYPES: DocType[] = [
  { key: "civil_id", label: "Civil ID", owner: "worker", group: "Identity", expires: true, required: true, tierDays: 30 },
  { key: "driving_licence", label: "Driving licence", owner: "worker", group: "Identity", expires: true, required: false, tierDays: 30 },
  { key: "passport", label: "Passport", owner: "worker", group: "Identity", expires: true, required: true, tierDays: 60 },
  { key: "visa_residency", label: "Visa and residency", owner: "worker", group: "Identity", expires: true, required: true, tierDays: 60 },
  { key: "health_card", label: "Health card", owner: "worker", group: "Identity", expires: true, required: true, tierDays: 60 },
  { key: "employment_contract", label: "Employment contract", owner: "worker", group: "Contract documents", expires: true, required: true, tierDays: 60 },
  { key: "warning", label: "Warning letter", owner: "worker", group: "Contract documents", expires: false, required: false, tierDays: 0 },
  { key: "leave_record", label: "Leave record", owner: "worker", group: "Contract documents", expires: false, required: false, tierDays: 0 },
  { key: "vehicle_registration", label: "Vehicle registration", owner: "vehicle", group: "Vehicle", expires: true, required: true, tierDays: 30 },
  { key: "vehicle_insurance", label: "Insurance", owner: "vehicle", group: "Vehicle", expires: true, required: true, tierDays: 30 },
  { key: "inspection_cert", label: "Inspection certificate", owner: "vehicle", group: "Vehicle", expires: true, required: true, tierDays: 30 },
  { key: "client_contract_doc", label: "Signed client contract", owner: "contract", group: "Client contract", expires: false, required: true, tierDays: 60 },
  { key: "contract_amendment", label: "Contract amendment", owner: "contract", group: "Client contract", expires: false, required: false, tierDays: 0 },
  { key: "lease_agreement", label: "Lease agreement", owner: "property", group: "Lease", expires: true, required: true, tierDays: 60 },
];

export const docType = (key: string) => DOC_TYPES.find((t) => t.key === key);
export const docTypesFor = (kind: OwnerKind) => DOC_TYPES.filter((t) => t.owner === kind);
export const OWNER_LABEL: Record<OwnerKind, string> = { worker: "Worker", vehicle: "Vehicle", contract: "Contract", property: "Property" };
export const OWNER_DEPT: Record<OwnerKind | "stay" | "lease", string> = {
  worker: "HR", vehicle: "Fleet", contract: "Finance", property: "Housing", stay: "Housing", lease: "Housing",
};

export const DEFAULT_TIERS: Record<string, number> = {
  ...Object.fromEntries(DOC_TYPES.filter((t) => t.tierDays > 0).map((t) => [t.key, t.tierDays])),
  stay_contract: 30,
};
/** Rows shown in the tier configuration (every alerting type). */
export const TIER_ROWS: { key: string; label: string }[] = [
  ...DOC_TYPES.filter((t) => t.tierDays > 0).map((t) => ({ key: t.key, label: `${OWNER_LABEL[t.owner]}: ${t.label}` })),
  { key: "stay_contract", label: "Stay contract" },
];
