"use client";

import { useState } from "react";
import { locations as locationsCol, vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import {
  assignability, canDrive, handoverEvents, incidents, inspections, leaseLinks, lessorContracts, lastEventByVehicle, logAudit, nowStamp, fmtStamp, serviceJobs, vehicleAssignments,
  type Incident,
} from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Select, Textarea } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { useActor } from "../_shared/hooks";
import { PhotoStrip } from "../_shared/ui";
import { JobForm } from "./job-form";

export const incTone = (s: string) => (s === "closed" ? "good" : s === "routed" ? "bad" : "warn") as "good" | "bad" | "warn";

export default function DamagedScreen(_: ScreenProps) {
  void _;
  const actor = useActor();
  const incs = incidents.useAll();
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const locs = locationsCol.useAll();
  const events = handoverEvents.useAll();
  const insp = inspections.useAll();
  const jobs = serviceJobs.useAll();
  const links = leaseLinks.useAll();
  const contracts = lessorContracts.useAll();
  const [showClosed, setShowClosed] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [job, setJob] = useState<string | null>(null);
  const [reassign, setReassign] = useState(false);
  const [target, setTarget] = useState("");
  const [assess, setAssess] = useState<{ id: string; text: string; who: string; note: string } | null>(null);
  const [msg, setMsg] = useState("");

  const v = (id?: string) => vehicles.find((x) => x.id === id);
  const w = (id?: string) => workers.find((x) => x.id === id)?.name ?? "—";
  const rows = incs.filter((i) => showClosed || i.status !== "closed").sort((a, b) => (a.at < b.at ? 1 : -1));
  const cur = incs.find((i) => i.id === sel);
  const curEvent = events.find((e) => e.id === cur?.handoverId);
  const curInsp = insp.find((i) => i.handoverId === cur?.handoverId);

  const cols: Column<Incident>[] = [
    { key: "veh", header: "Vehicle", value: (i) => v(i.vehicleId)?.plate, cell: (i) => <span className="font-medium">{v(i.vehicleId)?.plate}</span> },
    { key: "id", header: "Incident", value: (i) => i.id, cell: (i) => `${i.id} · ${i.kind}` },
    { key: "rec", header: "Received", value: (i) => i.receivedOn ?? "", cell: (i) => (i.receivedOn ? i.receivedOn : <StatusBadge tone="bad">Awaiting</StatusBadge>) },
    { key: "dmg", header: "Damage", value: (i) => i.description, cell: (i) => <span className="line-clamp-1 max-w-72">{i.description}</span> },
    { key: "repl", header: "Replacement issued", value: (i) => v(i.replacementVehicleId)?.plate, cell: (i) => v(i.replacementVehicleId)?.plate ?? <span className="text-red-700">none</span> },
    { key: "pool", header: "Off pool", value: () => "yes", cell: (i) => (v(i.vehicleId)?.status === "under_repair" ? <StatusBadge tone="warn">Off pool</StatusBadge> : <StatusBadge tone="neutral">Back in pool</StatusBadge>) },
    { key: "st", header: "Status", value: (i) => i.status, cell: (i) => <StatusBadge tone={incTone(i.status)}>{i.status.replace("_", " ")}</StatusBadge> },
  ];

  const receive = async (i: Incident) => {
    const x = incidents.getSync(i.id);
    if (!x || x.version !== i.version) return setMsg("Incident changed elsewhere; reopen it.");
    await incidents.save({ ...x, status: "received", receivedOn: TODAY, version: x.version + 1 });
    await logAudit(actor.name, "Incident", i.id, "Received at service centre", `${v(i.vehicleId)?.plate} received`);
    setMsg(`${v(i.vehicleId)?.plate} received at the service centre.`);
  };

  const saveAssess = async () => {
    if (!assess) return;
    const x = incidents.getSync(assess.id);
    if (!x) return;
    await incidents.save({ ...x, assessment: assess.text, attributedTo: (assess.who || undefined) as Incident["attributedTo"], attributionNote: assess.note || undefined, version: x.version + 1 });
    await logAudit(actor.name, "Incident", x.id, "Assessment updated", `Attributed to ${assess.who || "undetermined"}`, assess.note || undefined);
    setAssess(null);
  };

  const doReassign = async () => {
    if (!cur || !target || !cur.driverId) return;
    const tv = v(target)!;
    await vehicleAssignments.save({ id: vehicleAssignments.nextId("vas"), vehicleId: tv.id, workerId: cur.driverId, from: TODAY, to: tv.mode === "pooled" ? TODAY : null, source: "fleet_reassign", note: `Reassigned after ${cur.id}`, version: 1 });
    await incidents.save({ ...cur, reassignedNote: `${w(cur.driverId)} reassigned to ${tv.plate} on ${TODAY} by ${actor.name}`, version: cur.version + 1 });
    await logAudit(actor.name, "Assignment", cur.id, "Driver reassigned", `${w(cur.driverId)} to ${tv.plate} after incident ${cur.id}`);
    setReassign(false);
    setTarget("");
  };

  const lastBy = lastEventByVehicle(events);
  const reassignOptions = cur ? vehicles.filter((x) => x.id !== cur.vehicleId && x.type === v(cur.vehicleId)?.type && x.mode !== "transport" && assignability(x, links, contracts).ok && lastBy.get(x.id)?.direction !== "issue") : [];
  void nowStamp; void canDrive;

  return (
    <div className="space-y-4">
      <PageHeader title="Damaged vehicles" description="Vehicles routed from the handover desk after damage or an accident. They stay off the available pool while here." actions={<Button variant="outline" onClick={() => setShowClosed((s) => !s)}>{showClosed ? "Hide closed" : "Show closed"}</Button>} />
      <KpiGrid>
        <KpiCard label="Awaiting receipt" value={incs.filter((i) => i.status === "routed").length} tone="bad" />
        <KpiCard label="Received, no job yet" value={incs.filter((i) => i.status === "received").length} tone="warn" />
        <KpiCard label="In service" value={incs.filter((i) => i.status === "in_service").length} />
        <KpiCard label="Without replacement" value={incs.filter((i) => i.status !== "closed" && !i.replacementVehicleId).length} tone={incs.some((i) => i.status !== "closed" && !i.replacementVehicleId) ? "bad" : "good"} />
      </KpiGrid>
      {msg && <p className="rounded-md bg-emerald-100 p-2 text-sm text-emerald-800">{msg}</p>}
      <DataTable rows={rows} columns={cols} exportName="damaged-vehicles" onRowClick={(i) => { setSel(i.id); setMsg(""); }} />

      {cur && (
        <FormSheet open onOpenChange={(o) => !o && setSel(null)} title={`${v(cur.vehicleId)?.plate} · ${cur.id}`} description={`${cur.kind === "damage" ? "Damage found at handover" : "Accident in service"} · ${fmtStamp(cur.at)}`} hideSubmit wide>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2"><StatusBadge tone={incTone(cur.status)}>{cur.status.replace("_", " ")}</StatusBadge><StatusBadge tone="warn">severity {cur.severity.replace("_", " ")}</StatusBadge>{v(cur.vehicleId)?.status === "under_repair" && <StatusBadge tone="warn">off available pool</StatusBadge>}</div>
            <div className="space-y-1">
              <p className="font-medium">Damage</p><p>{cur.description}</p>
              <p className="font-medium">Assessment</p><p>{cur.assessment}</p>
              {cur.attributedTo && <p>Attributed to <b>{cur.attributedTo.replace("_", " ")}</b>{cur.attributionNote ? `: ${cur.attributionNote}` : ""}</p>}
              <p className="text-muted-foreground">Driver {w(cur.driverId)} · recorded by {cur.recordedBy} · desk {locs.find((l) => l.id === cur.deskId)?.name}</p>
            </div>
            {curEvent && (
              <div className="rounded-md border p-2"><p className="font-medium">Triggering handover {curEvent.id}</p>
                <p>{curEvent.direction} · {fmtStamp(curEvent.at)} · odometer {curEvent.odometerKm.toLocaleString("en-US")} km · fuel {curEvent.fuelEighths}/8 · operator {curEvent.operatorName}</p>
                {curInsp && <ul className="mt-1 list-disc ps-5">{curInsp.items.filter((x) => x.grade !== "ok").map((x) => <li key={x.key}>{x.label}: {x.grade}{x.note ? ` (${x.note})` : ""}</li>)}</ul>}
              </div>
            )}
            <div><p className="mb-1 font-medium">Photographs</p><PhotoStrip photos={cur.photos} /></div>
            <p>Replacement vehicle issued: <b>{v(cur.replacementVehicleId)?.plate ?? "none"}</b>{cur.replacementHandoverId ? ` (event ${cur.replacementHandoverId})` : ""}</p>
            {cur.reassignedNote && <p className="rounded-md bg-sky-100 p-2 text-sky-900">{cur.reassignedNote}</p>}
            {jobs.find((j) => j.id === cur.serviceJobId) && <p>Service job: <b>{cur.serviceJobId}</b></p>}
            <div className="flex flex-wrap gap-2 border-t pt-3">
              {cur.status === "routed" && <Button type="button" onClick={() => receive(cur)}>Receive at service centre</Button>}
              {(cur.status === "routed" || cur.status === "received") && <Button type="button" variant="outline" onClick={() => setJob(cur.id)}>Start service job</Button>}
              <Button type="button" variant="outline" onClick={() => setAssess({ id: cur.id, text: cur.assessment, who: cur.attributedTo ?? "", note: cur.attributionNote ?? "" })}>Update assessment</Button>
              {cur.status !== "closed" && cur.driverId && <Button type="button" variant="outline" onClick={() => setReassign(true)}>Reassign driver to another vehicle</Button>}
            </div>
          </div>
        </FormSheet>
      )}
      {assess && (
        <FormSheet open onOpenChange={(o) => !o && setAssess(null)} title="Damage assessment and attribution" description="Use the photographs to attribute the damage." onSubmit={saveAssess}>
          <Field label="Assessment"><Textarea value={assess.text} onChange={(e) => setAssess({ ...assess, text: e.target.value })} /></Field>
          <Field label="Attributed to"><Select value={assess.who} onChange={(e) => setAssess({ ...assess, who: e.target.value })}><option value="">Undetermined</option><option value="driver">Current driver</option><option value="previous_driver">Previous driver</option><option value="third_party">Third party</option><option value="wear">Wear and tear</option></Select></Field>
          <Field label="Evidence note"><Textarea value={assess.note} onChange={(e) => setAssess({ ...assess, note: e.target.value })} /></Field>
        </FormSheet>
      )}
      {reassign && cur && (
        <FormSheet open onOpenChange={(o) => !o && setReassign(false)} title="Reassign driver" description={`${w(cur.driverId)} needs another vehicle while ${v(cur.vehicleId)?.plate} is in service.`} onSubmit={doReassign} submitLabel="Reassign">
          <Field label="Vehicle (same type, assignable, not out)"><Select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose…</option>{reassignOptions.map((x) => <option key={x.id} value={x.id}>{x.plate} · {x.make} {x.model} · {x.mode}</option>)}</Select></Field>
          <p className="text-sm text-muted-foreground">Pooled cars are recorded for today only; dedicated bikes are assigned open ended. Audited.</p>
        </FormSheet>
      )}
      {job && <JobForm key={job} incidentId={job} onClose={() => setJob(null)} />}
    </div>
  );
}
