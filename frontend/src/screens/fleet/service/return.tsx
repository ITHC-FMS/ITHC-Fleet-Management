"use client";

import { useState } from "react";
import { locations as locationsCol, vehicles as vehiclesCol } from "@/data/core";
import { assignability, contractValid, incidents, leaseContractOf, leaseLinks, lessorContracts, logAudit, serviceJobs, type ServiceJob } from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Textarea } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { fmtDate, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { useActor } from "../_shared/hooks";

export default function ReturnScreen(_: ScreenProps) {
  void _;
  const actor = useActor();
  const jobs = serviceJobs.useAll();
  const vehicles = vehiclesCol.useAll();
  const locs = locationsCol.useAll();
  const links = leaseLinks.useAll();
  const contracts = lessorContracts.useAll();
  const [sel, setSel] = useState<ServiceJob | null>(null);
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const v = (id: string) => vehicles.find((x) => x.id === id);
  const desk = (id: string) => locs.find((l) => l.id === v(id)?.homeLocationId)?.name ?? "—";
  const ready = jobs.filter((j) => j.status === "completed");
  const done = jobs.filter((j) => j.status === "returned").sort((a, b) => ((a.returnedOn ?? "") < (b.returnedOn ?? "") ? 1 : -1));
  const rows = [...ready, ...done];
  const leaseWarn = sel ? (() => { const x = v(sel.vehicleId); return x && x.ownership === "rented" && !contractValid(leaseContractOf(x, links, contracts)); })() : false;

  const run = async () => {
    if (!sel) return;
    const cur = serviceJobs.getSync(sel.id);
    const veh = vehiclesCol.getSync(sel.vehicleId);
    if (!cur || cur.version !== sel.version || !veh) return setErr("This job changed elsewhere. Reopen it.");
    if (date < (cur.completedOn ?? cur.opened)) return setErr("Return date cannot be before the work was completed.");
    if (date > TODAY) return setErr("Return date cannot be in the future.");
    await vehiclesCol.save({ ...veh, status: "in_service", version: veh.version + 1 });
    await serviceJobs.save({ ...cur, status: "returned", returnedOn: date, version: cur.version + 1 });
    const inc = incidents.getSync(cur.incidentId ?? "");
    if (inc) await incidents.save({ ...inc, status: "closed", version: inc.version + 1 });
    const a = assignability({ ...veh, status: "in_service" }, links, contracts);
    await logAudit(actor.name, "Vehicle", veh.id, "Status change", `under repair to in service (returned to fleet ${date}); home desk ${desk(veh.id)}${a.ok ? "" : "; NOT assignable: " + a.reason}`, note.trim() || `Service job ${cur.id} completed`);
    setSel(null);
    setNote("");
    setErr("");
  };

  const cols: Column<ServiceJob>[] = [
    { key: "veh", header: "Vehicle", value: (j) => v(j.vehicleId)?.plate, cell: (j) => <span className="font-medium">{v(j.vehicleId)?.plate}</span> },
    { key: "id", header: "Service job", value: (j) => j.id },
    { key: "done", header: "Completed", value: (j) => j.completedOn ?? "", cell: (j) => fmtDate(j.completedOn) },
    { key: "desk", header: "Home desk", value: (j) => desk(j.vehicleId) },
    { key: "lease", header: "Lease", value: (j) => (v(j.vehicleId)?.ownership === "rented" ? "leased" : "in-house"), cell: (j) => { const x = v(j.vehicleId); if (!x || x.ownership !== "rented") return "In-house"; const ok = contractValid(leaseContractOf(x, links, contracts)); return <StatusBadge tone={ok ? "good" : "bad"}>{ok ? "Contract valid" : "Contract expired"}</StatusBadge>; } },
    { key: "ret", header: "Returned", value: (j) => j.returnedOn ?? "", cell: (j) => (j.returnedOn ? fmtDate(j.returnedOn) : <StatusBadge tone="warn">Ready to return</StatusBadge>) },
    { key: "act", header: "", sortable: false, cell: (j) => (j.status === "completed" ? <Button size="xs" onClick={(e) => { e.stopPropagation(); setSel(j); setDate(TODAY); }}>Return to fleet</Button> : null) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Return to fleet" description="A completed service job puts the vehicle back in service and into its home desk's pool." />
      <KpiGrid>
        <KpiCard label="Ready to return" value={ready.length} tone={ready.length ? "warn" : "good"} />
        <KpiCard label="Returned (history)" value={done.length} />
        <KpiCard label="Ready but lease expired" value={ready.filter((j) => { const x = v(j.vehicleId); return x?.ownership === "rented" && !contractValid(leaseContractOf(x, links, contracts)); }).length} tone="bad" />
        <KpiCard label="Currently under repair" value={vehicles.filter((x) => x.status === "under_repair").length} />
      </KpiGrid>
      <DataTable rows={rows} columns={cols} exportName="return-to-fleet" onRowClick={(j) => j.status === "completed" && setSel(j)} empty="No completed service jobs." />
      {sel && (
        <FormSheet open onOpenChange={(o) => !o && setSel(null)} title={`Return ${v(sel.vehicleId)?.plate} to fleet`} description={`Service job ${sel.id}, completed ${fmtDate(sel.completedOn)}`} onSubmit={run} submitLabel="Return to fleet">
          <p className="text-sm">Status moves from <b>under repair</b> to <b>in service</b>. The vehicle goes back to the pool of <b>{desk(sel.vehicleId)}</b>.</p>
          {leaseWarn && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">This leased vehicle&apos;s lessor contract is not valid. It returns to the fleet but stays off the assignable list until the contract is renewed.</p>}
          <Field label="Return date"><Input type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Note for the audit log"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Service job ${sel.id} completed`} /></Field>
          {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
        </FormSheet>
      )}
    </div>
  );
}
