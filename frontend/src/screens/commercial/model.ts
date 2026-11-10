"use client";

import { useMemo } from "react";
import { clients, contracts, locations, vehicles, workers } from "@/data/core";
import { costRecords, revenueTx } from "@/data/commercial";
import { priceAll } from "@/data/commercial/engine";
import { buildMargin, type Inputs } from "@/data/commercial/margin";

/** Everything the commercial calculations need, from core collections and our own area. */
export function useInputs(): Inputs & { tx: ReturnType<typeof revenueTx.useAll> } {
  const w = workers.useAll(), v = vehicles.useAll(), l = locations.useAll(), c = clients.useAll(), k = contracts.useAll();
  const tx = revenueTx.useAll(), costs = costRecords.useAll();
  return useMemo(() => ({ workers: w, vehicles: v, locations: l, clients: c, contracts: k, priced: priceAll(k, tx), costs, tx }), [w, v, l, c, k, tx, costs]);
}

export function useMarginModel(month: string) {
  const inp = useInputs();
  return useMemo(() => buildMargin(inp, month), [inp, month]);
}
