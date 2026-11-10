"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { contracts } from "@/data/core";
import { contractDocs, writeAudit, type ContractDoc } from "@/data/commercial";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { Notice, Section, useActor } from "./ui";

const TYPES = ["Signed contract", "Rate schedule", "Amendment", "Insurance certificate", "Draft agreement", "Order form"];
const expiryState = (d: ContractDoc) => (!d.expires ? "no expiry" : d.expires < TODAY ? "expired" : daysBetween(TODAY, d.expires) <= 60 ? "expiring" : "valid");

export default function DocumentsScreen({ role }: { role: string }) {
  const docs = contractDocs.useAll();
  const nos = [...new Set(contracts.useAll().map((c) => c.contractNo))];
  const [no, setNo] = useState("");
  const [show, setShow] = useState("current");
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<ContractDoc | null>(null);
  const shown = docs.filter((d) => (!no || d.contractNo === no) && (show === "all" || d.status === "current"));
  const cols: Column<ContractDoc>[] = [
    { key: "contractNo", header: "Contract" }, { key: "docType", header: "Type" }, { key: "fileName", header: "File" },
    { key: "issued", header: "Issued", cell: (d) => fmtDate(d.issued) }, { key: "expires", header: "Expires", value: (d) => d.expires ?? "9999", cell: (d) => fmtDate(d.expires) },
    { key: "docVersion", header: "Version", cell: (d) => `v${d.docVersion}` },
    { key: "state", header: "Status", value: (d) => (d.status === "superseded" ? "superseded" : expiryState(d)), cell: (d) => d.status === "superseded" ? <StatusBadge>superseded</StatusBadge> : <StatusBadge tone={expiryState(d) === "expired" ? "bad" : expiryState(d) === "expiring" ? "warn" : "good"}>{expiryState(d)}</StatusBadge> },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Contract Documents" description="Signed contracts, rate schedules, amendments and certificates attached to client contracts." actions={<Button onClick={() => setAdding(true)}><Upload /> Upload document</Button>} />
      <DataTable rows={shown} columns={cols} exportName="contract-documents" onRowClick={setSel}
        filters={<>
          <Select className="w-40" value={no} onChange={(e) => setNo(e.target.value)} aria-label="Contract"><option value="">All contracts</option>{nos.map((n) => <option key={n}>{n}</option>)}</Select>
          <Select className="w-44" value={show} onChange={(e) => setShow(e.target.value)} aria-label="Versions"><option value="current">Current versions</option><option value="all">Including superseded</option></Select>
        </>} />
      {adding && <UploadSheet role={role} nos={nos} onClose={() => setAdding(false)} />}
      <FormSheet open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={sel ? `${sel.docType}: ${sel.contractNo}` : ""} hideSubmit>
        {sel && (
          <>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">File</dt><dd>{sel.fileName}</dd></div><div><dt className="text-xs text-muted-foreground">Issuing authority</dt><dd>{sel.authority}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Issued</dt><dd>{fmtDate(sel.issued)}</dd></div><div><dt className="text-xs text-muted-foreground">Expires</dt><dd>{fmtDate(sel.expires)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Uploaded by</dt><dd>{sel.uploadedBy}, {fmtDate(sel.uploadedAt)}</dd></div>
            </dl>
            <Section title="Version history (superseded versions are retained)">
              <ul className="space-y-1 text-sm">{docs.filter((d) => d.contractNo === sel.contractNo && d.docType === sel.docType).sort((a, b) => b.docVersion - a.docVersion).map((d) => <li key={d.id} className="flex justify-between rounded border px-3 py-1.5"><span>v{d.docVersion}: {d.fileName}</span><StatusBadge tone={d.status === "current" ? "good" : "neutral"}>{d.status}</StatusBadge></li>)}</ul>
            </Section>
          </>
        )}
      </FormSheet>
    </div>
  );
}

function UploadSheet({ role, nos, onClose }: { role: string; nos: string[]; onClose: () => void }) {
  const actor = useActor();
  const docs = contractDocs.useAll();
  const [f, setF] = useState({ contractNo: nos[0] ?? "", docType: "Rate schedule", issued: TODAY, expires: "", authority: "", fileName: "" });
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!f.fileName) return setErr("Choose a PDF or image file.");
    if (!f.authority.trim()) return setErr("Issuing authority is required.");
    if (f.expires && f.expires < f.issued) return setErr("Expiry cannot be before the issue date.");
    const prev = docs.filter((d) => d.contractNo === f.contractNo && d.docType === f.docType);
    const version = Math.max(0, ...prev.map((d) => d.docVersion)) + 1;
    await contractDocs.saveMany([
      ...prev.filter((d) => d.status === "current").map((d) => ({ ...d, status: "superseded" as const })),
      { id: contractDocs.nextId("doc"), contractNo: f.contractNo, docType: f.docType, fileName: f.fileName, issued: f.issued, expires: f.expires || null, authority: f.authority.trim(), uploadedBy: actor.name, uploadedAt: TODAY, docVersion: version, status: "current" },
    ]);
    await writeAudit({ user: actor.name, role, entityType: "document", entityId: f.contractNo, entityLabel: `${f.docType} ${f.fileName}`, action: "create", summary: `${f.docType} v${version} uploaded${prev.length ? `; v${version - 1} retained as superseded` : ""}`, reason: "Document upload" });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Upload document" description="A new document of the same type supersedes the current one; the old one is kept." onSubmit={submit}>
      {err && <Notice tone="bad">{err}</Notice>}
      <Field label="Contract"><Select value={f.contractNo} onChange={(e) => setF({ ...f, contractNo: e.target.value })}>{nos.map((n) => <option key={n}>{n}</option>)}</Select></Field>
      <Field label="Document type"><Select value={f.docType} onChange={(e) => setF({ ...f, docType: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
      <Field label="File (PDF or image)"><input type="file" accept="application/pdf,image/*" className="text-sm" onChange={(e) => setF({ ...f, fileName: e.target.files?.[0]?.name ?? "" })} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Issued"><Input type="date" value={f.issued} onChange={(e) => setF({ ...f, issued: e.target.value })} /></Field><Field label="Expires (optional)"><Input type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></Field></div>
      <Field label="Issuing authority"><Input value={f.authority} onChange={(e) => setF({ ...f, authority: e.target.value })} /></Field>
    </FormSheet>
  );
}
