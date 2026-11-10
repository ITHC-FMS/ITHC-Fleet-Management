"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, toneFor } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { Button } from "@/components/ui/button";
import { clients } from "@/data/core";
import { stores, writeAudit, zones, type Store, type Zone } from "@/data/commercial";
import type { ScreenProps } from "../types";
import { Notice, useActor } from "./ui";

export default function StoresScreen({ role, readOnly, editedBy }: ScreenProps) {
  const ss = stores.useAll(), zs = zones.useAll(), cl = clients.useAll();
  const [store, setStore] = useState<Store | "new" | null>(null);
  const [zone, setZone] = useState<Zone | "new" | null>(null);
  const [client, setClient] = useState("");
  const zn = (id: string) => zs.find((z) => z.id === id)?.name ?? id;
  const cn = (id: string) => cl.find((c) => c.id === id)?.name ?? id;
  const storeCols: Column<Store>[] = [
    { key: "name", header: "Store" }, { key: "client", header: "Client", value: (s) => cn(s.clientId) }, { key: "zone", header: "Zone", value: (s) => zn(s.zoneId) },
    { key: "address", header: "Area / address" }, { key: "status", header: "Status", cell: (s) => <StatusBadge tone={toneFor(s.status)}>{s.status}</StatusBadge> },
  ];
  const zoneCols: Column<Zone & { stores: number }>[] = [
    { key: "name", header: "Zone" }, { key: "area", header: "Area" }, { key: "stores", header: "Stores", align: "end" },
    { key: "status", header: "Status", cell: (z) => <StatusBadge tone={toneFor(z.status)}>{z.status}</StatusBadge> },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Stores & Zones" description="Collection and delivery geography for store-based clients. Used by order entry and the schedule."
        actions={!readOnly && <><Button variant="outline" onClick={() => setZone("new")}><Plus /> Add zone</Button><Button onClick={() => setStore("new")}><Plus /> Add store</Button></>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <Tabs tabs={[
        { id: "stores", label: "Stores", content: <DataTable rows={ss.filter((s) => !client || s.clientId === client)} columns={storeCols} exportName="stores" onRowClick={!readOnly ? setStore : undefined}
          filters={<Select className="w-44" value={client} onChange={(e) => setClient(e.target.value)} aria-label="Client"><option value="">All clients</option>{cl.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>} /> },
        { id: "zones", label: "Zones", content: <DataTable rows={zs.map((z) => ({ ...z, stores: ss.filter((s) => s.zoneId === z.id && s.status === "active").length }))} columns={zoneCols} exportName="zones" onRowClick={!readOnly ? (z) => setZone(zs.find((x) => x.id === z.id)!) : undefined} /> },
      ]} />
      {store && <StoreSheet key={typeof store === "string" ? store : store.id} row={store} role={role} onClose={() => setStore(null)} />}
      {zone && <ZoneSheet key={typeof zone === "string" ? zone : zone.id} row={zone} role={role} onClose={() => setZone(null)} />}
    </div>
  );
}

function StoreSheet({ row, role, onClose }: { row: Store | "new"; role: string; onClose: () => void }) {
  const actor = useActor();
  const cl = clients.useAll(), zs = zones.useAll();
  const cur = row === "new" ? undefined : row;
  const [f, setF] = useState({ name: cur?.name ?? "", clientId: cur?.clientId ?? "cli-americana", zoneId: cur?.zoneId ?? zs[0]?.id ?? "", address: cur?.address ?? "", status: cur?.status ?? "active" });
  const [loaded] = useState(cur?.version ?? 0);
  const [err, setErr] = useState("");
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const submit = async () => {
    if (!f.name.trim()) return setErr("Store name is required.");
    const live = cur && stores.getSync(cur.id);
    if (cur && (!live || live.version !== loaded)) return setErr("Conflict: this store was changed by someone else. Close and reopen.");
    if ((await stores.list()).some((s) => s.id !== cur?.id && s.clientId === f.clientId && s.name.toLowerCase() === f.name.trim().toLowerCase())) return setErr("This client already has a store with that name.");
    const next: Store = { id: cur?.id ?? stores.nextId("sto"), name: f.name.trim(), clientId: f.clientId, zoneId: f.zoneId, address: f.address.trim(), status: f.status, version: (cur?.version ?? 0) + 1 };
    await stores.save(next);
    await writeAudit({ user: actor.name, role, entityType: "store", entityId: next.id, entityLabel: next.name, action: cur ? "update" : "create", summary: cur ? `Store edited (${cur.status} to ${next.status}, zone ${cur.zoneId} to ${next.zoneId})` : "Store created", reason: cur ? "Store details maintained by operations" : "New store onboarded" });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={cur ? "Edit store" : "Add store"} onSubmit={submit}>
      {err && <Notice tone="bad">{err}</Notice>}
      <Field label="Name"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="Client"><Select value={f.clientId} onChange={(e) => set({ clientId: e.target.value })}>{cl.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Zone"><Select value={f.zoneId} onChange={(e) => set({ zoneId: e.target.value })}>{zs.filter((z) => z.status === "active" || z.id === f.zoneId).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</Select></Field>
      <Field label="Area / address"><Input value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
      <Field label="Status"><Select value={f.status} onChange={(e) => set({ status: e.target.value as Store["status"] })}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
    </FormSheet>
  );
}

function ZoneSheet({ row, role, onClose }: { row: Zone | "new"; role: string; onClose: () => void }) {
  const actor = useActor();
  const cur = row === "new" ? undefined : row;
  const [f, setF] = useState({ name: cur?.name ?? "", area: cur?.area ?? "", status: cur?.status ?? "active" });
  const [loaded] = useState(cur?.version ?? 0);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!f.name.trim() || !f.area.trim()) return setErr("Zone name and area are required.");
    const live = cur && zones.getSync(cur.id);
    if (cur && (!live || live.version !== loaded)) return setErr("Conflict: this zone was changed by someone else. Close and reopen.");
    if ((await zones.list()).some((z) => z.id !== cur?.id && z.name.toLowerCase() === f.name.trim().toLowerCase())) return setErr("A zone with that name exists.");
    const next: Zone = { id: cur?.id ?? zones.nextId("zon"), name: f.name.trim(), area: f.area.trim(), status: f.status, version: (cur?.version ?? 0) + 1 };
    await zones.save(next);
    await writeAudit({ user: actor.name, role, entityType: "zone", entityId: next.id, entityLabel: next.name, action: cur ? "update" : "create", summary: cur ? "Zone edited" : "Zone created", reason: "Zone maintained by operations" });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={cur ? "Edit zone" : "Add zone"} onSubmit={submit}>
      {err && <Notice tone="bad">{err}</Notice>}
      <Field label="Zone name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Area"><Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
      <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Zone["status"] })}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
    </FormSheet>
  );
}
