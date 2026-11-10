"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import {
  assignability, assignmentActive, assignmentConflicts, canDrive, fleetAudit, fmtStamp, leaseLinks, lessorContracts, logAudit, transportRoutes, vehicleAssignments,
  NON_ASSIGNABLE_WORKER, type VehicleAssignment,
} from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { addDays, fmtDate, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { useActor } from "../_shared/hooks";

export default function VehicleAssignmentsScreen(_: ScreenProps) {
  void _;
  const actor = useActor();
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const list = vehicleAssignments.useAll();
  const routes = transportRoutes.useAll();
  const audit = fleetAudit.useAll().filter((a) => a.entity === "Assignment").slice().reverse();
  const [mode, setMode] = useState("");
  const [show, setShow] = useState<"active" | "all" | "conflicts">("active");
  const [edit, setEdit] = useState<VehicleAssignment | "new" | null>(null);
  const [resolve, setResolve] = useState<string | null>(null);

  const conflicts = useMemo(() => assignmentConflicts(list, vehicles), [list, vehicles]);
  const v = (id: string) => vehicles.find((x) => x.id === id);
  const w = (id: string) => workers.find((x) => x.id === id);
  const rows = list
    .filter((a) => (!mode || v(a.vehicleId)?.mode === mode) && (show === "all" || (show === "active" ? assignmentActive(a) : conflicts.has(a.id))))
    .sort((a, b) => (a.from < b.from ? 1 : -1));

  const cols: Column<VehicleAssignment>[] = [
    { key: "veh", header: "Vehicle", value: (a) => v(a.vehicleId)?.plate, cell: (a) => <span className="font-medium">{v(a.vehicleId)?.plate}</span> },
    { key: "mode", header: "Mode", value: (a) => v(a.vehicleId)?.mode, cell: (a) => <StatusBadge tone="info">{v(a.vehicleId)?.mode}</StatusBadge> },
    { key: "worker", header: "Worker", value: (a) => w(a.workerId)?.name, cell: (a) => <span>{w(a.workerId)?.name ?? a.workerId} {w(a.workerId) && NON_ASSIGNABLE_WORKER.includes(w(a.workerId)!.status) && <StatusBadge tone="bad">{w(a.workerId)!.status}</StatusBadge>}</span> },
    { key: "from", header: "From", value: (a) => a.from, cell: (a) => fmtDate(a.from) },
    { key: "to", header: "To (inclusive)", value: (a) => a.to ?? "9999", cell: (a) => (a.to ? fmtDate(a.to) : "Open ended") },
    { key: "src", header: "Source", value: (a) => a.source, cell: (a) => (a.source === "handover" ? "Handover desk" : a.source === "fleet_reassign" ? "Fleet reassignment" : "Fleet Manager") },
    { key: "conf", header: "Conflict", value: (a) => (conflicts.get(a.id) ?? []).join("; "), cell: (a) => (conflicts.has(a.id) ? <span className="text-red-700" title={conflicts.get(a.id)!.join("\n")}><StatusBadge tone="bad">Conflict</StatusBadge></span> : "—") },
    { key: "ver", header: "Ver.", value: (a) => a.version },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Vehicle assignments" description="Time-bounded, many-to-many records between drivers and vehicles." actions={<Button onClick={() => setEdit("new")}><Plus /> New assignment</Button>} />
      <KpiGrid>
        <KpiCard label="Active today" value={list.filter((a) => assignmentActive(a)).length} />
        <KpiCard label="Dedicated, open ended" value={list.filter((a) => a.to === null && v(a.vehicleId)?.mode === "dedicated").length} />
        <KpiCard label="Issued via desk today" value={list.filter((a) => a.source === "handover" && a.from === TODAY && v(a.vehicleId)?.mode === "pooled").length} />
        <KpiCard label="Conflicts to resolve" value={new Set([...conflicts.keys()]).size} tone={conflicts.size ? "bad" : "good"} />
      </KpiGrid>
      {conflicts.size > 0 && (
        <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-300">Overlapping assignments need a human decision</p>
          {[...conflicts.entries()].slice(0, 6).map(([id, msgs]) => {
            const a = list.find((x) => x.id === id)!;
            return (
              <div key={id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{v(a.vehicleId)?.plate} · {w(a.workerId)?.name} ({fmtDate(a.from)} to {a.to ? fmtDate(a.to) : "open"}): {msgs.join("; ")}</span>
                <Button size="sm" variant="outline" onClick={() => setResolve(id)}>Resolve</Button>
              </div>
            );
          })}
        </div>
      )}
      <Tabs tabs={[
        {
          id: "list", label: "Assignments", content: (
            <DataTable
              rows={rows}
              columns={cols}
              exportName="vehicle-assignments"
              searchPlaceholder="Search vehicle or worker…"
              onRowClick={(a) => setEdit(a)}
              rowClassName={(a) => (conflicts.has(a.id) ? "bg-red-50/60 dark:bg-red-950/20" : undefined)}
              filters={(
                <>
                  <Select className="w-36" value={show} onChange={(e) => setShow(e.target.value as typeof show)}><option value="active">Active today</option><option value="all">All periods</option><option value="conflicts">Conflicts only</option></Select>
                  <Select className="w-36" value={mode} onChange={(e) => setMode(e.target.value)}><option value="">All modes</option><option value="pooled">Pooled</option><option value="dedicated">Dedicated</option></Select>
                </>
              )}
            />
          ),
        },
        {
          id: "routes", label: "Transport (by route)", content: (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">Transport vehicles are assigned to a route, not to a worker. Manage routes on the Shared Transport Routes page.</p>
              {routes.map((r) => <div key={r.id} className="flex justify-between rounded-md border p-2"><span>{v(r.vehicleId)?.plate} · {r.name}</span><span>driver {w(r.driverId)?.name}</span></div>)}
            </div>
          ),
        },
        {
          id: "audit", label: "Audit log", content: (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm"><thead className="bg-muted/50 text-start"><tr><th className="p-2 text-start">When</th><th className="p-2 text-start">Who</th><th className="p-2 text-start">Action</th><th className="p-2 text-start">Detail</th><th className="p-2 text-start">Reason</th></tr></thead>
                <tbody>{audit.map((a) => <tr key={a.id} className="border-t"><td className="p-2">{fmtStamp(a.at)}</td><td className="p-2">{a.actor}</td><td className="p-2">{a.action}</td><td className="p-2">{a.detail}</td><td className="p-2">{a.reason ?? "—"}</td></tr>)}
                  {audit.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={5}>No assignment changes yet.</td></tr>}</tbody></table>
            </div>
          ),
        },
      ]} />
      {edit && <AssignmentForm key={edit === "new" ? "new" : edit.id} assignment={edit === "new" ? null : edit} onClose={() => setEdit(null)} actor={actor.name} />}
      {resolve && <ResolveSheet id={resolve} conflicts={conflicts} onClose={() => setResolve(null)} actor={actor.name} />}
    </div>
  );
}

function AssignmentForm({ assignment, onClose, actor }: { assignment: VehicleAssignment | null; onClose: () => void; actor: string }) {
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const list = vehicleAssignments.useAll();
  const links = leaseLinks.useAll();
  const contracts = lessorContracts.useAll();
  const [vehicleId, setVehicleId] = useState(assignment?.vehicleId ?? "");
  const [workerId, setWorkerId] = useState(assignment?.workerId ?? "");
  const [from, setFrom] = useState(assignment?.from ?? TODAY);
  const [to, setTo] = useState(assignment?.to ?? "");
  const [note, setNote] = useState(assignment?.note ?? "");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState("");
  const [lock] = useState(assignment?.version);
  const veh = vehicles.find((x) => x.id === vehicleId);
  const wk = workers.find((x) => x.id === workerId);
  const locked = assignment?.source === "handover" && veh?.mode === "pooled";

  const draft: VehicleAssignment = { id: assignment?.id ?? "new", vehicleId, workerId, from, to: to || null, source: assignment?.source ?? "manual", version: (assignment?.version ?? 0) + 1, note };
  const found = vehicleId && workerId && from ? assignmentConflicts([...list.filter((a) => a.id !== draft.id), draft], vehicles).get(draft.id) ?? [] : [];

  const save = async () => {
    if (!veh || !wk) return setErr("Choose a vehicle and a worker.");
    if (veh.mode === "transport") return setErr("Transport vehicles are assigned to a route, not to a worker. Use the Shared Transport Routes page.");
    if (veh.mode === "pooled" && !assignment) return setErr("Pooled cars are issued through the handover desk. Each issue event creates its own assignment record.");
    if (wk.status === "blocked" || NON_ASSIGNABLE_WORKER.includes(wk.status)) return setErr(`${wk.name} is ${wk.status} and cannot be assigned a vehicle.`);
    if (!canDrive(wk)) return setErr("Only workers with the driver role can be assigned a vehicle.");
    const a = assignability(veh, links, contracts);
    if (!a.ok && !assignment) return setErr(`${veh.plate} cannot be assigned: ${a.reason}.`);
    if (!from) return setErr("From date is required.");
    if (to && to < from) return setErr("End date (inclusive) cannot be before the start date.");
    if (assignment) {
      const cur = vehicleAssignments.getSync(assignment.id);
      if (!cur || cur.version !== lock) return setErr("This assignment was changed by someone else. Close and reopen it.");
      if (!reason.trim()) return setErr("A reason is required when editing an assignment.");
    }
    if (found.length && !ack) return setErr("Tick the box to save despite the overlap; it will stay flagged until resolved.");
    const id = assignment?.id ?? vehicleAssignments.nextId("vas");
    await vehicleAssignments.save({ ...draft, id, note: note.trim() || undefined });
    await logAudit(actor, "Assignment", id, assignment ? "Edited" : "Created", `${veh.plate} to ${wk.name}, ${from} to ${to || "open"}${found.length ? ` (overlap: ${found.join("; ")})` : ""}`, reason.trim() || undefined);
    onClose();
  };

  const eligible = vehicles.filter((x) => x.mode !== "transport" || vehicleId === x.id);
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={assignment ? `Assignment ${assignment.id}` : "New assignment"} description={assignment ? `Version ${assignment.version} · source ${assignment.source}` : "Dedicated bikes are assigned here; pooled cars go through the handover desk."} onSubmit={save}>
      <Field label="Vehicle"><Select value={vehicleId} disabled={!!assignment} onChange={(e) => setVehicleId(e.target.value)}><option value="">Choose…</option>{eligible.map((x) => <option key={x.id} value={x.id}>{x.plate} · {x.make} {x.model} · {x.mode}</option>)}</Select></Field>
      {veh?.mode === "transport" && <p className="rounded-md bg-amber-100 p-2 text-sm text-amber-900">Transport vehicles are assigned to a route, not a worker.</p>}
      {veh?.mode === "pooled" && !assignment && <p className="rounded-md bg-amber-100 p-2 text-sm text-amber-900">Pooled cars are issued through the handover desk, one record per shift.</p>}
      <Field label="Worker"><Select value={workerId} disabled={!!assignment} onChange={(e) => setWorkerId(e.target.value)}><option value="">Choose…</option>{workers.filter((x) => x.roles.includes("driver")).map((x) => <option key={x.id} value={x.id}>{x.name} · {x.id} · {x.status}</option>)}</Select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From"><Input type="date" value={from} disabled={locked} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To (inclusive, empty = open)"><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {assignment && <Field label="Reason for change (audit)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
      {found.length > 0 && (
        <label className="block space-y-1 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-900">
          <span className="font-medium">Overlap detected</span>
          {found.map((f) => <span key={f} className="block">{f}</span>)}
          <span className="flex items-center gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Save anyway; a human will resolve it</span>
        </label>
      )}
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}

function ResolveSheet({ id, conflicts, onClose, actor }: { id: string; conflicts: Map<string, string[]>; onClose: () => void; actor: string }) {
  const list = vehicleAssignments.useAll();
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const a = list.find((x) => x.id === id);
  const others = list.filter((o) => o.id !== id && o.vehicleId === a?.vehicleId && conflicts.has(o.id));
  const [pick, setPick] = useState(id);
  const [end, setEnd] = useState(a ? addDays(a.from, -1) : TODAY);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  if (!a) return null;
  const group = [a, ...others];
  const target = group.find((x) => x.id === pick) ?? a;
  const run = async () => {
    if (!reason.trim()) return setErr("A reason is required.");
    if (end < target.from) return setErr("The new end date cannot be before this assignment starts. End the other assignment instead.");
    await vehicleAssignments.save({ ...target, to: end, version: target.version + 1 });
    await logAudit(actor, "Assignment", target.id, "Overlap resolved", `Ended on ${end} (inclusive)`, reason.trim());
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Resolve overlap" description="Choose which assignment to end. This is a human decision; nothing is changed automatically." onSubmit={run} submitLabel="End assignment">
      <Field label="Assignment to end">
        <Select value={pick} onChange={(e) => setPick(e.target.value)}>{group.map((x) => <option key={x.id} value={x.id}>{vehicles.find((v) => v.id === x.vehicleId)?.plate} · {workers.find((w) => w.id === x.workerId)?.name} · {x.from} to {x.to ?? "open"}</option>)}</Select>
      </Field>
      <Field label="New end date (inclusive)"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      <Field label="Reason (audit)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}
