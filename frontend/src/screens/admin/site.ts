"use client";

import { useState } from "react";
import { clients, contracts, locations, workers } from "@/data/core";
import { SUPERVISOR_SITES } from "@/data/admin";
import { useSession } from "@/lib/auth";

export const fmtMinutes = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;

/** The supervisor's own site (locked), or a selectable site when an admin/CEO is monitoring. */
export function useSite() {
  const session = useSession();
  const locs = locations.useAll();
  const cons = contracts.useAll();
  const cls = clients.useAll();
  const ws = workers.useAll();
  const own = session ? SUPERVISOR_SITES[session.username] : undefined;
  const isSupervisor = session?.roleSlug === "supervisor";
  const sites = locs.filter((l) => l.kind === "client_site");
  const [picked, setPicked] = useState("loc-s1");
  const locationId = isSupervisor ? (own?.locationId ?? "loc-s1") : picked;
  const location = sites.find((l) => l.id === locationId);
  const placed = ws.filter((w) => w.currentLocationId === locationId && !["terminated", "absconded"].includes(w.status));
  const clientId = placed[0]?.currentClientId;
  const client = cls.find((c) => c.id === clientId);
  const contract = cons.find((c) => c.clientId === clientId && c.status === "active");
  return {
    locationId, location, sites, placed, client, contract, locked: isSupervisor, setSite: setPicked,
    clientContact: !!own?.clientContact, recorder: session?.name ?? "Site supervisor",
  };
}
