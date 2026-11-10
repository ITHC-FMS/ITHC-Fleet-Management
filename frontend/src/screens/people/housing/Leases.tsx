"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { locations } from "@/data/core";
import { docAudit, documents, leases, occupancy, properties, type Lease } from "@/data/people";
import { occupiesOn } from "@/data/people/calc";
import { addDays, daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { DaysBadge, Errors, Notice, stamp, useActor } from "../common";

interface Draft { propertyId: string; leaseNo: string; landlord: string; start: string; end: string; rent: string; file?: File }
const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });

export default function Leases({ readOnly, editedBy }: ScreenProps) {
  const actor = useActor();
  const ls = leases.useAll();
  const props = properties.useAll();
  const docs = documents.useAll();
  const occ = occupancy.useAll();
  const locs = locations.useAll();
  const [showOld, setShowOld] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  const pname = (id: string) => props.find((p) => p.id === id)?.name ?? id;
  const rows = useMemo(() => ls.filter((l) => showOld || l.status === "current").sort((a, b) => a.end.localeCompare(b.end)), [ls, showOld]);
  const current = ls.filter((l) => l.status === "current");
  const expired = current.filter((l) => l.end < TODAY);
  const soon = current.filter((l) => l.end >= TODAY && daysBetween(TODAY, l.end) <= 60);
  const stillHoused = (pid: string) => occ.filter((o) => o.propertyId === pid && occupiesOn(o, TODAY)).length;

  const cols: Column<Lease>[] = [
    { key: "property", header: "Property", value: (l) => pname(l.propertyId) },
    { key: "leaseNo", header: "Lease no" },
    { key: "landlord", header: "Landlord" },
    { key: "start", header: "Lease start", value: (l) => l.start, cell: (l) => fmtDate(l.start) },
    { key: "end", header: "Lease end", value: (l) => l.end, cell: (l) => fmtDate(l.end) },
    { key: "left", header: "Days left", value: (l) => daysBetween(TODAY, l.end), cell: (l) => (l.status === "superseded" ? <StatusBadge>Superseded</StatusBadge> : <DaysBadge days={daysBetween(TODAY, l.end)} />) },
    { key: "cost", header: "Monthly cost (KD)", align: "end", value: (l) => l.monthlyCost, cell: (l) => formatKD(l.monthlyCost, { symbol: false }) },
    { key: "version", header: "Version", align: "end", cell: (l) => `v${l.version}` },
    { key: "doc", header: "Document", sortable: false, cell: (l) => { const d = docs.find((x) => x.id === l.documentId); return d?.dataUrl ? <a className="underline" href={d.dataUrl} download={d.fileName} onClick={(e) => e.stopPropagation()}>{d.fileName}</a> : d?.fileName ?? "—"; } },
  ];

  const open = (propertyId?: string) => {
    const pid = propertyId ?? props[0]?.id ?? "";
    const cur = ls.find((l) => l.propertyId === pid && l.status === "current");
    setErrs([]); setMsg("");
    setDraft({ propertyId: pid, leaseNo: "", landlord: cur?.landlord ?? props.find((p) => p.id === pid)?.landlord ?? "", start: cur ? addDays(cur.end, 1) : TODAY, end: "", rent: cur ? (cur.monthlyCost / 1000).toFixed(3) : "" });
  };
  const prev = draft ? ls.find((l) => l.propertyId === draft.propertyId && l.status === "current") : undefined;

  const save = async () => {
    if (!draft) return;
    const e: string[] = [];
    const rent = parseKD(draft.rent);
    if (!draft.propertyId) e.push("Choose a property");
    if (!draft.leaseNo.trim()) e.push("Lease number is required");
    if (!draft.landlord.trim()) e.push("Landlord is required");
    if (!draft.start || !draft.end || draft.end < draft.start) e.push("Lease end must be on or after the lease start");
    if (!(rent > 0)) e.push("Monthly cost must be a KD amount above 0");
    if (!draft.file) e.push("Attach the lease document (PDF or image)");
    else if (!/^(application\/pdf|image\/)/.test(draft.file.type)) e.push("Only PDF and image files can be uploaded");
    if (prev && draft.end <= prev.end) e.push(`A renewal must end after the current lease (${fmtDate(prev.end)})`);
    setErrs(e);
    if (e.length) return;
    const f = draft.file!;
    const dataUrl = f.size <= 150_000 ? await readAsDataUrl(f) : undefined;
    const docId = documents.nextId("doc");
    const lsId = leases.nextId("ls");
    if (prev) {
      await leases.save({ ...prev, status: "superseded" });
      const od = docs.find((d) => d.id === prev.documentId);
      if (od) await documents.save({ ...od, status: "superseded", supersededById: docId });
    }
    await documents.save({ id: docId, ownerKind: "property", ownerId: draft.propertyId, typeKey: "lease_agreement", issueDate: draft.start, expiryDate: draft.end, authority: draft.landlord.trim(), fileName: f.name, fileSize: f.size, mime: f.type, dataUrl, version: (prev?.version ?? 0) + 1, status: "current", uploadedBy: actor, uploadedAt: TODAY, notes: prev ? `Renewal of ${prev.leaseNo}` : undefined });
    await docAudit.save({ id: docAudit.nextId("da"), docId, at: stamp(), by: actor, action: prev ? `Lease renewal uploaded, superseded ${prev.documentId}` : "Lease uploaded" });
    await leases.save({ id: lsId, propertyId: draft.propertyId, leaseNo: draft.leaseNo.trim(), landlord: draft.landlord.trim(), start: draft.start, end: draft.end, monthlyCost: rent, status: "current", version: (prev?.version ?? 0) + 1, supersedesId: prev?.id, documentId: docId });
    const p = props.find((x) => x.id === draft.propertyId);
    const loc = locs.find((l) => l.id === p?.locationId);
    if (loc) await locations.save({ ...loc, monthlyCost: rent });
    setMsg(prev ? `${pname(draft.propertyId)} renewed to ${fmtDate(draft.end)}. The previous lease is kept as a superseded version.${draft.end >= TODAY ? " The building is open for bed assignment again." : ""}` : "Lease saved.");
    setDraft(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Building Contracts & Renewals" description="Building contracts, their periods and renewals." actions={!readOnly && <Button onClick={() => open()}>Upload lease</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {msg && <Notice tone="good">{msg}</Notice>}
      {expired.map((l) => (
        <Notice key={l.id} tone="bad">
          <b>{pname(l.propertyId)}</b>: building contract expired {fmtDate(l.end)}. The building is removed from new bed assignments until renewed.
          {stillHoused(l.propertyId) > 0 && <> {stillHoused(l.propertyId)} resident(s) are still housed and must be handled manually. Housing Manager notified (in-app alert shown here).</>}
        </Notice>
      ))}
      <KpiGrid>
        <KpiCard label="Current leases" value={current.length} />
        <KpiCard label="Ending within 60 days" value={soon.length} tone={soon.length ? "warn" : "good"} />
        <KpiCard label="Expired" value={expired.length} tone={expired.length ? "bad" : "good"} />
        <KpiCard label="Superseded versions kept" value={ls.length - current.length} />
      </KpiGrid>
      <DataTable rows={rows} columns={cols} exportName="leases" searchPlaceholder="Search leases…"
        onRowClick={readOnly ? undefined : (l) => l.status === "current" && open(l.propertyId)}
        filters={<label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} />Show superseded versions</label>}
        rowClassName={(l) => (l.status === "current" && l.end < TODAY ? "bg-red-50/60 dark:bg-red-950/30" : undefined)} />
      {!readOnly && <p className="text-xs text-muted-foreground">Click a current lease to upload its renewal.</p>}

      <FormSheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title={prev ? "Renew lease" : "Upload lease"} description="A renewal supersedes the previous lease; the old version is kept." onSubmit={save}>
        {draft && (
          <>
            <Errors list={errs} />
            <Field label="Property"><Select value={draft.propertyId} onChange={(e) => { const p = e.target.value; setDraft({ ...draft, propertyId: p, landlord: props.find((x) => x.id === p)?.landlord ?? "" }); }}>{props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            {prev && <Notice tone="warn">Current: {prev.leaseNo}, {fmtDate(prev.start)} to {fmtDate(prev.end)}. This will be superseded.</Notice>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lease number"><Input value={draft.leaseNo} onChange={(e) => setDraft({ ...draft, leaseNo: e.target.value })} /></Field>
              <Field label="Landlord"><Input value={draft.landlord} onChange={(e) => setDraft({ ...draft, landlord: e.target.value })} /></Field>
              <Field label="Lease start"><Input type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></Field>
              <Field label="Lease end"><Input type="date" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></Field>
              <Field label="Monthly cost (KD)"><Input inputMode="decimal" value={draft.rent} onChange={(e) => setDraft({ ...draft, rent: e.target.value })} /></Field>
            </div>
            <Field label="Lease document (PDF or image)"><Input type="file" accept="application/pdf,image/*" onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] })} /></Field>
          </>
        )}
      </FormSheet>
    </div>
  );
}
