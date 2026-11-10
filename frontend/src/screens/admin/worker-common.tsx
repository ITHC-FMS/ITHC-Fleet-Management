"use client";

import { useState } from "react";
import { Select } from "@/components/app/fields";
import { shifts, type Shift } from "@/data/admin";
import { workers, type Worker } from "@/data/core";
import { useSession } from "@/lib/auth";

/**
 * The worker whose data is shown. A signed-in Worker only ever sees their own record.
 * The demo user may not exist in the seeded workforce, so fall back to the first driver with shifts and say so.
 * Monitoring roles (Admin, CEO) get a picker.
 */
export function useMyWorker() {
  const session = useSession();
  const ws = workers.useAll();
  const sh = shifts.useAll();
  const drivers = ws.filter((w) => w.roles.includes("driver") && sh.some((s) => s.workerId === w.id));
  const [picked, setPicked] = useState("");
  const isWorker = session?.roleSlug === "worker";
  const match = ws.find((w) => w.username === session?.username) ?? ws.find((w) => w.name === session?.name && w.roles.includes("driver"));
  const me: Worker | undefined = (!isWorker && picked ? drivers.find((d) => d.id === picked) : undefined) ?? match ?? drivers[0];
  const fallback = isWorker && !match;
  const picker = !isWorker && session ? (
    <Select aria-label="View as worker" value={me?.id ?? ""} onChange={(e) => setPicked(e.target.value)} className="h-12 text-base">
      {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
    </Select>
  ) : null;
  return { me, fallback, picker, shifts: sh.filter((s) => s.workerId === me?.id) as Shift[] };
}
