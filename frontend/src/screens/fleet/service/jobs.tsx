"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { vehicles as vehiclesCol } from "@/data/core";
import { logAudit, serviceJobs, type ServiceJob } from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { Select } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/status-badge";
import { fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { useActor } from "../_shared/hooks";
import { JobForm } from "./job-form";

export default function JobsScreen(_: ScreenProps) {
  void _;
  const actor = useActor();
  const jobs = serviceJobs.useAll();
  const vehicles = vehiclesCol.useAll();
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<{ job?: ServiceJob } | null>(null);
  const v = (id?: string) => vehicles.find((x) => x.id === id);
  const rows = jobs.filter((j) => !status || j.status === status).sort((a, b) => (a.opened < b.opened ? 1 : -1));
  const overdue = (j: ServiceJob) => j.status === "open" && j.expectedReturn < TODAY;

  const complete = async (j: ServiceJob) => {
    const cur = serviceJobs.getSync(j.id);
    if (!cur || cur.version !== j.version) return;
    await serviceJobs.save({ ...cur, status: "completed", completedOn: TODAY, version: cur.version + 1 });
    await logAudit(actor.name, "Service job", j.id, "Completed", `${v(j.vehicleId)?.plate} work completed, ${formatKD(j.costFils)}`);
  };

  const cols: Column<ServiceJob>[] = [
    { key: "id", header: "Job", value: (j) => j.id },
    { key: "veh", header: "Vehicle", value: (j) => v(j.vehicleId)?.plate, cell: (j) => <span className="font-medium">{v(j.vehicleId)?.plate}</span> },
    { key: "src", header: "From", value: (j) => j.incidentId ?? "", cell: (j) => `${j.source === "damaged" ? "Damaged record" : "Accident"} ${j.incidentId ?? ""}` },
    { key: "work", header: "Work", value: (j) => j.work, cell: (j) => <span className="line-clamp-1 max-w-64">{j.work}</span> },
    { key: "cost", header: "Cost (KD)", align: "end", value: (j) => j.costFils, cell: (j) => formatKD(j.costFils, { symbol: false }) },
    { key: "open", header: "Opened", value: (j) => j.opened, cell: (j) => fmtDate(j.opened) },
    { key: "ret", header: "Return date", value: (j) => j.expectedReturn, cell: (j) => <span className={overdue(j) ? "font-medium text-red-700" : ""}>{fmtDate(j.expectedReturn)}{overdue(j) ? " (overdue)" : ""}</span> },
    { key: "repl", header: "Replacement", value: (j) => v(j.replacementVehicleId)?.plate, cell: (j) => v(j.replacementVehicleId)?.plate ?? "—" },
    { key: "st", header: "Status", value: (j) => j.status, cell: (j) => <StatusBadge tone={j.status === "open" ? "warn" : j.status === "completed" ? "info" : "good"}>{j.status}</StatusBadge> },
    { key: "act", header: "", sortable: false, cell: (j) => (j.status === "open" ? <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); complete(j); }}>Mark complete</Button> : null) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Service jobs" description="Work performed, cost and return-to-fleet date. The vehicle is under repair while the job is open." actions={<Button onClick={() => setForm({})}><Plus /> New service job</Button>} />
      <KpiGrid>
        <KpiCard label="Open jobs" value={jobs.filter((j) => j.status === "open").length} />
        <KpiCard label="Overdue return" value={jobs.filter(overdue).length} tone={jobs.some(overdue) ? "bad" : "good"} />
        <KpiCard label="Awaiting return to fleet" value={jobs.filter((j) => j.status === "completed").length} tone="warn" />
        <KpiCard label="Service cost, all jobs" value={formatKD(jobs.reduce((s, j) => s + j.costFils, 0))} hint="Feeds cost per vehicle" />
      </KpiGrid>
      <DataTable rows={rows} columns={cols} exportName="service-jobs" onRowClick={(j) => setForm({ job: j })}
        filters={<Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All status</option><option value="open">Open</option><option value="completed">Completed</option><option value="returned">Returned</option></Select>} />
      {form && <JobForm key={form.job?.id ?? "new"} job={form.job} onClose={() => setForm(null)} />}
    </div>
  );
}
