"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { Button } from "@/components/ui/button";
import { clients, contracts, type Client } from "@/data/core";
import { audit, clientMeta, type ClientMeta } from "@/data/admin";
import type { ScreenProps } from "../types";
import { AuditTrail, CONFLICT, Notice, stillCurrent, useActor, useBanner } from "./shared";

type Row = Client & { meta: ClientMeta; contractCount: number };
const TYPES = ["Store-based", "Marketplace", "Labour supply", "Labour supply (hourly)", "Bulk delivery"];
const blank = { name: "", legalName: "", type: TYPES[0], contactName: "", contactPhone: "", sites: "", reason: "" };

export default function ClientsScreen({ readOnly, editedBy }: ScreenProps) {
  const cls = clients.useAll();
  const metas = clientMeta.useAll();
  const cons = contracts.useAll();
  const actor = useActor();
  const banner = useBanner();
  const [edit, setEdit] = useState<Row | "new" | null>(null);
  const [f, setF] = useState(blank);
  const [opened, setOpened] = useState(0);
  const [err, setErr] = useState("");

  const rows: Row[] = cls.map((c) => ({
    ...c,
    meta: metas.find((m) => m.id === c.id) ?? { id: c.id, active: true, type: c.model, linkedSites: [], version: 1 },
    contractCount: cons.filter((k) => k.clientId === c.id && k.status === "active").length,
  }));

  const open = (r: Row | "new") => {
    setErr("");
    if (r === "new") { setF(blank); setOpened(0); }
    else { setF({ name: r.name, legalName: r.legalName, type: r.meta.type, contactName: r.contactName, contactPhone: r.contactPhone, sites: r.meta.linkedSites.join(", "), reason: "" }); setOpened(r.meta.version); }
    setEdit(r);
  };

  const save = async () => {
    if (!f.name.trim()) return setErr("Client name is required.");
    if (!f.legalName.trim()) return setErr("The legal entity name is required: it is printed on invoices.");
    const isNew = edit === "new";
    if (rows.some((r) => r.name.toLowerCase() === f.name.trim().toLowerCase() && (isNew || r.id !== (edit as Row).id))) return setErr("A client with this name already exists.");
    const sites = f.sites.split(",").map((x) => x.trim()).filter(Boolean);
    if (isNew) {
      const id = `cli-${f.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14)}`;
      await clients.save({ id, name: f.name.trim(), legalName: f.legalName.trim(), model: f.type, contactName: f.contactName.trim(), contactPhone: f.contactPhone.trim() });
      await clientMeta.save({ id, active: true, type: f.type, linkedSites: sites, version: 1 });
      await audit({ actor, entity: "client", entityId: id, action: "Client added", detail: `${f.name.trim()}, legal entity ${f.legalName.trim()}` });
      banner.ok(`${f.name.trim()} added. Finance adds contracts and rates.`);
    } else {
      const r = edit as Row;
      if (!f.reason.trim()) return setErr("A reason is required for an edit.");
      if (!stillCurrent(clientMeta.getSync(r.id) ?? r.meta, opened)) return setErr(CONFLICT);
      await clients.save({ ...r, id: r.id, name: f.name.trim(), legalName: f.legalName.trim(), model: f.type, contactName: f.contactName.trim(), contactPhone: f.contactPhone.trim() });
      await clientMeta.save({ ...r.meta, type: f.type, linkedSites: sites, version: r.meta.version + 1 });
      const changed = [r.name !== f.name.trim() && "name", r.legalName !== f.legalName.trim() && "legal entity", r.meta.type !== f.type && "type", r.meta.linkedSites.join(", ") !== sites.join(", ") && "linked sites", (r.contactName !== f.contactName || r.contactPhone !== f.contactPhone) && "contact"].filter(Boolean).join(", ");
      await audit({ actor, entity: "client", entityId: r.id, action: "Client edited", detail: `Changed: ${changed || "no fields"}`, reason: f.reason });
      banner.ok(`${f.name.trim()} updated.`);
    }
    setEdit(null);
  };

  const toggle = async (r: Row) => {
    if (!f.reason.trim()) return setErr("Give a reason to deactivate or reactivate.");
    if (!stillCurrent(clientMeta.getSync(r.id) ?? r.meta, opened)) return setErr(CONFLICT);
    if (r.meta.active && r.contractCount > 0) return setErr(`${r.contractCount} active contract(s) exist. Finance must end them before the client can be deactivated.`);
    await clientMeta.save({ ...r.meta, active: !r.meta.active, deactivatedReason: r.meta.active ? f.reason : undefined, version: r.meta.version + 1 });
    await audit({ actor, entity: "client", entityId: r.id, action: r.meta.active ? "Client deactivated" : "Client reactivated", detail: r.name, reason: f.reason });
    setEdit(null);
  };

  const cols: Column<Row>[] = [
    { key: "name", header: "Client" },
    { key: "legalName", header: "Legal entity (invoicing)" },
    { key: "type", header: "Type", value: (r) => r.meta.type },
    { key: "contactName", header: "Contact", value: (r) => `${r.contactName} ${r.contactPhone}` },
    { key: "sites", header: "Linked stores / zones", value: (r) => r.meta.linkedSites.join(", ") || "—", className: "max-w-56 whitespace-normal" },
    { key: "contractCount", header: "Active contracts", align: "end" },
    { key: "active", header: "Status", value: (r) => (r.meta.active ? "active" : "inactive"), cell: (r) => <StatusBadge tone={r.meta.active ? "good" : "bad"}>{r.meta.active ? "Active" : "Inactive"}</StatusBadge> },
  ];
  const cur = edit && edit !== "new" ? edit : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Clients" description="Customer platforms and brands. Contracts, rates and revenue are managed by Finance / Commercial." actions={!readOnly && <Button onClick={() => open("new")}><Plus /> Add client</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {banner.msg && <Notice tone={banner.msg.tone}>{banner.msg.text}</Notice>}
      <Tabs tabs={[
        { id: "list", label: "Clients", content: <DataTable rows={rows} columns={cols} onRowClick={readOnly ? undefined : open} exportName="clients" searchPlaceholder="Search clients" /> },
        { id: "audit", label: "Audit log", content: <AuditTrail entity="client" /> },
      ]} />
      <FormSheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={cur ? `Edit ${cur.name}` : "Add client"} onSubmit={save} wide>
        {err && <Notice tone="bad">{err}</Notice>}
        <Field label="Client name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Legal entity name (used on invoices)"><Input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} /></Field>
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact name"><Input value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} /></Field>
          <Field label="Contact phone"><Input value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} /></Field>
        </div>
        <Field label="Linked stores and zones" hint="Comma separated. Maintained in detail on the Operations Stores & Zones page."><Input value={f.sites} onChange={(e) => setF({ ...f, sites: e.target.value })} /></Field>
        {cur && (
          <>
            <Field label="Reason (audited)"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{cur.meta.active ? `${cur.contractCount} active contract(s)` : `Deactivated: ${cur.meta.deactivatedReason ?? ""}`}</span>
              <Button type="button" variant={cur.meta.active ? "destructive" : "outline"} onClick={() => toggle(cur)}>{cur.meta.active ? "Deactivate" : "Reactivate"}</Button>
            </div>
            <Link href="/finance/contracts" className="text-sm underline">Open contracts and rates (Finance)</Link>
          </>
        )}
      </FormSheet>
    </div>
  );
}
