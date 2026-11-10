import type { Vehicle } from "@/data/entities";
import { assignability, deskSees, type HandoverEvent, type LeaseLink, type LessorContract, type TransportRoute } from "@/data/fleet";

export interface VState {
  kind: "available" | "out" | "blocked" | "route";
  holderId?: string;
  reason?: string;
  event?: HandoverEvent;
}

export function vehicleState(v: Vehicle, last: HandoverEvent | undefined, links: LeaseLink[], contracts: LessorContract[], routes: TransportRoute[]): VState {
  if (v.mode === "transport") {
    const r = routes.filter((x) => x.vehicleId === v.id && x.status === "active");
    return { kind: "route", reason: r.length ? `Assigned to ${r.length} route${r.length > 1 ? "s" : ""}, not issued to a worker` : "Transport vehicle: assigned to a route, not issued to a worker" };
  }
  if (v.status !== "in_service") return { kind: "blocked", reason: v.status === "under_repair" ? "Under repair" : "Off fleet" };
  if (last?.direction === "issue") return { kind: "out", holderId: last.driverId, event: last };
  const a = assignability(v, links, contracts);
  if (!a.ok) return { kind: "blocked", reason: a.reason?.startsWith("Lessor") ? "Lessor contract expired" : a.reason };
  return { kind: "available", event: last };
}

export const deskVehicles = (all: Vehicle[], deskId: string) => all.filter((v) => deskSees(deskId, v.homeLocationId));
