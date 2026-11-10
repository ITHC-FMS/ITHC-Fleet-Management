"use client";

import { useState } from "react";
import { vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import { fmtStamp, handoverEvents, incidents, inspections, type Incident, type Inspection } from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Select } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import type { ScreenProps } from "@/screens/types";
import { PhotoStrip } from "../_shared/ui";

const tone = (r: string) => (r === "pass" ? "good" : r === "minor" ? "warn" : "bad") as "good" | "warn" | "bad";

export default function InspectionsScreen(_: ScreenProps) {
  void _;
  const insp = inspections.useAll();
  const incs = incidents.useAll();
  const events = handoverEvents.useAll();
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const [result, setResult] = useState("");
  const [si, setSi] = useState<string | null>(null);
  const [sc, setSc] = useState<string | null>(null);
  const v = (id?: string) => vehicles.find((x) => x.id === id);
  const name = (id?: string) => workers.find((w) => w.id === id)?.name ?? "—";
  const rows = insp.filter((i) => !result || i.result === result).sort((a, b) => (a.at < b.at ? 1 : -1));
  const curI = insp.find((i) => i.id === si);
  const curC = incs.find((i) => i.id === sc);
  const prev = curI ? insp.filter((i) => i.vehicleId === curI.vehicleId && i.at < curI.at).sort((a, b) => (a.at < b.at ? 1 : -1))[0] : undefined;

  const iCols: Column<Inspection>[] = [
    { key: "at", header: "Date", value: (i) => i.at, cell: (i) => fmtStamp(i.at) },
    { key: "veh", header: "Vehicle", value: (i) => v(i.vehicleId)?.plate },
    { key: "drv", header: "Driver", value: (i) => name(i.driverId) },
    { key: "res", header: "Result", value: (i) => i.result, cell: (i) => <StatusBadge tone={tone(i.result)}>{i.result}</StatusBadge> },
    { key: "inc", header: "Incident", value: (i) => i.incidentId ?? "", cell: (i) => i.incidentId ?? "—" },
    { key: "ph", header: "Photos", align: "end", value: (i) => i.photos.length },
    { key: "op", header: "Recorded by", value: (i) => i.operatorName },
  ];
  const cCols: Column<Incident>[] = [
    { key: "id", header: "Incident", value: (i) => i.id },
    { key: "at", header: "Date", value: (i) => i.at, cell: (i) => fmtStamp(i.at) },
    { key: "veh", header: "Vehicle", value: (i) => v(i.vehicleId)?.plate },
    { key: "ev", header: "Triggering handover", value: (i) => i.handoverId ?? "—" },
    { key: "dmg", header: "Damage", value: (i) => i.description, cell: (i) => <span className="line-clamp-1 max-w-64">{i.description}</span> },
    { key: "repl", header: "Replacement", value: (i) => v(i.replacementVehicleId)?.plate, cell: (i) => v(i.replacementVehicleId)?.plate ?? "none" },
    { key: "st", header: "Status", value: (i) => i.status, cell: (i) => <StatusBadge tone={i.status === "closed" ? "good" : i.status === "routed" ? "bad" : "warn"}>{i.status.replace("_", " ")}</StatusBadge> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Inspections and incidents" description="Review what the handover desks recorded. Desk staff record; the Fleet Manager reviews." />
      <Tabs tabs={[
        { id: "i", label: `Inspections (${insp.length})`, content: <DataTable rows={rows} columns={iCols} exportName="inspections" onRowClick={(i) => setSi(i.id)} filters={<Select className="w-36" value={result} onChange={(e) => setResult(e.target.value)}><option value="">All results</option><option value="pass">Pass</option><option value="minor">Minor</option><option value="fail">Fail</option></Select>} /> },
        { id: "c", label: `Incidents (${incs.length})`, content: <DataTable rows={[...incs].sort((a, b) => (a.at < b.at ? 1 : -1))} columns={cCols} exportName="incidents" onRowClick={(i) => setSc(i.id)} /> },
      ]} />
      {curI && (
        <FormSheet open onOpenChange={(o) => !o && setSi(null)} title={`${v(curI.vehicleId)?.plate} · ${curI.id}`} description={`${fmtStamp(curI.at)} · event ${curI.handoverId} · ${curI.operatorName}`} hideSubmit wide>
          <div className="space-y-3 text-sm">
            <p>Driver {name(curI.driverId)} · result <StatusBadge tone={tone(curI.result)}>{curI.result}</StatusBadge></p>
            <table className="w-full"><tbody>{curI.items.map((it) => <tr key={it.key} className="border-b"><td className="py-1">{it.label}</td><td><StatusBadge tone={it.grade === "ok" ? "good" : it.grade === "minor" ? "warn" : "bad"}>{it.grade}</StatusBadge></td><td className="text-muted-foreground">{it.note}</td></tr>)}</tbody></table>
            <div><p className="mb-1 font-medium">Photographs</p><PhotoStrip photos={curI.photos} /></div>
            {prev && <div><p className="mb-1 font-medium">Previous inspection ({fmtStamp(prev.at)}, {prev.result}) for comparison</p><PhotoStrip photos={prev.photos} />{prev.photos.length === 0 && <p className="text-muted-foreground">No photos on the previous inspection (all OK).</p>}</div>}
            {curI.incidentId ? <Button type="button" variant="outline" onClick={() => { setSc(curI.incidentId!); setSi(null); }}>Open incident {curI.incidentId}</Button> : curI.result === "fail" ? <p className="text-red-700">Failed inspection without an incident. Ask the desk to raise one.</p> : null}
          </div>
        </FormSheet>
      )}
      {curC && (
        <FormSheet open onOpenChange={(o) => !o && setSc(null)} title={`${v(curC.vehicleId)?.plate} · ${curC.id}`} description={`${curC.kind} · ${fmtStamp(curC.at)}`} hideSubmit wide>
          <div className="space-y-3 text-sm">
            <p>{curC.description}</p><p className="text-muted-foreground">Assessment: {curC.assessment}</p>
            <p>Triggering handover: <b>{curC.handoverId ?? "none"}</b>{events.find((e) => e.id === curC.handoverId) ? ` (${events.find((e) => e.id === curC.handoverId)!.direction}, ${fmtStamp(events.find((e) => e.id === curC.handoverId)!.at)})` : ""}</p>
            <p>Replacement vehicle issued: <b>{v(curC.replacementVehicleId)?.plate ?? "none"}</b></p>
            <p>The vehicle is {v(curC.vehicleId)?.status === "under_repair" ? "under repair and out of the pool" : "back in service"}.</p>
            {curC.attributedTo && <p>Damage attributed to <b>{curC.attributedTo.replace("_", " ")}</b>{curC.attributionNote ? `: ${curC.attributionNote}` : ""}</p>}
            <PhotoStrip photos={curC.photos} />
            <p className="text-muted-foreground">Attribution and service routing are handled on Damaged Vehicles.</p>
          </div>
        </FormSheet>
      )}
    </div>
  );
}
