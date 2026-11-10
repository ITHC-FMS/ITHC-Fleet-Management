"use client";

import { useMemo, useState } from "react";
import { vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import { blankChecklist, handoverEvents, inspections, resultOf, type ChecklistItem, type Inspection, type Photo, fmtStamp } from "@/data/fleet";
import { StatusBadge } from "@/components/app/status-badge";
import type { ScreenProps } from "@/screens/types";
import { useDesk } from "../_shared/hooks";
import { BigButton, DeskSwitcher, PhotoCapture, PhotoStrip, Section } from "../_shared/ui";
import { Checklist } from "./checklist";
import { IncidentForm } from "./incident-form";

const tone = (r: string) => (r === "pass" ? "good" : r === "minor" ? "warn" : "bad");

export default function InspectionScreen(_: ScreenProps) {
  void _;
  const { desks, deskId, setDeskId, operator } = useDesk();
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const events = handoverEvents.useAll();
  const insp = inspections.useAll();
  const [open, setOpen] = useState<string | null>(null); // inspection id being viewed
  const [target, setTarget] = useState<string | null>(null); // event id needing an inspection
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [raise, setRaise] = useState<Inspection | null>(null);

  const vById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const mine = insp.filter((i) => i.deskId === deskId).sort((a, b) => (a.at < b.at ? 1 : -1));
  const noInsp = events.filter((e) => e.deskId === deskId && !e.inspectionId && e.sync !== "held").sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6);
  const viewing = insp.find((i) => i.id === open);
  const name = (id: string) => workers.find((w) => w.id === id)?.name ?? id;

  const save = async () => {
    const ev = events.find((e) => e.id === target);
    const v = ev && vById.get(ev.vehicleId);
    if (!ev || !v || !operator) return;
    const result = resultOf(items);
    const id = inspections.nextId("ins");
    const rec: Inspection = { id, handoverId: ev.id, vehicleId: v.id, driverId: ev.driverId, deskId: ev.deskId, at: ev.at, operatorName: operator.name, items, result, photos };
    await inspections.save(rec);
    await handoverEvents.save({ ...ev, inspectionId: id, inspectionResult: result, photos: [...ev.photos, ...photos] });
    setTarget(null);
    if (result === "fail") setRaise(rec); else setOpen(id);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Inspections and photos</h1>
      <DeskSwitcher desks={desks} deskId={deskId} onChange={setDeskId} />

      {raise && operator && (
        <Section title="Failed inspection: raise an incident" right={<BigButton onClick={() => setRaise(null)} className="min-h-12">Close</BigButton>}>
          <IncidentForm vehicleId={raise.vehicleId} handoverId={raise.handoverId} deskId={deskId} operator={operator} initialPhotos={raise.photos} initialDescription={raise.items.filter((i) => i.grade === "major").map((i) => i.label).join(", ")} />
        </Section>
      )}

      {target ? (
        <Section title={`Inspect event ${target}`}>
          <Checklist items={items} onChange={setItems} />
          <PhotoCapture photos={photos} onChange={setPhotos} />
          <div className="grid grid-cols-2 gap-2">
            <BigButton onClick={() => setTarget(null)}>Cancel</BigButton>
            <BigButton tone="primary" disabled={resultOf(items) !== "pass" && photos.length === 0} onClick={save}>Save inspection{resultOf(items) !== "pass" && photos.length === 0 ? " (photo required)" : ""}</BigButton>
          </div>
        </Section>
      ) : noInsp.length > 0 ? (
        <Section title="Handover events without a structured inspection">
          <div className="grid gap-2 md:grid-cols-2">
            {noInsp.map((e) => (
              <BigButton key={e.id} className="text-start text-base" onClick={() => { setTarget(e.id); setItems(blankChecklist(vById.get(e.vehicleId)?.type ?? "car")); setPhotos([]); }}>
                {vById.get(e.vehicleId)?.plate} · {e.direction} · {fmtStamp(e.at)}
              </BigButton>
            ))}
          </div>
        </Section>
      ) : null}

      {viewing && (
        <Section title={`Inspection ${viewing.id} · ${vById.get(viewing.vehicleId)?.plate}`} right={<BigButton onClick={() => setOpen(null)} className="min-h-12">Close</BigButton>}>
          <p className="text-muted-foreground">Event {viewing.handoverId} · {fmtStamp(viewing.at)} · driver {name(viewing.driverId)} · recorded by {viewing.operatorName}</p>
          <p><StatusBadge tone={tone(viewing.result)}>{viewing.result}</StatusBadge> {viewing.incidentId && <StatusBadge tone="bad">incident {viewing.incidentId}</StatusBadge>}</p>
          <Checklist items={viewing.items} readOnly />
          <PhotoStrip photos={viewing.photos} />
        </Section>
      )}

      <Section title="Recent inspections at this desk">
        <div className="space-y-2">
          {mine.slice(0, 12).map((i) => (
            <button key={i.id} type="button" onClick={() => setOpen(i.id)} className="flex min-h-16 w-full items-center justify-between gap-2 rounded-xl border p-3 text-start hover:bg-muted">
              <span><span className="text-lg font-semibold">{vById.get(i.vehicleId)?.plate}</span> <span className="text-muted-foreground">{fmtStamp(i.at)} · {name(i.driverId)}</span></span>
              <span className="flex items-center gap-2 text-sm">{i.photos.length} photo{i.photos.length === 1 ? "" : "s"} <StatusBadge tone={tone(i.result)}>{i.result}</StatusBadge></span>
            </button>
          ))}
          {mine.length === 0 && <p className="text-muted-foreground">No inspections recorded at this desk.</p>}
        </div>
      </Section>
    </div>
  );
}
