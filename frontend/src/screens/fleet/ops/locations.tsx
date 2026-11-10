"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { locations as locationsCol, vehicles as vehiclesCol } from "@/data/core";
import type { Location, LocationKind } from "@/data/entities";
import { deskSees, deskUsers, logAudit } from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { formatKD, parseKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { useActor } from "../_shared/hooks";

const KINDS: LocationKind[] = ["operating_building", "handover_desk", "housing", "client_site", "service_centre"];

export default function LocationsScreen(_: ScreenProps) {
  void _;
  const actor = useActor();
  const locs = locationsCol.useAll();
  const vehicles = vehiclesCol.useAll();
  const users = deskUsers.useAll();
  const [kind, setKind] = useState("");
  const [form, setForm] = useState<{ loc: Location | null; asDesk?: boolean } | null>(null);
  const [view, setView] = useState<string | null>(null);

  const homed = (l: Location) => (l.kind === "handover_desk" || l.kind === "operating_building" ? vehicles.filter((v) => (l.kind === "handover_desk" ? deskSees(l.id, v.homeLocationId) : v.homeLocationId === l.id)) : []);
  const ops = (l: Location) => users.filter((u) => u.deskId === l.id && u.status === "active");
  const rows = locs.filter((l) => !kind || l.kind === kind);
  const cur = locs.find((l) => l.id === view);

  const cols: Column<Location>[] = [
    { key: "name", header: "Location", value: (l) => l.name, cell: (l) => <span className="font-medium">{l.name}</span> },
    { key: "kind", header: "Type", value: (l) => l.kind, cell: (l) => <StatusBadge tone={l.kind === "handover_desk" ? "info" : "neutral"}>{prettify(l.kind)}</StatusBadge> },
    { key: "addr", header: "Address", value: (l) => l.address },
    { key: "cost", header: "Monthly cost", align: "end", value: (l) => l.monthlyCost ?? 0, cell: (l) => (l.monthlyCost ? formatKD(l.monthlyCost) : "—") },
    { key: "desk", header: "Desk", value: (l) => (l.kind === "handover_desk" ? "yes" : ""), cell: (l) => (l.kind === "handover_desk" ? "Handover desk" : "—") },
    { key: "ops", header: "Operators", align: "end", value: (l) => (l.kind === "handover_desk" ? ops(l).length : 0), cell: (l) => (l.kind === "handover_desk" ? ops(l).length : "—") },
    { key: "veh", header: "Vehicles homed", align: "end", value: (l) => homed(l).length, cell: (l) => (homed(l).length || "—") },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Locations and handover desks" description="Housing units, client sites, operating buildings and handover desks are all locations." actions={<><Button variant="outline" onClick={() => setForm({ loc: null, asDesk: true })}><Plus /> Add desk</Button><Button onClick={() => setForm({ loc: null })}><Plus /> Add location</Button></>} />
      <DataTable rows={rows} columns={cols} exportName="locations" onRowClick={(l) => setView(l.id)}
        filters={<Select className="w-44" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All types</option>{KINDS.map((k) => <option key={k} value={k}>{prettify(k)}</option>)}</Select>} />
      {cur && (
        <FormSheet open onOpenChange={(o) => !o && setView(null)} title={cur.name} description={`${prettify(cur.kind)} · ${cur.address}`} hideSubmit>
          <div className="space-y-3 text-sm">
            {cur.kind === "handover_desk" && (
              <div><p className="mb-1 font-medium">Operators</p>{ops(cur).map((u) => <p key={u.id}>{u.name} · {u.username}</p>)}{ops(cur).length === 0 && <p className="text-muted-foreground">No active operators. Add one on Handover Desk Users.</p>}</div>
            )}
            <div><p className="mb-1 font-medium">Vehicles homed here ({homed(cur).length})</p>{homed(cur).map((v) => <p key={v.id}>{v.plate} · {v.make} {v.model} · {v.mode}</p>)}{homed(cur).length === 0 && <p className="text-muted-foreground">None.</p>}</div>
            <Button type="button" onClick={() => { setForm({ loc: cur }); setView(null); }}>Edit location</Button>
          </div>
        </FormSheet>
      )}
      {form && <LocationForm key={form.loc?.id ?? (form.asDesk ? "desk" : "new")} loc={form.loc} asDesk={form.asDesk} actor={actor.name} onClose={() => setForm(null)} />}
    </div>
  );
}

function LocationForm({ loc, asDesk, actor, onClose }: { loc: Location | null; asDesk?: boolean; actor: string; onClose: () => void }) {
  const locs = locationsCol.useAll();
  const [name, setName] = useState(loc?.name ?? "");
  const [kind, setKind] = useState<LocationKind>(loc?.kind ?? (asDesk ? "handover_desk" : "housing"));
  const [address, setAddress] = useState(loc?.address ?? "");
  const [cost, setCost] = useState(loc?.monthlyCost ? (loc.monthlyCost / 1000).toFixed(3) : "");
  const [withDesk, setWithDesk] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!name.trim() || !address.trim()) return setErr("Name and address are required.");
    if (locs.some((l) => l.name.toLowerCase() === name.trim().toLowerCase() && l.id !== loc?.id)) return setErr("A location with this name already exists.");
    const fils = cost.trim() ? parseKD(cost) : undefined;
    if (fils !== undefined && !(fils >= 0)) return setErr("Monthly cost must be a valid KD amount.");
    const id = loc?.id ?? locationsCol.nextId("loc");
    await locationsCol.save({ id, name: name.trim(), kind, address: address.trim(), monthlyCost: fils });
    await logAudit(actor, "Location", id, loc ? "Edited" : "Created", `${name.trim()} (${kind})`);
    if (!loc && withDesk && kind === "operating_building") {
      const did = locationsCol.nextId("loc");
      await locationsCol.save({ id: did, name: `Handover Desk — ${name.trim()}`, kind: "handover_desk", address: `${name.trim()}, ground floor` });
      await logAudit(actor, "Location", did, "Created", `Handover desk for ${name.trim()}`);
    }
    onClose();
  };

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={loc ? `Edit ${loc.name}` : asDesk ? "Add handover desk" : "Add location"} description="Adding a building means one location record and a desk, nothing else." onSubmit={save}>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value as LocationKind)}>{KINDS.map((k) => <option key={k} value={k}>{prettify(k)}</option>)}</Select></Field>
      <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
      <Field label="Monthly cost (KD, where applicable)"><Input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="optional" /></Field>
      {!loc && kind === "operating_building" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withDesk} onChange={(e) => setWithDesk(e.target.checked)} /> Also create a handover desk in this building</label>}
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}
