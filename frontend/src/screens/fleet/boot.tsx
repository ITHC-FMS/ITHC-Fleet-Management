"use client";

import { useEffect, type ComponentType } from "react";
import { vehicles } from "@/data/core";
import { incidents } from "@/data/fleet";
import type { ScreenProps } from "@/screens/types";

/**
 * Keeps the register consistent with the fleet records: a vehicle with an open incident is under repair.
 * (Seeded incidents reference core vehicles that start "in service".) Idempotent; safe on every mount.
 */
function useReconcile() {
  const incs = incidents.useAll();
  useEffect(() => {
    (async () => {
      for (const i of incs) {
        if (i.status === "closed") continue;
        const v = vehicles.getSync(i.vehicleId);
        if (v && v.status === "in_service") await vehicles.save({ ...v, status: "under_repair", version: v.version + 1 });
      }
    })();
  }, [incs]);
}

export function withFleet(Screen: ComponentType<ScreenProps>): ComponentType<ScreenProps> {
  function Wrapped(props: ScreenProps) {
    useReconcile();
    return <Screen {...props} />;
  }
  Wrapped.displayName = `Fleet(${Screen.displayName ?? Screen.name ?? "Screen"})`;
  return Wrapped;
}
