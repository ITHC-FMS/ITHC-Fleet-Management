import { defineCollection } from "./store";
import type { Client, Company, Contract, Location, Vehicle, Worker } from "./entities";
import { seedClients, seedCompanies, seedContracts, seedLocations, seedVehicles, seedWorkers } from "./seed/core";

/** Shared collections. Areas read these and add their own in data/<area>/. */
export const companies = defineCollection<Company>("companies", seedCompanies);
export const clients = defineCollection<Client>("clients", seedClients);
export const contracts = defineCollection<Contract>("contracts", seedContracts);
export const locations = defineCollection<Location>("locations", seedLocations);
export const workers = defineCollection<Worker>("workers", seedWorkers);
export const vehicles = defineCollection<Vehicle>("vehicles", seedVehicles);

export * from "./entities";
