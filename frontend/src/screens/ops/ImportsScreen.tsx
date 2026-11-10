"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { Tabs } from "@/components/app/tabs";
import { assignments, entries, fuelTx, importLogs, orders, plans, shifts } from "@/data/ops/store";
import type { ImportLog } from "@/data/ops/types";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "../types";
import { ImportWizard } from "./ImportWizard";
import { csvOf, downloadFile, useNames } from "./shared";

export default function ImportsScreen({ readOnly, editedBy }: ScreenProps) {
  const names = useNames();
  const logs = importLogs.useAll();
  const ords = orders.useAll(), asg = assignments.useAll(), sh = shifts.useAll(), fu = fuelTx.useAll(), pl = plans.useAll(), en = entries.useAll();

  const datasets: { name: string; count: number; run: () => void }[] = [
    { name: "Workers", count: names.workers.length, run: () => downloadFile("workers.csv", csvOf([["ID", "Username", "Name", "Roles", "Status", "Nationality", "Phone", "Civil ID", "Licence", "Rider ID", "Base KD", "Overtime KD"], ...names.workers.map((w) => [w.id, w.username, w.name, w.roles.join("|"), w.status, w.nationality, w.phone, w.civilId, w.licenceNo, w.riderId, formatKD(w.baseSalary, { symbol: false }), formatKD(w.overtimeComponent, { symbol: false })])])) },
    { name: "Vehicles", count: names.vehicles.length, run: () => downloadFile("vehicles.csv", csvOf([["ID", "Plate", "Type", "Make", "Model", "Year", "Ownership", "Mode", "Status", "Monthly cost KD", "Odometer"], ...names.vehicles.map((v) => [v.id, v.plate, v.type, v.make, v.model, v.year, v.ownership, v.mode, v.status, formatKD(v.monthlyCost, { symbol: false }), v.odometerKm])])) },
    { name: "Orders", count: ords.length, run: () => downloadFile("orders.csv", csvOf([["Date", "Driver", "Client", "Place", "Orders", "Pickups", "Dropoffs", "Batch"], ...ords.map((o) => [o.date, names.worker(o.workerId), names.client(o.clientId), o.place, o.kind === "store" ? o.orders : "", o.kind === "marketplace" ? o.pickups : "", o.kind === "marketplace" ? o.dropoffs : "", o.kind === "marketplace" ? o.batch : ""])])) },
    { name: "Assignments", count: asg.length, run: () => downloadFile("assignments.csv", csvOf([["Worker", "Client", "Place", "From", "To", "Shift", "Type"], ...asg.map((a) => [names.worker(a.workerId), names.client(a.clientId), a.place, a.from, a.to, a.shift, a.kind])])) },
    { name: "Shifts", count: sh.length, run: () => downloadFile("shifts.csv", csvOf([["Date", "Driver", "Vehicle", "Start", "End", "Actual start", "Actual end"], ...sh.map((s) => [s.date, names.worker(s.workerId), names.plate(s.vehicleId), s.plannedStart, s.plannedEnd, s.actualStart, s.actualEnd])])) },
    { name: "Deductions and advances", count: pl.length, run: () => downloadFile("deductions.csv", csvOf([["Worker", "Type", "Description", "Total KD", "Per period KD", "Start month"], ...pl.map((p) => [names.worker(p.workerId), p.kind, p.description, formatKD(p.total, { symbol: false }), formatKD(p.instalment, { symbol: false }), p.startMonth])])) },
    { name: "Fuel", count: fu.length, run: () => downloadFile("fuel.csv", csvOf([["Date", "Vehicle", "Driver", "Litres", "Cost KD", "Odometer"], ...fu.map((f) => [f.date, names.plate(f.vehicleId), names.worker(f.workerId), f.litres, formatKD(f.cost, { symbol: false }), f.odometerKm])])) },
    { name: "Payroll entries", count: en.length, run: () => downloadFile("payroll-entries.csv", csvOf([["Period", "Driver", "Base", "Excess", "Food", "Accommodation", "Incentive", "Bonus", "Deductions", "Net"], ...en.map((e) => [e.periodId, names.worker(e.workerId), ...[e.result.basePay, e.result.excessPay, e.result.food, e.result.accommodation, e.result.incentive, e.result.marketplaceBonus, e.result.deductionTotal, e.result.net].map((n) => formatKD(n, { symbol: false }))])])) },
  ];
  const cols: Column<ImportLog>[] = [{ key: "at", header: "Date" }, { key: "target", header: "Dataset" }, { key: "fileName", header: "File" }, { key: "rows", header: "Rows", align: "end" }, { key: "committed", header: "Committed", align: "end" }, { key: "rejected", header: "Rejected", align: "end" }, { key: "by", header: "By" }];

  return (
    <div className="space-y-5">
      <PageHeader title="Data Import & Export" description="Upload, map columns, preview, validate, commit. The same wizard serves drivers, vehicles, orders, deductions and fuel." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <Tabs tabs={[
        ...(!readOnly ? [{ id: "i", label: "Import wizard", content: <ImportWizard /> }] : []),
        { id: "e", label: "Exports", content: (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {datasets.map((d) => <div key={d.name} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm"><div><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.count} rows</p></div><Button size="sm" variant="outline" onClick={d.run}><Download /> CSV</Button></div>)}
            <p className="col-span-full text-xs text-muted-foreground">Every list screen also has its own Export button in the table toolbar, matching what is on screen.</p>
          </div>) },
        { id: "h", label: "Import history", content: <DataTable rows={logs} columns={cols} exportName="import-history" empty="No imports committed yet." /> },
      ]} />
    </div>
  );
}
