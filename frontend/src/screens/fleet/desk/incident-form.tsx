"use client";

import { useMemo, useState } from "react";
import { vehicles as vehiclesCol, workers } from "@/data/core";
import {
  assignability, deskSees, handoverEvents, lastEventByVehicle, leaseLinks, lessorContracts, transportRoutes, vehicleAssignments,
  type Incident, type Photo,
} from "@/data/fleet";
import { recordIncident } from "./commit";
import { vehicleState } from "./availability";
import { BigButton, PhotoCapture } from "../_shared/ui";
import { cn } from "@/lib/utils";

/** Incident + immediate replacement, used on the incident page and after a failed inspection. */
export function IncidentForm({ vehicleId, handoverId, deskId, operator, initialDescription = "", initialPhotos = [], onDone }: {
  vehicleId: string; handoverId?: string; deskId: string; operator?: { id: string; name: string };
  initialDescription?: string; initialPhotos?: Photo[]; onDone?: (i: Incident) => void;
}) {
  const vehicles = vehiclesCol.useAll();
  const events = handoverEvents.useAll();
  const links = leaseLinks.useAll();
  const contracts = lessorContracts.useAll();
  const routes = transportRoutes.useAll();
  const assignments = vehicleAssignments.useAll();
  const people = workers.useAll();
  const v = vehicles.find((x) => x.id === vehicleId);
  const last = useMemo(() => lastEventByVehicle(events), [events]);
  const ev = events.find((e) => e.id === handoverId);
  const driverId = ev?.driverId ?? last.get(vehicleId)?.driverId ?? assignments.find((a) => a.vehicleId === vehicleId && a.to === null)?.workerId ?? "";
  const [kind, setKind] = useState<"damage" | "accident">(ev ? "damage" : "accident");
  const [severity, setSeverity] = useState<"minor" | "major" | "total_loss">("major");
  const [description, setDescription] = useState(initialDescription);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [repl, setRepl] = useState<string | null | undefined>(undefined);
  const [done, setDone] = useState<Incident | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(() => {
    if (!v) return [];
    return vehicles.filter((c) => c.id !== v.id && c.type === v.type && c.mode !== "transport" && deskSees(deskId, c.homeLocationId) && vehicleState(c, last.get(c.id), links, contracts, routes).kind === "available" && assignability(c, links, contracts).ok);
  }, [vehicles, v, deskId, last, links, contracts, routes]);
  const chosen = repl === undefined ? candidates[0]?.id : repl ?? undefined;

  if (!v) return <p className="text-muted-foreground">Pick a vehicle first.</p>;
  const driver = people.find((w) => w.id === driverId);

  if (done) {
    const rv = vehicles.find((x) => x.id === done.replacementVehicleId);
    return (
      <div className="space-y-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 dark:bg-emerald-950">
        <p className="text-xl font-semibold">Incident {done.id} recorded</p>
        <p>{v.plate} is now under repair and removed from the available pool. Routed to the Fleet Manager.</p>
        <p className="text-lg font-medium">{rv ? `Replacement issued: ${rv.plate} (${rv.make} ${rv.model}) to ${driver?.name ?? "driver"}` : "No replacement vehicle was issued."}</p>
      </div>
    );
  }

  const submit = async () => {
    if (!operator) return setErr("No desk operator is signed in at this desk.");
    if (!description.trim()) return setErr("Describe the damage.");
    if (!driverId) return setErr("This vehicle has no known driver; record the incident from a handover event.");
    if (photos.length === 0) return setErr("Attach at least one photo as evidence.");
    setErr("");
    setBusy(true);
    const inc = await recordIncident({ vehicle: v, handoverId, driverId, deskId, kind, severity, description: description.trim(), photos, replacementVehicleId: chosen, operator });
    setBusy(false);
    setDone(inc);
    onDone?.(inc);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/40 p-3 text-lg">
        <b>{v.plate}</b> {v.make} {v.model} · driver: <b>{driver?.name ?? "unknown"}</b>
        {ev && <span className="text-muted-foreground"> · handover {ev.id}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <BigButton selected={kind === "damage"} onClick={() => setKind("damage")}>Damage found</BigButton>
        <BigButton selected={kind === "accident"} onClick={() => setKind("accident")}>Accident in service</BigButton>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([["minor", "Minor"], ["major", "Major"], ["total_loss", "Total loss"]] as const).map(([k, l]) => (
          <BigButton key={k} selected={severity === k} onClick={() => setSeverity(k)}>{l}</BigButton>
        ))}
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened / what is damaged?" className="min-h-28 w-full rounded-xl border-2 bg-background p-3 text-lg" />
      <PhotoCapture photos={photos} onChange={setPhotos} label="Take damage photo" />
      <div className="space-y-2">
        <p className="text-lg font-semibold">Replacement vehicle (issued immediately)</p>
        <div className="grid grid-cols-2 gap-2">
          {candidates.slice(0, 6).map((c) => (
            <button key={c.id} type="button" onClick={() => setRepl(c.id)} className={cn("min-h-16 rounded-xl border-2 p-3 text-start", chosen === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
              <span className="block text-lg font-semibold">{c.plate}</span>
              <span className="text-sm opacity-80">{c.make} {c.model} · {c.mode}</span>
            </button>
          ))}
          <BigButton selected={chosen === undefined} onClick={() => setRepl(null)}>No replacement</BigButton>
        </div>
        {candidates.length === 0 && <p className="text-sm text-amber-700">No replacement available at this desk. Shift will stop: escalate to the Fleet Manager.</p>}
      </div>
      {err && <p className="rounded-lg bg-red-100 p-3 text-red-800">{err}</p>}
      <BigButton tone="danger" disabled={busy} onClick={submit} className="w-full">Record incident and issue replacement</BigButton>
    </div>
  );
}
