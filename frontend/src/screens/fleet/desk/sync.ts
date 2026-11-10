import { vehicles } from "@/data/core";
import { handoverEvents, nowStamp } from "@/data/fleet";
import { applyEffects } from "./commit";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Replays the queued events in time order. Optimistic locking: if the vehicle changed on the server since the desk
 * recorded the event, the event is not merged and is held for customer support (damage is always accepted).
 */
export async function syncQueue(deskId: string | undefined, failNext: boolean): Promise<{ synced: number; held: number; failed: number }> {
  const queue = (await handoverEvents.list())
    .filter((e) => (e.sync === "queued" || e.sync === "failed") && (!deskId || e.deskId === deskId))
    .sort((a, b) => (a.at < b.at ? -1 : 1));
  const expected = new Map<string, number>();
  const res = { synced: 0, held: 0, failed: 0 };
  let first = true;
  for (const e of queue) {
    await handoverEvents.save({ ...e, sync: "syncing" });
    await wait(350);
    if (failNext && first) {
      first = false;
      await handoverEvents.save({ ...e, sync: "failed", conflict: "Network error during sync, will retry" });
      res.failed++;
      continue;
    }
    first = false;
    const v = vehicles.getSync(e.vehicleId);
    const want = expected.get(e.vehicleId) ?? e.vehicleVersionSeen;
    if (v && want !== undefined && v.version !== want) {
      if (e.inspectionResult === "fail") {
        await applyEffects(e);
        await handoverEvents.save({ ...e, sync: "synced", syncedAt: nowStamp(), conflict: `Version conflict (saw v${want}, server v${v.version}) accepted because damage is always recorded` });
        res.synced++;
      } else {
        await handoverEvents.save({ ...e, sync: "held", conflict: `Vehicle changed on the server since this event was recorded (saw v${want}, now v${v.version}). Not merged: held for customer support.` });
        res.held++;
      }
      continue;
    }
    await applyEffects(e);
    await handoverEvents.save({ ...e, sync: "synced", syncedAt: nowStamp(), conflict: undefined });
    const nv = vehicles.getSync(e.vehicleId);
    if (nv) expected.set(e.vehicleId, nv.version);
    res.synced++;
  }
  return res;
}
