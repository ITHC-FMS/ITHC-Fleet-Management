"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { companies, type Company } from "@/data/core";
import { audit, companyProfiles, managedUsers, type CompanyProfile } from "@/data/admin";
import type { ScreenProps } from "../types";
import { AuditTrail, CONFLICT, Notice, Section, stillCurrent, useActor, useBanner } from "./shared";

type Row = Company & { p: CompanyProfile; users: number };

export default function CompanyScreen({ readOnly, editedBy }: ScreenProps) {
  const cs = companies.useAll();
  const ps = companyProfiles.useAll();
  const us = managedUsers.useAll();
  const actor = useActor();
  const banner = useBanner();
  const [edit, setEdit] = useState<Row | null>(null);
  const [f, setF] = useState({ legalName: "", address: "", crNo: "", phone: "", letterheadLine: "", footer: "", reason: "" });
  const [opened, setOpened] = useState(0);
  const [err, setErr] = useState("");

  const rows: Row[] = cs.map((c) => ({
    ...c,
    p: ps.find((p) => p.id === c.id) ?? { id: c.id, legalName: c.name, address: "", crNo: "", phone: "", letterheadLine: "", footer: "", version: 1 },
    users: us.filter((u) => u.status === "active" && u.scope.employingCompanyIds.includes(c.id)).length,
  }));
  const ithc = rows.find((r) => r.kind === "operating")!;
  const complete = !!(ithc.p.legalName && ithc.p.letterheadLine && ithc.p.crNo && ithc.p.address);

  const open = (r: Row) => { setEdit(r); setErr(""); setOpened(r.p.version); setF({ legalName: r.p.legalName, address: r.p.address, crNo: r.p.crNo, phone: r.p.phone, letterheadLine: r.p.letterheadLine, footer: r.p.footer, reason: "" }); };

  const save = async () => {
    if (!edit) return;
    if (!f.legalName.trim() || !f.address.trim() || !f.crNo.trim()) return setErr("Legal name, address and commercial registration number are required.");
    if (!f.reason.trim()) return setErr("A reason is required.");
    if (!stillCurrent(companyProfiles.getSync(edit.id) ?? edit.p, opened)) return setErr(CONFLICT);
    await companyProfiles.save({ id: edit.id, legalName: f.legalName.trim(), address: f.address.trim(), crNo: f.crNo.trim(), phone: f.phone.trim(), letterheadLine: f.letterheadLine.trim(), footer: f.footer.trim(), version: edit.p.version + 1 });
    await audit({ actor, entity: "company", entityId: edit.id, action: "Company profile edited", detail: edit.name, reason: f.reason });
    banner.ok("Company profile saved. Payslip exports use the new letterhead.");
    setEdit(null);
  };

  const cols: Column<Row>[] = [
    { key: "name", header: "Company" },
    { key: "kind", header: "Role", value: (r) => (r.kind === "operating" ? "Operating company" : "External lessor"), cell: (r) => <StatusBadge tone={r.kind === "operating" ? "good" : "info"}>{r.kind === "operating" ? "Operating company" : "External lessor"}</StatusBadge> },
    { key: "legal", header: "Legal name", value: (r) => r.p.legalName },
    { key: "letterhead", header: "Letterhead", value: (r) => (r.kind === "operating" ? (r.p.letterheadLine ? "Set" : "Missing") : "n/a") },
    { key: "users", header: "Users", align: "end", value: (r) => (r.kind === "operating" ? r.users : "n/a") },
    { key: "act", header: "", sortable: false, cell: (r) => r.kind === "operating" && !readOnly ? <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); open(r); }}>Edit company</Button> : r.kind === "lessor" ? <Link className="text-xs underline" href="/fleet/lessors">Managed by Fleet</Link> : null },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Company Profile" description="ITHC Logistics is the only operating company. Max Dash and Swift Link are external lessors." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {banner.msg && <Notice tone={banner.msg.tone}>{banner.msg.text}</Notice>}
      <Notice tone={complete ? "good" : "warn"}>Go-live readiness: {complete ? "company profile and payslip letterhead are complete." : "complete the company profile and letterhead before go-live."}</Notice>
      <DataTable rows={rows} columns={cols} exportName="companies" searchPlaceholder="Search companies" />
      <Section title="Payslip letterhead preview" hint="Printed at the top of every exported payslip.">
        <div className="rounded-md border bg-white p-6 text-center text-black">
          <p className="text-lg font-semibold">{ithc.p.legalName}</p>
          <p className="text-sm">{ithc.p.letterheadLine || "(no letterhead line)"}</p>
          <hr className="my-3" />
          <p className="text-xs text-neutral-500">{ithc.p.footer || "(no footer)"}</p>
        </div>
      </Section>
      <Section title="Audit log"><AuditTrail entity="company" /></Section>
      <FormSheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title="Edit company" description={edit?.name} onSubmit={save} wide>
        {err && <Notice tone="bad">{err}</Notice>}
        <Field label="Legal name"><Input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} /></Field>
        <Field label="Address"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Commercial registration"><Input value={f.crNo} onChange={(e) => setF({ ...f, crNo: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
        <Field label="Letterhead line"><Input value={f.letterheadLine} onChange={(e) => setF({ ...f, letterheadLine: e.target.value })} /></Field>
        <Field label="Letterhead footer"><Textarea value={f.footer} onChange={(e) => setF({ ...f, footer: e.target.value })} /></Field>
        <Field label="Reason (audited)"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
      </FormSheet>
    </div>
  );
}
