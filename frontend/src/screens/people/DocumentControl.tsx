"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { Button } from "@/components/ui/button";
import { contracts, vehicles, workers } from "@/data/core";
import { docAudit, docType, docTypesFor, documents, OWNER_LABEL, properties, type DocRecord, type OwnerKind } from "@/data/people";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { DaysBadge, Errors, Notice, stamp, useActor } from "./common";

interface Draft {
  ownerKind: OwnerKind; ownerId: string; typeKey: string; issueDate: string; expiryDate: string; authority: string; notes: string; reason: string;
  file?: File; editId?: string; renewOf?: string;
}
const MAX_INLINE = 150_000;

const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result));
  r.onerror = () => rej(r.error);
  r.readAsDataURL(f);
});

export default function DocumentControl({ role, readOnly, editedBy, kinds, title, description }: ScreenProps & { kinds: OwnerKind[]; title: string; description: string }) {
  const actor = useActor();
  const docs = documents.useAll();
  const audit = docAudit.useAll();
  const ws = workers.useAll();
  const vs = vehicles.useAll();
  const cs = contracts.useAll();
  const ps = properties.useAll();
  const isAdmin = role === "admin";

  const [kindF, setKindF] = useState<OwnerKind | "all">("all");
  const [typeF, setTypeF] = useState("all");
  const [view, setView] = useState<"current" | "superseded" | "all">("current");
  const [expF, setExpF] = useState<"all" | "expired" | "30" | "60">("all");
  const [sel, setSel] = useState<DocRecord | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [recordOwner, setRecordOwner] = useState<{ kind: OwnerKind; id: string }>({ kind: kinds[0], id: "" });

  const owners = useMemo(() => ({
    worker: ws.map((w) => ({ id: w.id, label: `${w.name} (${w.username})` })),
    vehicle: vs.map((v) => ({ id: v.id, label: `${v.plate}, ${v.make} ${v.model}` })),
    contract: cs.filter((c) => c.status !== "superseded").map((c) => ({ id: c.id, label: `${c.contractNo} v${c.version}` })),
    property: ps.map((p) => ({ id: p.id, label: p.name })),
  }), [ws, vs, cs, ps]);
  const ownerLabel = (k: OwnerKind, id: string) => owners[k].find((o) => o.id === id)?.label ?? cs.find((c) => c.id === id)?.contractNo ?? id;

  const scoped = docs.filter((d) => kinds.includes(d.ownerKind));
  const rows = scoped.filter((d) => {
    if (kindF !== "all" && d.ownerKind !== kindF) return false;
    if (typeF !== "all" && d.typeKey !== typeF) return false;
    if (view !== "all" && d.status !== view) return false;
    if (expF !== "all") {
      if (!d.expiryDate || d.status !== "current") return false;
      const left = daysBetween(TODAY, d.expiryDate);
      if (expF === "expired" ? left >= 0 : left < 0 || left > Number(expF)) return false;
    }
    return true;
  });
  const current = scoped.filter((d) => d.status === "current");
  const kpi = {
    cur: current.length,
    sup: scoped.length - current.length,
    exp: current.filter((d) => d.expiryDate && daysBetween(TODAY, d.expiryDate) < 0).length,
    soon: current.filter((d) => d.expiryDate && daysBetween(TODAY, d.expiryDate) >= 0 && daysBetween(TODAY, d.expiryDate) <= 60).length,
  };

  const cols: Column<DocRecord>[] = [
    { key: "owner", header: "Owner", value: (d) => `${OWNER_LABEL[d.ownerKind]} ${ownerLabel(d.ownerKind, d.ownerId)}`, cell: (d) => <div><div className="font-medium">{ownerLabel(d.ownerKind, d.ownerId)}</div><div className="text-xs text-muted-foreground">{OWNER_LABEL[d.ownerKind]}</div></div> },
    { key: "type", header: "Type", value: (d) => docType(d.typeKey)?.label },
    { key: "issue", header: "Issued", value: (d) => d.issueDate, cell: (d) => fmtDate(d.issueDate) },
    { key: "expiry", header: "Expires", value: (d) => d.expiryDate, cell: (d) => fmtDate(d.expiryDate) },
    { key: "left", header: "Days left", value: (d) => (d.expiryDate ? daysBetween(TODAY, d.expiryDate) : 99999), cell: (d) => (d.status === "superseded" ? <StatusBadge>Superseded</StatusBadge> : <DaysBadge days={d.expiryDate ? daysBetween(TODAY, d.expiryDate) : null} />) },
    { key: "authority", header: "Authority" },
    { key: "file", header: "File", value: (d) => d.fileName },
    { key: "version", header: "Version", align: "end", value: (d) => d.version, cell: (d) => `v${d.version}` },
    { key: "by", header: "Uploaded", value: (d) => `${d.uploadedBy} ${d.uploadedAt}`, cell: (d) => <span className="text-xs">{d.uploadedBy}<br />{fmtDate(d.uploadedAt)}</span> },
  ];

  const blank = (): Draft => ({ ownerKind: kinds[0], ownerId: "", typeKey: docTypesFor(kinds[0])[0].key, issueDate: TODAY, expiryDate: "", authority: "", notes: "", reason: "" });
  const openUpload = (p?: Partial<Draft>) => { setErrs([]); setSel(null); setDraft({ ...blank(), ...p }); };
  const renew = (d: DocRecord) => openUpload({ ownerKind: d.ownerKind, ownerId: d.ownerId, typeKey: d.typeKey, authority: d.authority, renewOf: d.id });
  const edit = (d: DocRecord) => { setErrs([]); setSel(null); setDraft({ ownerKind: d.ownerKind, ownerId: d.ownerId, typeKey: d.typeKey, issueDate: d.issueDate ?? "", expiryDate: d.expiryDate ?? "", authority: d.authority, notes: d.notes ?? "", reason: "", editId: d.id }); };

  const existing = draft && !draft.editId ? docs.find((d) => d.status === "current" && d.ownerKind === draft.ownerKind && d.ownerId === draft.ownerId && d.typeKey === draft.typeKey) : undefined;

  const submit = async () => {
    if (!draft) return;
    const t = docType(draft.typeKey);
    const e: string[] = [];
    if (!draft.ownerId) e.push("Choose the record this document belongs to");
    if (!t) e.push("Choose a document type");
    if (!draft.editId && !draft.file) e.push("Choose a PDF or image file");
    if (draft.file && !/^(application\/pdf|image\/)/.test(draft.file.type)) e.push("Only PDF and image files can be uploaded");
    if (t?.expires && !draft.expiryDate) e.push(`${t.label} needs an expiry date`);
    if (draft.issueDate && draft.expiryDate && draft.expiryDate < draft.issueDate) e.push("Expiry date cannot be before the issue date");
    if (!draft.authority.trim()) e.push("Issuing authority is required");
    if (isAdmin && !draft.reason.trim()) e.push("A reason is required for every admin change");
    if (existing && draft.issueDate && existing.issueDate && draft.issueDate < existing.issueDate) e.push("The new issue date is earlier than the current version's issue date");
    setErrs(e);
    if (e.length) return;
    setBusy(true);
    try {
      if (draft.editId) {
        const old = docs.find((d) => d.id === draft.editId)!;
        await documents.save({ ...old, issueDate: draft.issueDate || null, expiryDate: draft.expiryDate || null, authority: draft.authority.trim(), notes: draft.notes || undefined });
        await docAudit.save({ id: docAudit.nextId("da"), docId: old.id, at: stamp(), by: actor, action: "Edited details", reason: draft.reason || undefined });
      } else {
        const f = draft.file!;
        const dataUrl = f.size <= MAX_INLINE ? await readAsDataUrl(f) : undefined;
        const id = documents.nextId("doc");
        const nextVersion = existing ? existing.version + 1 : 1;
        if (existing) await documents.save({ ...existing, status: "superseded", supersededById: id });
        await documents.save({
          id, ownerKind: draft.ownerKind, ownerId: draft.ownerId, typeKey: draft.typeKey, issueDate: draft.issueDate || null, expiryDate: draft.expiryDate || null,
          authority: draft.authority.trim(), fileName: f.name, fileSize: f.size, mime: f.type, dataUrl, version: nextVersion, status: "current",
          uploadedBy: actor, uploadedAt: TODAY, notes: draft.notes || (existing ? `Renewal of ${existing.id}` : undefined),
        });
        await docAudit.save({ id: docAudit.nextId("da"), docId: id, at: stamp(), by: actor, action: existing ? `Uploaded v${nextVersion}, superseded ${existing.id}` : "Uploaded", reason: draft.reason || undefined });
        if (existing) await docAudit.save({ id: docAudit.nextId("da"), docId: existing.id, at: stamp(), by: actor, action: `Superseded by ${id}`, reason: draft.reason || undefined });
      }
      setDraft(null);
    } finally { setBusy(false); }
  };

  const history = sel ? docs.filter((d) => d.ownerKind === sel.ownerKind && d.ownerId === sel.ownerId && d.typeKey === sel.typeKey).sort((a, b) => b.version - a.version) : [];

  const recordDocs = docs.filter((d) => d.ownerKind === recordOwner.kind && d.ownerId === recordOwner.id);
  const recordCurrent = recordDocs.filter((d) => d.status === "current");
  const missingTypes = recordOwner.id ? docTypesFor(recordOwner.kind).filter((t) => t.required && !recordCurrent.some((d) => d.typeKey === t.key)) : [];

  const typeOptions = kindF === "all" ? kinds.flatMap(docTypesFor) : docTypesFor(kindF);

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actions={!readOnly && <Button onClick={() => openUpload()}>Upload document</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Current documents" value={kpi.cur} />
        <KpiCard label="Superseded versions kept" value={kpi.sup} />
        <KpiCard label="Expired" value={kpi.exp} tone={kpi.exp ? "bad" : "good"} />
        <KpiCard label="Expiring within 60 days" value={kpi.soon} tone={kpi.soon ? "warn" : "good"} />
      </KpiGrid>
      <Tabs tabs={[
        { id: "list", label: "Documents", content: (
          <DataTable rows={rows} columns={cols} onRowClick={setSel} exportName="documents" searchPlaceholder="Search documents…"
            filters={<>
              {kinds.length > 1 && <Select className="w-36" value={kindF} onChange={(e) => { setKindF(e.target.value as OwnerKind | "all"); setTypeF("all"); }}><option value="all">All owners</option>{kinds.map((k) => <option key={k} value={k}>{OWNER_LABEL[k]}</option>)}</Select>}
              <Select className="w-48" value={typeF} onChange={(e) => setTypeF(e.target.value)}><option value="all">All types</option>{typeOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select>
              <Select className="w-36" value={view} onChange={(e) => setView(e.target.value as typeof view)}><option value="current">Current only</option><option value="superseded">Superseded</option><option value="all">All versions</option></Select>
              <Select className="w-36" value={expF} onChange={(e) => setExpF(e.target.value as typeof expF)}><option value="all">Any expiry</option><option value="expired">Expired</option><option value="30">Within 30 days</option><option value="60">Within 60 days</option></Select>
            </>} />) },
        { id: "record", label: "By record", content: (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {kinds.length > 1 && <Select className="w-40" value={recordOwner.kind} onChange={(e) => setRecordOwner({ kind: e.target.value as OwnerKind, id: "" })}>{kinds.map((k) => <option key={k} value={k}>{OWNER_LABEL[k]}</option>)}</Select>}
              <Select className="w-80" value={recordOwner.id} onChange={(e) => setRecordOwner({ ...recordOwner, id: e.target.value })}>
                <option value="">Choose {OWNER_LABEL[recordOwner.kind].toLowerCase()}…</option>
                {owners[recordOwner.kind].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </div>
            {recordOwner.id && (
              <>
                {missingTypes.length > 0 && <Notice tone="warn">Missing entirely: {missingTypes.map((t) => t.label).join(", ")}</Notice>}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recordCurrent.map((d) => (
                    <button key={d.id} type="button" onClick={() => setSel(d)} className="rounded-lg border bg-card p-3 text-start hover:bg-muted/40">
                      <div className="flex items-center justify-between"><span className="font-medium">{docType(d.typeKey)?.label}</span><span className="text-xs text-muted-foreground">v{d.version}</span></div>
                      <div className="mt-1 text-xs text-muted-foreground">{d.fileName}</div>
                      <div className="mt-2 flex items-center justify-between text-xs"><span>Expires {fmtDate(d.expiryDate)}</span><DaysBadge days={d.expiryDate ? daysBetween(TODAY, d.expiryDate) : null} /></div>
                    </button>
                  ))}
                  {recordCurrent.length === 0 && <p className="text-sm text-muted-foreground">No current documents.</p>}
                </div>
                {recordDocs.length > recordCurrent.length && <p className="text-xs text-muted-foreground">{recordDocs.length - recordCurrent.length} superseded version(s) retained. Open a document to see its history.</p>}
              </>
            )}
          </div>) },
        { id: "audit", label: "Audit trail", content: (
          <DataTable rows={[...audit].reverse()} exportName="document-audit" columns={[
            { key: "at", header: "When" }, { key: "by", header: "By" },
            { key: "doc", header: "Document", value: (a) => { const d = docs.find((x) => x.id === a.docId); return d ? `${ownerLabel(d.ownerKind, d.ownerId)}: ${docType(d.typeKey)?.label} v${d.version}` : a.docId; } },
            { key: "action", header: "Action" }, { key: "reason", header: "Reason" },
          ]} />) },
      ]} />

      <FormSheet open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={sel ? `${docType(sel.typeKey)?.label} v${sel.version}` : ""} description={sel ? ownerLabel(sel.ownerKind, sel.ownerId) : undefined} hideSubmit wide>
        {sel && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Status</dt><dd>{sel.status === "current" ? <StatusBadge tone="good">Current</StatusBadge> : <StatusBadge>Superseded</StatusBadge>}</dd>
              <dt className="text-muted-foreground">Issued</dt><dd>{fmtDate(sel.issueDate)}</dd>
              <dt className="text-muted-foreground">Expires</dt><dd>{fmtDate(sel.expiryDate)}</dd>
              <dt className="text-muted-foreground">Issuing authority</dt><dd>{sel.authority}</dd>
              <dt className="text-muted-foreground">File</dt><dd>{sel.dataUrl ? <a className="underline" href={sel.dataUrl} download={sel.fileName} target="_blank" rel="noreferrer">{sel.fileName}</a> : sel.fileName} <span className="text-xs text-muted-foreground">({Math.round(sel.fileSize / 1024)} KB{sel.dataUrl ? "" : ", metadata only"})</span></dd>
              <dt className="text-muted-foreground">Uploaded</dt><dd>{sel.uploadedBy}, {fmtDate(sel.uploadedAt)}</dd>
              {sel.notes && <><dt className="text-muted-foreground">Notes</dt><dd>{sel.notes}</dd></>}
            </dl>
            {sel.dataUrl && sel.mime.startsWith("image/") && (
              <div role="img" aria-label={sel.fileName} className="h-48 w-full rounded border bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${sel.dataUrl})` }} />
            )}
            {!readOnly && (
              <div className="flex gap-2">
                {sel.status === "current" && <Button size="sm" onClick={() => renew(sel)}>Renew (supersede)</Button>}
                {isAdmin && <Button size="sm" variant="outline" onClick={() => edit(sel)}>Edit details</Button>}
              </div>
            )}
            <div>
              <h3 className="mb-1 font-medium">Version history (superseded versions are retained)</h3>
              <table className="w-full text-xs">
                <thead><tr className="text-muted-foreground"><th className="text-start">Version</th><th className="text-start">Issued</th><th className="text-start">Expires</th><th className="text-start">File</th><th className="text-start">Status</th></tr></thead>
                <tbody>{history.map((h) => <tr key={h.id} className="border-t"><td>v{h.version}</td><td>{fmtDate(h.issueDate)}</td><td>{fmtDate(h.expiryDate)}</td><td>{h.fileName}</td><td>{h.status}</td></tr>)}</tbody>
              </table>
            </div>
            <div>
              <h3 className="mb-1 font-medium">Audit trail</h3>
              <ul className="space-y-1 text-xs">
                {audit.filter((a) => history.some((h) => h.id === a.docId)).map((a) => <li key={a.id}>{a.at}, {a.by}: {a.action}{a.reason ? ` (reason: ${a.reason})` : ""}</li>)}
                {!audit.some((a) => history.some((h) => h.id === a.docId)) && <li className="text-muted-foreground">Upload recorded: {sel.uploadedBy}, {fmtDate(sel.uploadedAt)}</li>}
              </ul>
            </div>
          </div>
        )}
      </FormSheet>

      <FormSheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title={draft?.editId ? "Edit document details" : draft?.renewOf ? "Renew document" : "Upload document"} submitLabel={busy ? "Saving…" : draft?.editId ? "Save changes" : "Upload"} onSubmit={submit}>
        {draft && (
          <>
            <Errors list={errs} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Belongs to">
                <Select value={draft.ownerKind} disabled={!!draft.editId || !!draft.renewOf} onChange={(e) => { const k = e.target.value as OwnerKind; setDraft({ ...draft, ownerKind: k, ownerId: "", typeKey: docTypesFor(k)[0].key }); }}>
                  {kinds.map((k) => <option key={k} value={k}>{OWNER_LABEL[k]}</option>)}
                </Select>
              </Field>
              <Field label="Document type">
                <Select value={draft.typeKey} disabled={!!draft.editId || !!draft.renewOf} onChange={(e) => setDraft({ ...draft, typeKey: e.target.value })}>
                  {docTypesFor(draft.ownerKind).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Record">
              <Select value={draft.ownerId} disabled={!!draft.editId || !!draft.renewOf} onChange={(e) => setDraft({ ...draft, ownerId: e.target.value })}>
                <option value="">Choose…</option>
                {owners[draft.ownerKind].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
            {existing && <Notice tone="warn">A current version (v{existing.version}, expires {fmtDate(existing.expiryDate)}) exists. Uploading supersedes it; the old version is kept.</Notice>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issue date"><Input type="date" value={draft.issueDate} onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })} /></Field>
              <Field label={`Expiry date${docType(draft.typeKey)?.expires ? "" : " (optional)"}`}><Input type="date" value={draft.expiryDate} onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })} /></Field>
            </div>
            <Field label="Issuing authority"><Input value={draft.authority} onChange={(e) => setDraft({ ...draft, authority: e.target.value })} /></Field>
            {!draft.editId && (
              <Field label="File (PDF or image)" hint={draft.file ? `${draft.file.name}, ${Math.round(draft.file.size / 1024)} KB${draft.file.size > MAX_INLINE ? ". Large file: only the file name and size are stored in this demo." : ""}` : undefined}>
                <Input type="file" accept="application/pdf,image/*" onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] })} />
              </Field>
            )}
            <Field label="Notes"><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
            {isAdmin && <Field label="Reason for this change (mandatory, audited)"><Textarea value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></Field>}
          </>
        )}
      </FormSheet>
    </div>
  );
}
