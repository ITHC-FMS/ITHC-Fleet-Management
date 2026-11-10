"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { vehicles as vehiclesCol } from "@/data/core";
import { docState, fmtStamp, logAudit, nowStamp, vehicleDocs, type DocType, type VehicleDocument } from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { useActor } from "../_shared/hooks";

const tone = { valid: "good", expiring: "warn", expired: "bad", superseded: "neutral" } as const;
const TYPES: DocType[] = ["registration", "insurance", "inspection_cert", "lease"];

export default function DocumentsScreen(_: ScreenProps) {
  void _;
  const docs = vehicleDocs.useAll();
  const vehicles = vehiclesCol.useAll();
  const [all, setAll] = useState(false);
  const [type, setType] = useState("");
  const [up, setUp] = useState<{ vehicleId?: string; type?: DocType } | null>(null);
  const [sel, setSel] = useState<VehicleDocument | null>(null);
  const plate = (id: string) => vehicles.find((v) => v.id === id)?.plate ?? id;
  const rows = docs.filter((d) => (all || d.status === "current") && (!type || d.type === type)).sort((a, b) => (a.expires < b.expires ? -1 : 1));
  const current = docs.filter((d) => d.status === "current");

  const cols: Column<VehicleDocument>[] = [
    { key: "veh", header: "Vehicle", value: (d) => plate(d.vehicleId), cell: (d) => <span className="font-medium">{plate(d.vehicleId)}</span> },
    { key: "type", header: "Type", value: (d) => d.type, cell: (d) => prettify(d.type) },
    { key: "issued", header: "Issued", value: (d) => d.issued, cell: (d) => fmtDate(d.issued) },
    { key: "exp", header: "Expires", value: (d) => d.expires, cell: (d) => fmtDate(d.expires) },
    { key: "left", header: "Days left", align: "end", value: (d) => daysBetween(TODAY, d.expires) },
    { key: "auth", header: "Authority", value: (d) => d.authority },
    { key: "ver", header: "Version", align: "end", value: (d) => d.docVersion, cell: (d) => `v${d.docVersion}` },
    { key: "st", header: "Status", value: (d) => docState(d), cell: (d) => <StatusBadge tone={tone[docState(d)]}>{docState(d)}</StatusBadge> },
    { key: "wl", header: "Watchlist", value: (d) => (d.status === "current" && daysBetween(TODAY, d.expires) <= 60 ? "on" : ""), cell: (d) => (d.status === "current" && daysBetween(TODAY, d.expires) <= 60 ? <StatusBadge tone="warn">on watchlist</StatusBadge> : "—") },
    { key: "act", header: "", sortable: false, cell: (d) => (d.status === "current" ? <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setUp({ vehicleId: d.vehicleId, type: d.type }); }}>Renew</Button> : null) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Vehicle documents" description="Registration, insurance, inspection certificates and lease documents, with expiry." actions={<Button onClick={() => setUp({})}><Upload /> Upload document</Button>} />
      <KpiGrid>
        <KpiCard label="Current documents" value={current.length} />
        <KpiCard label="Expired" value={current.filter((d) => docState(d) === "expired").length} tone="bad" />
        <KpiCard label="Expiring within 30 days" value={current.filter((d) => docState(d) === "expiring").length} tone="warn" />
        <KpiCard label="On the watchlist (60 days)" value={current.filter((d) => daysBetween(TODAY, d.expires) <= 60).length} hint="Feeds the single compliance watchlist" />
      </KpiGrid>
      <DataTable rows={rows} columns={cols} exportName="vehicle-documents" onRowClick={setSel} searchPlaceholder="Search vehicle or type…"
        filters={<><Select className="w-40" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{prettify(t)}</option>)}</Select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Include superseded versions</label></>} />
      {sel && (
        <FormSheet open onOpenChange={(o) => !o && setSel(null)} title={`${plate(sel.vehicleId)} · ${prettify(sel.type)}`} description="Version history" hideSubmit>
          <div className="space-y-2 text-sm">
            {docs.filter((d) => d.vehicleId === sel.vehicleId && d.type === sel.type).sort((a, b) => b.docVersion - a.docVersion).map((d) => (
              <div key={d.id} className="rounded-md border p-2"><p className="font-medium">v{d.docVersion} · {d.fileName} <StatusBadge tone={tone[docState(d)]}>{docState(d)}</StatusBadge></p><p>{fmtDate(d.issued)} to {fmtDate(d.expires)} · {d.authority}</p><p className="text-muted-foreground">Uploaded by {d.uploadedBy}, {fmtStamp(d.uploadedAt)}{d.supersedesId ? ` · supersedes ${d.supersedesId}` : ""}</p></div>
            ))}
          </div>
        </FormSheet>
      )}
      {up && <UploadForm key={`${up.vehicleId}${up.type}`} {...up} onClose={() => setUp(null)} />}
    </div>
  );
}

function UploadForm({ vehicleId: v0, type: t0, onClose }: { vehicleId?: string; type?: DocType; onClose: () => void }) {
  const actor = useActor();
  const vehicles = vehiclesCol.useAll();
  const docs = vehicleDocs.useAll();
  const [vehicleId, setVehicleId] = useState(v0 ?? "");
  const [type, setType] = useState<DocType>(t0 ?? "registration");
  const [file, setFile] = useState("");
  const [issued, setIssued] = useState(TODAY);
  const [expires, setExpires] = useState("");
  const [authority, setAuthority] = useState("");
  const [err, setErr] = useState("");
  const prior = docs.find((d) => d.vehicleId === vehicleId && d.type === type && d.status === "current");

  const save = async () => {
    const veh = vehicles.find((x) => x.id === vehicleId);
    if (!veh) return setErr("Choose a vehicle.");
    if (type === "lease" && veh.ownership !== "rented") return setErr("Lease documents apply to leased vehicles only.");
    if (!file) return setErr("Attach a PDF or image.");
    if (!issued || !expires || expires <= issued) return setErr("Expiry must be after the issue date.");
    if (!authority.trim()) return setErr("Issuing authority is required.");
    if (prior && expires <= prior.expires) return setErr(`A renewal must expire after the current version (${prior.expires}).`);
    const id = vehicleDocs.nextId("vd");
    if (prior) await vehicleDocs.save({ ...prior, status: "superseded" });
    await vehicleDocs.save({ id, vehicleId, type, issued, expires, authority: authority.trim(), docVersion: (prior?.docVersion ?? 0) + 1, supersedesId: prior?.id, status: "current", fileName: file, uploadedBy: actor.name, uploadedAt: nowStamp() });
    await logAudit(actor.name, "Vehicle document", id, prior ? "Renewed" : "Uploaded", `${veh.plate} ${type} v${(prior?.docVersion ?? 0) + 1}, expires ${expires}`);
    onClose();
  };

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={prior ? "Renew document" : "Upload document"} description={prior ? `Supersedes v${prior.docVersion}; the earlier version is kept.` : "PDF or image against the vehicle record."} onSubmit={save}>
      <Field label="Vehicle"><Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}><option value="">Choose…</option>{vehicles.map((x) => <option key={x.id} value={x.id}>{x.plate} · {x.make} {x.model}</option>)}</Select></Field>
      <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as DocType)}>{TYPES.map((t) => <option key={t} value={t}>{prettify(t)}</option>)}</Select></Field>
      <Field label="File (PDF or image)"><input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} className="block w-full text-sm" /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Issued"><Input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} /></Field><Field label="Expires"><Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field></div>
      <Field label="Issuing authority"><Input value={authority} onChange={(e) => setAuthority(e.target.value)} /></Field>
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}
