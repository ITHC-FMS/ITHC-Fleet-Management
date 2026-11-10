"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { locations, workers, type Location } from "@/data/core";
import { leases, occupancy, properties, units, type HousingProperty, type HousingUnit, type Lease } from "@/data/people";
import { capacityOf, currentLease, leaseValidOn, occupiesOn } from "@/data/people/calc";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { Errors, Notice } from "../common";

interface PDraft { id?: string; version?: number; name: string; address: string; landlord: string; leaseNo: string; start: string; end: string; rent: string; units: string; beds: string }
interface UDraft { id?: string; propertyId: string; unitNo: string; beds: string }
type Row = HousingProperty & { cap: number; occupied: number; unitCount: number; lease?: Lease; valid: boolean };

export default function Properties({ readOnly, editedBy }: ScreenProps) {
  const props = properties.useAll();
  const us = units.useAll();
  const ls = leases.useAll();
  const occ = occupancy.useAll();
  const locs = locations.useAll();
  const ws = workers.useAll();
  const [sel, setSel] = useState<string | null>(null);
  const [pd, setPd] = useState<PDraft | null>(null);
  const [ud, setUd] = useState<UDraft | null>(null);
  const [errs, setErrs] = useState<string[]>([]);

  // Every property is a Location record. Make sure the seeded ones exist in the core Locations list.
  useEffect(() => {
    const missing = props.filter((p) => !locs.some((l) => l.id === p.locationId));
    if (!missing.length) return;
    void locations.saveMany(missing.map((p): Location => ({ id: p.locationId, name: `Housing — ${p.name}`, kind: "housing", address: p.address, monthlyCost: currentLease(ls, p.id)?.monthlyCost })));
  }, [props, locs, ls]);

  const rows: Row[] = useMemo(() => props.map((p) => ({
    ...p, cap: capacityOf(us, p.id), unitCount: us.filter((u) => u.propertyId === p.id).length,
    occupied: occ.filter((o) => o.propertyId === p.id && occupiesOn(o, TODAY)).length, lease: currentLease(ls, p.id), valid: leaseValidOn(ls, p.id),
  })), [props, us, ls, occ]);

  const cols: Column<Row>[] = [
    { key: "name", header: "Property", cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.landlord}</div></div> },
    { key: "address", header: "Address" },
    { key: "unitCount", header: "Units", align: "end" },
    { key: "cap", header: "Capacity", align: "end" },
    { key: "occupied", header: "Occupied", align: "end" },
    { key: "rent", header: "Monthly cost (KD)", align: "end", value: (r) => r.lease?.monthlyCost ?? 0, cell: (r) => formatKD(r.lease?.monthlyCost ?? 0, { symbol: false }) },
    { key: "start", header: "Lease start", value: (r) => r.lease?.start, cell: (r) => fmtDate(r.lease?.start) },
    { key: "end", header: "Lease end", value: (r) => r.lease?.end, cell: (r) => fmtDate(r.lease?.end) },
    { key: "valid", header: "Bed assignment", value: (r) => (r.valid ? "open" : "closed"), cell: (r) => (r.valid ? <StatusBadge tone="good">Open</StatusBadge> : <StatusBadge tone="bad">Closed: contract expired</StatusBadge>) },
  ];

  const selected = rows.find((r) => r.id === sel);

  const blankP = (): PDraft => ({ name: "", address: "", landlord: "", leaseNo: "", start: TODAY, end: "", rent: "", units: "1", beds: "4" });

  const saveProperty = async () => {
    if (!pd) return;
    const e: string[] = [];
    if (!pd.name.trim()) e.push("Property name is required");
    if (!pd.address.trim()) e.push("Address is required");
    if (pd.id) {
      const cur = props.find((p) => p.id === pd.id);
      if (cur && cur.version !== pd.version) e.push("Changed by someone else. Close and reopen.");
      setErrs(e);
      if (e.length || !cur) return;
      await properties.save({ ...cur, name: pd.name.trim(), address: pd.address.trim(), landlord: pd.landlord.trim(), version: cur.version + 1 });
      const loc = locs.find((l) => l.id === cur.locationId);
      if (loc) await locations.save({ ...loc, name: `Housing — ${pd.name.trim()}`, address: pd.address.trim() });
      setPd(null);
      return;
    }
    if (!pd.landlord.trim()) e.push("Landlord is required");
    if (!pd.leaseNo.trim()) e.push("Lease number is required");
    if (!pd.end || pd.end < pd.start) e.push("Lease end must be on or after the lease start");
    const rent = parseKD(pd.rent);
    if (!(rent > 0)) e.push("Monthly cost must be a KD amount above 0");
    const n = Number(pd.units), b = Number(pd.beds);
    if (!Number.isInteger(n) || n < 1 || n > 40) e.push("Number of units must be between 1 and 40");
    if (!Number.isInteger(b) || b < 1 || b > 12) e.push("Beds per unit must be between 1 and 12");
    setErrs(e);
    if (e.length) return;
    const locId = locations.nextId("loc");
    await locations.save({ id: locId, name: `Housing — ${pd.name.trim()}`, kind: "housing", address: pd.address.trim(), monthlyCost: rent });
    const pid = properties.nextId("hp");
    await properties.save({ id: pid, locationId: locId, name: pd.name.trim(), address: pd.address.trim(), landlord: pd.landlord.trim(), version: 1 });
    await leases.save({ id: leases.nextId("ls"), propertyId: pid, leaseNo: pd.leaseNo.trim(), landlord: pd.landlord.trim(), start: pd.start, end: pd.end, monthlyCost: rent, status: "current", version: 1 });
    const base = us.length ? Math.max(...us.map((u) => Number(u.id.split("-").pop()))) : 0;
    await units.saveMany(Array.from({ length: n }, (_, i): HousingUnit => ({ id: `hu-${String(base + i + 1).padStart(4, "0")}`, propertyId: pid, unitNo: `${pd.name.trim()[0].toUpperCase()}-${101 + i}`, beds: b })));
    setPd(null);
  };

  const saveUnit = async () => {
    if (!ud) return;
    const e: string[] = [];
    const beds = Number(ud.beds);
    if (!ud.propertyId) e.push("Choose a property");
    if (!ud.unitNo.trim()) e.push("Unit number is required");
    if (ud.propertyId && us.some((u) => u.propertyId === ud.propertyId && u.id !== ud.id && u.unitNo.toLowerCase() === ud.unitNo.trim().toLowerCase())) e.push("That unit number already exists in this property");
    if (!Number.isInteger(beds) || beds < 1 || beds > 12) e.push("Beds must be between 1 and 12");
    if (ud.id && Number.isInteger(beds)) {
      const maxBed = Math.max(0, ...occ.filter((o) => o.unitId === ud.id && (o.moveOut === null || o.moveOut >= TODAY)).map((o) => o.bed));
      if (beds < maxBed) e.push(`Bed ${maxBed} is occupied or reserved; capacity cannot go below ${maxBed}`);
    }
    setErrs(e);
    if (e.length) return;
    await units.save({ id: ud.id ?? units.nextId("hu"), propertyId: ud.propertyId, unitNo: ud.unitNo.trim(), beds });
    setUd(null);
  };

  const totalCap = rows.reduce((a, r) => a + r.cap, 0);
  const totalOcc = rows.reduce((a, r) => a + r.occupied, 0);
  const closed = rows.filter((r) => !r.valid);

  return (
    <div className="space-y-6">
      <PageHeader title="Properties & Units" description="Register of buildings, units and beds, with capacity, cost and lease dates."
        actions={!readOnly && <>
          <Button variant="outline" onClick={() => { setErrs([]); setUd({ propertyId: props[0]?.id ?? "", unitNo: "", beds: "4" }); }}>Add unit</Button>
          <Button onClick={() => { setErrs([]); setPd(blankP()); }}>Add property</Button>
        </>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {closed.length > 0 && <Notice tone="warn">Closed to new bed assignments (building contract not valid): {closed.map((c) => c.name).join(", ")}. Renewing the contract on the Leases page reopens it.</Notice>}
      <KpiGrid>
        <KpiCard label="Properties" value={rows.length} />
        <KpiCard label="Total beds" value={totalCap} />
        <KpiCard label="Occupied" value={totalOcc} />
        <KpiCard label="Monthly rent" value={formatKD(rows.reduce((a, r) => a + (r.lease?.monthlyCost ?? 0), 0))} />
      </KpiGrid>
      <DataTable rows={rows} columns={cols} onRowClick={(r) => setSel(r.id)} exportName="properties" searchPlaceholder="Search properties…" />

      <FormSheet open={!!selected} onOpenChange={(o) => !o && setSel(null)} wide hideSubmit title={selected?.name ?? ""} description={selected?.address}>
        {selected && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">Landlord</dt><dd>{selected.landlord}</dd>
              <dt className="text-muted-foreground">Lease</dt><dd>{selected.lease ? `${selected.lease.leaseNo}, ${fmtDate(selected.lease.start)} to ${fmtDate(selected.lease.end)} (${daysBetween(TODAY, selected.lease.end)} days left)` : "None"}</dd>
              <dt className="text-muted-foreground">Monthly cost</dt><dd>{formatKD(selected.lease?.monthlyCost ?? 0)}</dd>
              <dt className="text-muted-foreground">Location record</dt><dd>{selected.locationId}</dd>
            </dl>
            {!readOnly && <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setSel(null); setErrs([]); setPd({ id: selected.id, version: selected.version, name: selected.name, address: selected.address, landlord: selected.landlord, leaseNo: "", start: TODAY, end: "", rent: "", units: "", beds: "" }); }}>Edit property</Button>
              <Button size="sm" variant="outline" onClick={() => { setSel(null); setErrs([]); setUd({ propertyId: selected.id, unitNo: "", beds: "4" }); }}>Add unit</Button>
            </div>}
            <table className="w-full text-xs">
              <thead><tr className="text-muted-foreground"><th className="text-start">Unit</th><th className="text-end">Beds</th><th className="text-end">Occupied</th><th className="text-start ps-3">Residents</th><th /></tr></thead>
              <tbody>
                {us.filter((u) => u.propertyId === selected.id).map((u) => {
                  const here = occ.filter((o) => o.unitId === u.id && occupiesOn(o, TODAY));
                  return (
                    <tr key={u.id} className="border-t align-top">
                      <td className="py-1 font-medium">{u.unitNo}</td><td className="text-end">{u.beds}</td><td className="text-end">{here.length}</td>
                      <td className="ps-3">{here.map((o) => `${o.workerId ? ws.find((w) => w.id === o.workerId)?.name ?? o.workerId : o.guestName} (bed ${o.bed})`).join(", ") || "Vacant"}</td>
                      <td className="text-end">{!readOnly && <Button size="xs" variant="outline" onClick={() => { setSel(null); setErrs([]); setUd({ id: u.id, propertyId: u.propertyId, unitNo: u.unitNo, beds: String(u.beds) }); }}>Edit</Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FormSheet>

      <FormSheet open={!!pd} onOpenChange={(o) => !o && setPd(null)} title={pd?.id ? "Edit property" : "Add property"} description={pd?.id ? undefined : "Adding a property also adds its Location record, first lease and units."} onSubmit={saveProperty}>
        {pd && (
          <>
            <Errors list={errs} />
            <Field label="Property name"><Input value={pd.name} onChange={(e) => setPd({ ...pd, name: e.target.value })} /></Field>
            <Field label="Address"><Input value={pd.address} onChange={(e) => setPd({ ...pd, address: e.target.value })} /></Field>
            <Field label="Landlord"><Input value={pd.landlord} onChange={(e) => setPd({ ...pd, landlord: e.target.value })} /></Field>
            {!pd.id && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Lease number"><Input value={pd.leaseNo} onChange={(e) => setPd({ ...pd, leaseNo: e.target.value })} /></Field>
                  <Field label="Monthly cost (KD)"><Input inputMode="decimal" value={pd.rent} onChange={(e) => setPd({ ...pd, rent: e.target.value })} /></Field>
                  <Field label="Lease start"><Input type="date" value={pd.start} onChange={(e) => setPd({ ...pd, start: e.target.value })} /></Field>
                  <Field label="Lease end"><Input type="date" value={pd.end} onChange={(e) => setPd({ ...pd, end: e.target.value })} /></Field>
                  <Field label="Number of units"><Input inputMode="numeric" value={pd.units} onChange={(e) => setPd({ ...pd, units: e.target.value })} /></Field>
                  <Field label="Beds per unit"><Input inputMode="numeric" value={pd.beds} onChange={(e) => setPd({ ...pd, beds: e.target.value })} /></Field>
                </div>
              </>
            )}
          </>
        )}
      </FormSheet>

      <FormSheet open={!!ud} onOpenChange={(o) => !o && setUd(null)} title={ud?.id ? "Edit unit" : "Add unit"} onSubmit={saveUnit}>
        {ud && (
          <>
            <Errors list={errs} />
            <Field label="Property"><select className="h-9 w-full rounded-md border bg-background px-2.5 text-sm" disabled={!!ud.id} value={ud.propertyId} onChange={(e) => setUd({ ...ud, propertyId: e.target.value })}>{props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Unit number"><Input value={ud.unitNo} onChange={(e) => setUd({ ...ud, unitNo: e.target.value })} /></Field>
            <Field label="Beds (capacity)"><Input inputMode="numeric" value={ud.beds} onChange={(e) => setUd({ ...ud, beds: e.target.value })} /></Field>
          </>
        )}
      </FormSheet>
    </div>
  );
}
