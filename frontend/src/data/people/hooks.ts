"use client";

import { useMemo } from "react";
import { clients, contracts, locations, vehicles, workers } from "@/data/core";
import { buildAlerts } from "./calc";
import { documents, leases, properties, stays, useSettings } from "./index";

/** DocumentAlert is derived on every render from current documents, contracts, leases and stays; never stored. */
export function useAlerts() {
  const docs = documents.useAll();
  const ws = workers.useAll();
  const vs = vehicles.useAll();
  const cs = contracts.useAll();
  const ls = leases.useAll();
  const ps = properties.useAll();
  const ss = stays.useAll();
  const settings = useSettings();
  return useMemo(
    () => buildAlerts({ docs, workers: ws, vehicles: vs, contracts: cs, leases: ls, properties: ps, stays: ss, settings }),
    [docs, ws, vs, cs, ls, ps, ss, settings],
  );
}

export { clients, contracts, locations, vehicles, workers };
