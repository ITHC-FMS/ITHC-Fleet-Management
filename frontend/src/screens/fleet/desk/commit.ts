import { vehicles } from "@/data/core";
import type { Vehicle } from "@/data/entities";
import {
  handoverEvents, incidents, inspections, logAudit, nowStamp, resultOf, vehicleAssignments,
  type ChecklistItem, type HandoverEvent, type Incident, type Photo, lastEventByVehicle, dateOf,
} from "@/data/fleet";
import { TODAY } from "@/lib/dates";

export interface HandoverInput {
  vehicle: Vehicle;
  driverId: string;
  direction: "issue" | "return";
  odometerKm: number;
  fuelEighths: number;
  items: ChecklistItem[];
  photos: Photo[];
  notes: string;
  deskId: string;
  operator: { id: string; name: string };
  durationSec?: number;
  offline: boolean;
}

/** Local + remote effects of an accepted handover event (vehicle reading, assignment periods). */
export async function applyEffects(e: HandoverEvent) {
  const v = vehicles.getSync(e.vehicleId);
  if (v) await vehicles.save({ ...v, odometerKm: Math.max(v.odometerKm, e.odometerKm), version: v.version + 1 });
  const all = await vehicleAssignments.list();
  const day = dateOf(e.at);
  if (e.mode === "pooled" && e.direction === "issue") {
    await vehicleAssignments.save({ id: vehicleAssignments.nextId("vas"), vehicleId: e.vehicleId, workerId: e.driverId, from: day, to: day, source: "handover", handoverId: e.id, version: 1 });
  } else if (e.mode === "dedicated" && e.direction === "issue") {
    await vehicleAssignments.save({ id: vehicleAssignments.nextId("vas"), vehicleId: e.vehicleId, workerId: e.driverId, from: day, to: null, source: "handover", handoverId: e.id, avgDailyHours: 9, version: 1 });
  } else if (e.mode === "dedicated" && e.direction === "return") {
    const open = all.find((a) => a.vehicleId === e.vehicleId && a.workerId === e.driverId && a.to === null);
    if (open) await vehicleAssignments.save({ ...open, to: day, version: open.version + 1, note: `Returned ${e.id}` });
  }
}

export async function recordHandover(i: HandoverInput): Promise<HandoverEvent> {
  const at = nowStamp();
  const result = resultOf(i.items);
  const evId = handoverEvents.nextId("hov");
  const insId = inspections.nextId("ins");
  const ev: HandoverEvent = {
    id: evId, direction: i.direction, vehicleId: i.vehicle.id, driverId: i.driverId, deskId: i.deskId, at,
    operatorId: i.operator.id, operatorName: i.operator.name, odometerKm: i.odometerKm, fuelEighths: i.fuelEighths,
    inspectionId: insId, inspectionResult: result, photos: i.photos, notes: i.notes, mode: i.vehicle.mode,
    durationSec: i.durationSec, sync: i.offline ? "queued" : "synced", queuedAt: i.offline ? at : undefined,
    vehicleVersionSeen: i.vehicle.version, syncedAt: i.offline ? undefined : at,
  };
  await handoverEvents.save(ev);
  await inspections.save({ id: insId, handoverId: evId, vehicleId: i.vehicle.id, driverId: i.driverId, deskId: i.deskId, at, operatorName: i.operator.name, items: i.items, result, photos: i.photos });
  if (!i.offline) await applyEffects(ev);
  return ev;
}

export interface IncidentInput {
  vehicle: Vehicle;
  handoverId?: string;
  driverId: string;
  deskId: string;
  kind: "damage" | "accident";
  severity: Incident["severity"];
  description: string;
  photos: Photo[];
  replacementVehicleId?: string;
  operator: { id: string; name: string };
}

/** Records the incident, takes the vehicle out of the pool and issues a replacement straight away. */
export async function recordIncident(i: IncidentInput): Promise<Incident> {
  const at = nowStamp();
  const id = incidents.nextId("inc");
  let handoverId = i.handoverId;
  const last = lastEventByVehicle(await handoverEvents.list()).get(i.vehicle.id);
  // vehicle still out and no triggering event: take it back on the spot
  if (!handoverId && last?.direction === "issue") {
    const ret = await recordHandover({
      vehicle: i.vehicle, driverId: last.driverId, direction: "return", odometerKm: last.odometerKm, fuelEighths: last.fuelEighths,
      items: [{ key: "body", label: "Damage reported", grade: "major", note: i.description }], photos: i.photos, notes: `Taken back after ${i.kind}`, deskId: i.deskId, operator: i.operator, offline: false,
    });
    handoverId = ret.id;
  }
  let replacementHandoverId: string | undefined;
  if (i.replacementVehicleId) {
    const rv = vehicles.getSync(i.replacementVehicleId);
    if (rv) {
      const ev = await recordHandover({
        vehicle: rv, driverId: i.driverId, direction: "issue", odometerKm: rv.odometerKm, fuelEighths: 6,
        items: [{ key: "body", label: "Replacement quick check", grade: "ok" }], photos: [], notes: `Replacement for ${i.vehicle.plate} (${id})`, deskId: i.deskId, operator: i.operator, offline: false,
      });
      replacementHandoverId = ev.id;
    }
  }
  const inc: Incident = {
    id, vehicleId: i.vehicle.id, handoverId, driverId: i.driverId, deskId: i.deskId, at, kind: i.kind, severity: i.severity,
    description: i.description, assessment: i.severity === "minor" ? "Minor repair, awaiting Fleet Manager assessment" : "Awaiting Fleet Manager assessment",
    photos: i.photos, replacementVehicleId: i.replacementVehicleId, replacementHandoverId, status: "routed", recordedBy: i.operator.name, version: 1,
  };
  await incidents.save(inc);
  if (handoverId) {
    const ins = (await inspections.list()).find((x) => x.handoverId === handoverId);
    if (ins) await inspections.save({ ...ins, incidentId: id });
  }
  const v = vehicles.getSync(i.vehicle.id) ?? i.vehicle;
  await vehicles.save({ ...v, status: "under_repair", version: v.version + 1 });
  await logAudit(i.operator.name, "Vehicle", v.id, "Status change", "in service to under repair", `Incident ${id} routed to Fleet Manager`);
  return inc;
}

export const todayStr = TODAY;
