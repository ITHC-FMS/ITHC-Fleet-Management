"use client";

import { useMemo, useState } from "react";
import { vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import { fmtStamp, handoverEvents, incidents } from "@/data/fleet";
import { StatusBadge } from "@/components/app/status-badge";
import type { ScreenProps } from "@/screens/types";
import { cn } from "@/lib/utils";
import { useDesk } from "../_shared/hooks";
import { BigButton, DeskSwitcher, PhotoStrip, Section } from "../_shared/ui";
import { deskVehicles } from "./availability";
import { IncidentForm } from "./incident-form";

export default function IncidentScreen(_: ScreenProps) {
  void _;
  const { desks, deskId, setDeskId, operator } = useDesk();
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const events = handoverEvents.useAll();
  const incs = incidents.useAll();
  const [vehicleId, setVehicleId] = useState("");
  const [eventId, setEventId] = useState("");
  const [recording, setRecording] = useState(false);

  const mine = deskVehicles(vehicles, deskId).filter((v) => v.mode !== "transport" && v.status === "in_service");
  const evs = useMemo(() => events.filter((e) => e.vehicleId === vehicleId && e.sync !== "held").sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 4), [events, vehicleId]);
  const list = incs.filter((i) => i.deskId === deskId).sort((a, b) => (a.at < b.at ? 1 : -1));
  const v = (id?: string) => vehicles.find((x) => x.id === id);
  const name = (id?: string) => workers.find((w) => w.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Incident and replacement</h1>
        {!recording && <BigButton tone="danger" onClick={() => setRecording(true)}>Record incident</BigButton>}
      </div>
      <DeskSwitcher desks={desks} deskId={deskId} onChange={(id) => { setDeskId(id); setVehicleId(""); }} />

      {recording && (
        <Section title="Record incident" right={<BigButton className="min-h-12" onClick={() => { setRecording(false); setVehicleId(""); setEventId(""); }}>Close</BigButton>}>
          {!vehicleId ? (
            <>
              <p className="text-lg">Which vehicle is damaged?</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {mine.map((x) => (
                  <button key={x.id} type="button" onClick={() => { setVehicleId(x.id); setEventId(""); }} className="min-h-20 rounded-xl border-2 p-3 text-start hover:border-primary">
                    <span className="block text-xl font-bold">{x.plate}</span><span className="text-sm text-muted-foreground">{x.make} {x.model} · {x.mode}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-lg font-semibold">Triggering handover event</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {evs.map((e) => (
                    <button key={e.id} type="button" onClick={() => setEventId(e.id)} className={cn("min-h-16 rounded-xl border-2 p-3 text-start", (eventId || evs[0]?.id) === e.id ? "border-primary bg-primary/10" : "bg-card")}>
                      <span className="block font-semibold">{e.direction} · {fmtStamp(e.at)}</span>
                      <span className="text-sm text-muted-foreground">{name(e.driverId)} · inspection {e.inspectionResult}</span>
                    </button>
                  ))}
                  {evs.length === 0 && <p className="text-muted-foreground">No handover on record for this vehicle.</p>}
                </div>
              </div>
              <IncidentForm key={vehicleId + (eventId || evs[0]?.id)} vehicleId={vehicleId} handoverId={eventId || evs[0]?.id} deskId={deskId} operator={operator} onDone={() => undefined} />
              <BigButton onClick={() => setVehicleId("")}>Choose another vehicle</BigButton>
            </div>
          )}
        </Section>
      )}

      <Section title="Incidents at this desk">
        <ul className="space-y-3">
          {list.map((i) => (
            <li key={i.id} className="space-y-2 rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg font-semibold">{v(i.vehicleId)?.plate} · {i.kind === "damage" ? "Damage found" : "Accident in service"} <span className="font-normal text-muted-foreground">{i.id}</span></span>
                <StatusBadge tone={i.status === "closed" ? "good" : i.status === "routed" ? "bad" : "warn"}>{i.status.replace("_", " ")}</StatusBadge>
              </div>
              <p>{i.description}</p>
              <p className="text-sm text-muted-foreground">{fmtStamp(i.at)} · driver {name(i.driverId)} · event {i.handoverId ?? "none"} · severity {i.severity.replace("_", " ")}</p>
              <p className="text-sm">Replacement: {i.replacementVehicleId ? <b>{v(i.replacementVehicleId)?.plate} ({i.replacementHandoverId})</b> : <span className="text-red-700">none issued</span>}</p>
              <PhotoStrip photos={i.photos} />
            </li>
          ))}
          {list.length === 0 && <p className="text-muted-foreground">No incidents at this desk.</p>}
        </ul>
      </Section>
    </div>
  );
}
