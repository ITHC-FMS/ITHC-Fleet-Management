import { addDays, TODAY } from "@/lib/dates";
import { workers as coreWorkers } from "../core";
import { logAudit, segments } from "./store";
import { statusOn } from "./statuses";
import type { StatusKey, StatusSegment } from "./types";

/** Keep the core worker.status in step with the status timeline on TODAY. */
export async function syncCoreStatus(workerId: string) {
  const w = coreWorkers.getSync(workerId);
  if (!w) return;
  const st = statusOn(await segments.list(), w);
  if (st !== w.status) await coreWorkers.save({ ...w, status: st, version: w.version + 1 });
}

/** Add a status segment; an open-ended one closes the previous open segment the day before. */
export async function addStatusSegment(p: { workerId: string; status: StatusKey; from: string; to: string | null; reason?: StatusSegment["reason"]; note?: string; actor: string; auditReason?: string }) {
  const all = await segments.list();
  if (p.to === null) {
    for (const s of all.filter((x) => x.workerId === p.workerId && x.to === null && x.from < p.from)) await segments.save({ ...s, to: addDays(p.from, -1), version: s.version + 1 });
  }
  const seg: StatusSegment = { id: segments.nextId("seg"), workerId: p.workerId, status: p.status, from: p.from, to: p.to, reason: p.reason, note: p.note, version: 1 };
  await segments.save(seg);
  await syncCoreStatus(p.workerId);
  await logAudit({ actor: p.actor, entity: "worker_status", entityId: p.workerId, action: "status_segment", reason: p.auditReason, detail: `${p.status} from ${p.from} to ${p.to ?? "open"}` });
  return seg;
}

const latin = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).filter(Boolean);
/** Latin letters, words joined by a dot, hyphen and a unique number, e.g. ahmed.ali-0042. */
export const makeUsername = (name: string, num: number) => `${latin(name).join(".") || "worker"}-${String(num).padStart(4, "0")}`;
export const tempPassword = () => `Tmp-${Math.random().toString(36).slice(2, 6)}${Math.floor(Math.random() * 90 + 10)}`;
export const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;
export const todayStr = TODAY;
