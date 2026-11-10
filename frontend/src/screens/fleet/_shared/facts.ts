"use client";

import { useMemo } from "react";
import { vehicles as vehiclesCol } from "@/data/core";
import type { Vehicle } from "@/data/entities";
import {
  assignability, costSchedules, docState, fuelTxns, holdingMonthly, leaseContractOf, leaseLinks, lessorContracts, serviceJobs, vehicleDocs,
  type CostSchedule, type LessorContract, type VehicleDocument,
} from "@/data/fleet";
import { addDays, TODAY } from "@/lib/dates";

export interface VehicleFacts {
  vehicle: Vehicle;
  schedule?: CostSchedule;
  contract?: LessorContract;
  holding: number;
  running: number;
  total: number;
  assignable: { ok: boolean; reason?: string };
  docs: VehicleDocument[];
  docIssues: number;
}

/** Per-vehicle derived facts: common-basis monthly cost, lease validity, document expiry. */
export function useVehicleFacts(): VehicleFacts[] {
  const vs = vehiclesCol.useAll();
  const sched = costSchedules.useAll();
  const links = leaseLinks.useAll();
  const contracts = lessorContracts.useAll();
  const docs = vehicleDocs.useAll();
  const fuel = fuelTxns.useAll();
  const jobs = serviceJobs.useAll();
  return useMemo(() => {
    const since28 = addDays(TODAY, -27), since90 = addDays(TODAY, -90);
    return vs.map((v) => {
      const schedule = sched.find((s) => s.id === v.id);
      const holding = holdingMonthly(schedule, v.ownership, v.monthlyCost);
      const fuel28 = fuel.filter((f) => f.vehicleId === v.id && f.date >= since28).reduce((s, f) => s + f.costFils, 0);
      const svc90 = jobs.filter((j) => j.vehicleId === v.id && j.opened >= since90).reduce((s, j) => s + j.costFils, 0);
      const running = Math.round((fuel28 * 30) / 28 + svc90 / 3);
      const d = docs.filter((x) => x.vehicleId === v.id);
      return {
        vehicle: v, schedule, contract: leaseContractOf(v, links, contracts), holding, running, total: holding + running,
        assignable: assignability(v, links, contracts), docs: d, docIssues: d.filter((x) => ["expired", "expiring"].includes(docState(x))).length,
      };
    });
  }, [vs, sched, links, contracts, docs, fuel, jobs]);
}
