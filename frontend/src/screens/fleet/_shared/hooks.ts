"use client";

import { useEffect, useState } from "react";
import { locations, vehicles, workers } from "@/data/core";
import { deskUsers } from "@/data/fleet";
import { nowStamp } from "@/data/fleet/time";
import { TODAY } from "@/lib/dates";
import { useSession } from "@/lib/auth";
import { uiStore } from "./store";

export function useActor() {
  const u = useSession();
  return { name: u?.name ?? "Fleet user", username: u?.username ?? "" };
}

/** Clock that is stable on first render (no hydration mismatch) and ticks afterwards. */
export function useClock(everyMs = 30_000) {
  const [now, setNow] = useState(`${TODAY}T12:00`);
  useEffect(() => {
    const tick = () => setNow(nowStamp());
    tick();
    const t = setInterval(tick, everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

export function useDesk() {
  const locs = locations.useAll();
  const users = deskUsers.useAll();
  const session = useSession();
  const ui = uiStore.use();
  const desks = locs.filter((l) => l.kind === "handover_desk");
  const mine = users.find((u) => u.username === session?.username && u.status === "active");
  const deskId = desks.some((d) => d.id === ui.deskId) ? ui.deskId : mine?.deskId ?? desks[0]?.id ?? "";
  const operators = users.filter((u) => u.deskId === deskId && u.status === "active");
  const operator = mine && mine.deskId === deskId ? mine : operators[0];
  return { desks, deskId, desk: desks.find((d) => d.id === deskId), setDeskId: (id: string) => uiStore.set({ deskId: id }), operator, operators };
}

export function useCore() {
  return { vehicles: vehicles.useAll(), workers: workers.useAll(), locations: locations.useAll() };
}
