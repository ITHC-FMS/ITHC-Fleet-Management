"use client";

import { Bike, Car, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { dedicatedVehicles } from "@/data/admin";
import { locations, vehicles } from "@/data/core";
import { TODAY, fmtDate } from "@/lib/dates";
import { Notice } from "./shared";
import { useMyWorker } from "./worker-common";

export default function WorkerVehicleScreen() {
  const { me, shifts, picker, fallback } = useMyWorker();
  const vs = vehicles.useAll();
  const locs = locations.useAll();
  const ded = dedicatedVehicles.useAll().find((d) => d.workerId === me?.id && d.from <= TODAY && (d.to === null || d.to >= TODAY));
  const shiftToday = shifts.find((s) => s.date === TODAY);
  const nextShift = shifts.filter((s) => s.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date))[0];
  const pooled = ded ? undefined : (shiftToday ?? nextShift);
  const vehicle = vs.find((v) => v.id === (ded?.vehicleId ?? pooled?.vehicleId));
  const desk = locs.find((l) => l.id === vehicle?.homeLocationId);
  const Icon = vehicle?.type === "bike" ? Bike : Car;

  return (
    <div className="space-y-4">
      <PageHeader title="My Vehicle" description={me?.name} />
      {picker}
      {fallback && <Notice tone="warn">Demo: no worker record matches the demo user, so {me?.name} is shown.</Notice>}
      {!vehicle ? <Notice>No vehicle is assigned to you right now. Ask Operations or your handover desk.</Notice> : (
        <div className="space-y-4 rounded-xl border-2 bg-card p-4">
          <div className="flex items-center gap-3"><Icon className="size-10" /><div><p className="text-2xl font-semibold tabular-nums">{vehicle.plate}</p><p className="text-sm text-muted-foreground">{vehicle.make} {vehicle.model} {vehicle.year}, {vehicle.type}</p></div></div>
          <StatusBadge tone={ded ? "info" : "warn"}>{ded ? "Dedicated: yours for the duration of your employment" : `Pooled car for the shift on ${fmtDate(pooled?.date)}`}</StatusBadge>
          {ded && <p className="text-sm text-muted-foreground">Assigned since {fmtDate(ded.from)}, no end date.</p>}
          {!ded && pooled && <p className="text-sm">Shift {pooled.start} to {pooled.end}</p>}
          {!ded && desk && (
            <div className="rounded-lg bg-muted/60 p-3 text-sm"><p className="flex items-center gap-2 font-medium"><MapPin className="size-4" />Collect from</p><p className="mt-1 text-base font-semibold">{desk.name}</p><p className="text-muted-foreground">{desk.address}</p></div>
          )}
          {ded && desk && <p className="text-sm text-muted-foreground">Home desk: {desk.name}</p>}
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">Read-only.</p>
    </div>
  );
}
