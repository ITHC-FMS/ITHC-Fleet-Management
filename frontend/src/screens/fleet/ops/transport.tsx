"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { clients as clientsCol, contracts as contractsCol, locations as locationsCol, vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import { canDrive, logAudit, routeConflicts, transportRoutes, type TransportRoute } from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { formatKD, parseKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { useActor } from "../_shared/hooks";

export default function TransportScreen(_: ScreenProps) {
  void _;
  const actor = useActor();
  const routes = transportRoutes.useAll();
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const locs = locationsCol.useAll();
  const contracts = contractsCol.useAll();
  const clients = clientsCol.useAll();
  const [form, setForm] = useState<{ route: TransportRoute | null } | null>(null);

  const conflicts = useMemo(() => routeConflicts(routes), [routes]);
  const v = (id: string) => vehicles.find((x) => x.id === id);
  const loc = (id: string) => locs.find((l) => l.id === id)?.name ?? id;
  const contractName = (id: string) => { const c = contracts.find((x) => x.id === id); return c ? `${c.contractNo} · ${clients.find((x) => x.id === c.clientId)?.name}` : id; };

  /** Vehicle cost is shared between the routes of the same vehicle by running time. */
  const costOf = (r: TransportRoute) => {
    const veh = v(r.vehicleId);
    const mins = routes.filter((x) => x.vehicleId === r.vehicleId && x.status === "active").reduce((s, x) => s + x.durationMin, 0);
    const share = veh && r.status === "active" && mins ? Math.round((veh.monthlyCost * r.durationMin) / mins) : 0;
    return { share, total: share + r.driverCostFils + r.fuelCostFils };
  };
  const active = routes.filter((r) => r.status === "active");
  const total = active.reduce((s, r) => s + costOf(r).total, 0);

  const byContract = useMemo(() => {
    const m = new Map<string, { routes: number; heads: number; cost: number }>();
    for (const r of active) {
      const c = costOf(r).total;
      const cur = m.get(r.contractId) ?? { routes: 0, heads: 0, cost: 0 };
      m.set(r.contractId, { routes: cur.routes + 1, heads: Math.max(cur.heads, r.heads), cost: cur.cost + c });
    }
    return [...m.entries()].map(([id, x]) => ({ id, ...x }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, vehicles]);

  const cols: Column<TransportRoute>[] = [
    { key: "name", header: "Route", value: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "from", header: "From", value: (r) => loc(r.fromLocationId) },
    { key: "to", header: "To", value: (r) => loc(r.toLocationId) },
    { key: "veh", header: "Vehicle", value: (r) => v(r.vehicleId)?.plate },
    { key: "drv", header: "Driver", value: (r) => workers.find((w) => w.id === r.driverId)?.name },
    { key: "sched", header: "Schedule", value: (r) => r.departs, cell: (r) => `${r.departs} · ${r.durationMin} min · ${r.days}` },
    { key: "cost", header: "Cost (KD)/month", align: "end", value: (r) => costOf(r).total, cell: (r) => formatKD(costOf(r).total, { symbol: false }) },
    { key: "con", header: "Contract", value: (r) => contractName(r.contractId) },
    { key: "st", header: "Status", value: (r) => r.status, cell: (r) => (conflicts.has(r.id) ? <span title={conflicts.get(r.id)!.join("\n")}><StatusBadge tone="bad">Conflict</StatusBadge></span> : <StatusBadge tone={r.status === "active" ? "good" : "warn"}>{r.status}</StatusBadge>) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Shared transport routes" description="Scheduled routes between housing and placement sites. Transport vehicles are assigned to routes, not workers." actions={<Button onClick={() => setForm({ route: null })}><Plus /> Add route</Button>} />
      <KpiGrid>
        <KpiCard label="Active routes" value={active.length} />
        <KpiCard label="Transport cost / month" value={formatKD(total)} hint="Vehicle share + driver + fuel" />
        <KpiCard label="Workers carried" value={active.reduce((s, r) => s + r.heads, 0)} hint="Sum of route loads" />
        <KpiCard label="Schedule conflicts" value={conflicts.size} tone={conflicts.size ? "bad" : "good"} />
      </KpiGrid>
      <Tabs tabs={[
        { id: "r", label: "Routes", content: <DataTable rows={routes} columns={cols} exportName="transport-routes" onRowClick={(r) => setForm({ route: r })} rowClassName={(r) => (conflicts.has(r.id) ? "bg-red-50/60 dark:bg-red-950/20" : undefined)} /> },
        { id: "c", label: "Cost by labour contract", content: (
          <DataTable rows={byContract} columns={[
            { key: "con", header: "Labour contract", value: (r) => contractName(r.id) },
            { key: "n", header: "Routes", align: "end", value: (r) => r.routes },
            { key: "h", header: "Workers carried", align: "end", value: (r) => r.heads },
            { key: "cost", header: "Transport cost / month (KD)", align: "end", value: (r) => r.cost, cell: (r) => formatKD(r.cost, { symbol: false }) },
            { key: "ph", header: "Per head (KD)", align: "end", value: (r) => (r.heads ? Math.round(r.cost / r.heads) : 0), cell: (r) => formatKD(r.heads ? Math.round(r.cost / r.heads) : 0, { symbol: false }) },
          ]} exportName="transport-by-contract" />
        ) },
      ]} />
      {form && <RouteForm key={form.route?.id ?? "new"} route={form.route} actor={actor.name} onClose={() => setForm(null)} />}
    </div>
  );
}

function RouteForm({ route, actor, onClose }: { route: TransportRoute | null; actor: string; onClose: () => void }) {
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const locs = locationsCol.useAll();
  const contracts = contractsCol.useAll();
  const clients = clientsCol.useAll();
  const routes = transportRoutes.useAll();
  const [d, setD] = useState({
    name: route?.name ?? "", from: route?.fromLocationId ?? "", to: route?.toLocationId ?? "", vehicleId: route?.vehicleId ?? "", driverId: route?.driverId ?? "", contractId: route?.contractId ?? "",
    departs: route?.departs ?? "05:00", dur: String(route?.durationMin ?? 60), days: route?.days ?? "Sun-Thu", heads: String(route?.heads ?? 10),
    driverCost: route ? (route.driverCostFils / 1000).toFixed(3) : "", fuelCost: route ? (route.fuelCostFils / 1000).toFixed(3) : "", status: route?.status ?? "draft",
  });
  const [lock] = useState(route?.version);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof d, val: string) => setD((p) => ({ ...p, [k]: val }));

  const save = async () => {
    if (!d.name.trim() || !d.from || !d.to || !d.vehicleId || !d.driverId || !d.contractId) return setErr("Name, both locations, vehicle, driver and labour contract are required.");
    if (d.from === d.to) return setErr("A route needs different start and end locations.");
    if (!/^\d{2}:\d{2}$/.test(d.departs)) return setErr("Departure must be HH:mm.");
    const dur = Number(d.dur), heads = Number(d.heads);
    if (!(dur > 0) || !(heads > 0)) return setErr("Duration and workers carried must be above zero.");
    const dc = parseKD(d.driverCost || "0"), fc = parseKD(d.fuelCost || "0");
    if (!(dc >= 0) || !(fc >= 0)) return setErr("Costs must be valid KD amounts.");
    if (route) { const cur = transportRoutes.getSync(route.id); if (!cur || cur.version !== lock) return setErr("This route was changed by someone else. Reopen it."); }
    const rec: TransportRoute = { id: route?.id ?? transportRoutes.nextId("rt"), name: d.name.trim(), fromLocationId: d.from, toLocationId: d.to, vehicleId: d.vehicleId, driverId: d.driverId, contractId: d.contractId, departs: d.departs, durationMin: dur, days: d.days, heads, driverCostFils: dc, fuelCostFils: fc, status: d.status as TransportRoute["status"], version: (route?.version ?? 0) + 1 };
    const clash = routeConflicts([...routes.filter((r) => r.id !== rec.id), rec]).get(rec.id);
    if (clash && rec.status === "active") return setErr(`Cannot activate: ${clash.join("; ")}. Save as draft or change the time.`);
    await transportRoutes.save(rec);
    await logAudit(actor, "Transport route", rec.id, route ? "Edited" : "Created", `${rec.name}${clash ? ` (draft with conflict: ${clash.join("; ")})` : ""}`);
    onClose();
  };

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={route ? `Edit route` : "Add route"} description={route ? `${route.id} · version ${route.version}` : "Housing to placement site"} onSubmit={save} wide>
      <Field label="Route name"><Input value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From"><Select value={d.from} onChange={(e) => set("from", e.target.value)}><option value="">Choose…</option>{locs.filter((l) => ["housing", "client_site"].includes(l.kind)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="To"><Select value={d.to} onChange={(e) => set("to", e.target.value)}><option value="">Choose…</option>{locs.filter((l) => ["housing", "client_site"].includes(l.kind)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Transport vehicle"><Select value={d.vehicleId} onChange={(e) => set("vehicleId", e.target.value)}><option value="">Choose…</option>{vehicles.filter((x) => x.mode === "transport").map((x) => <option key={x.id} value={x.id}>{x.plate} · {x.make} {x.model}</option>)}</Select></Field>
        <Field label="Driver"><Select value={d.driverId} onChange={(e) => set("driverId", e.target.value)}><option value="">Choose…</option>{workers.filter(canDrive).map((w) => <option key={w.id} value={w.id}>{w.name} · {w.status}</option>)}</Select></Field>
        <Field label="Labour contract served"><Select value={d.contractId} onChange={(e) => set("contractId", e.target.value)}><option value="">Choose…</option>{contracts.filter((c) => c.status === "active").map((c) => <option key={c.id} value={c.id}>{c.contractNo} · {clients.find((x) => x.id === c.clientId)?.name}</option>)}</Select></Field>
        <Field label="Status"><Select value={d.status} onChange={(e) => set("status", e.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="suspended">Suspended</option></Select></Field>
        <Field label="Departs (HH:mm)"><Input value={d.departs} onChange={(e) => set("departs", e.target.value)} /></Field>
        <Field label="Duration (min)"><Input value={d.dur} onChange={(e) => set("dur", e.target.value)} /></Field>
        <Field label="Days"><Input value={d.days} onChange={(e) => set("days", e.target.value)} /></Field>
        <Field label="Workers carried"><Input value={d.heads} onChange={(e) => set("heads", e.target.value)} /></Field>
        <Field label="Driver cost / month (KD)"><Input value={d.driverCost} onChange={(e) => set("driverCost", e.target.value)} /></Field>
        <Field label="Fuel cost / month (KD)"><Input value={d.fuelCost} onChange={(e) => set("fuelCost", e.target.value)} /></Field>
      </div>
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}
