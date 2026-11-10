"use client";

import { useSyncExternalStore } from "react";

/** Tiny persisted UI store (desk choice, offline simulation, handover intent). */
export function createStore<T>(key: string, initial: T) {
  const subs = new Set<() => void>();
  let val = initial;
  let loaded = false;
  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) val = { ...initial, ...(JSON.parse(raw) as T) };
    } catch {}
  };
  const get = () => { load(); return val; };
  return {
    get,
    set(patch: Partial<T>) {
      load();
      val = { ...val, ...patch };
      try { window.localStorage.setItem(key, JSON.stringify(val)); } catch {}
      subs.forEach((f) => f());
    },
    use: () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, get, () => initial),
  };
}

export const uiStore = createStore<{ deskId: string; offline: boolean; failNextSync: boolean }>("ithc.demo.v1.fleet.ui", { deskId: "", offline: false, failNextSync: false });
export const intentStore = createStore<{ direction: "issue" | "return"; vehicleId: string; incidentEventId: string }>("ithc.demo.v1.fleet.intent", { direction: "issue", vehicleId: "", incidentEventId: "" });
