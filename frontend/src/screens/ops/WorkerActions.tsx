"use client";

import { useState } from "react";
import { Field, Input } from "@/components/app/fields";
import { addDays, TODAY } from "@/lib/dates";
import { assignments, logAudit, offboardings, workerExt } from "@/data/ops/store";
import { addStatusSegment } from "@/data/ops/worker-ops";
import { ReasonSheet, useActor, useNames } from "./shared";

export type WorkerAction = "renew" | "block" | "unblock" | "terminate";
const TITLES: Record<WorkerAction, string> = { renew: "Renew contract", block: "Block worker", unblock: "Unblock worker", terminate: "Terminate contract" };

/** HR's three manual choices on an expiring contract or document: Renew, Block or Terminate (never automatic). */
export function WorkerActionSheet({ workerId, action, onClose }: { workerId: string; action: WorkerAction; onClose: () => void }) {
  const names = useNames();
  const actor = useActor();
  const ext = workerExt.useAll().find((e) => e.id === workerId);
  const asg = assignments.useAll();
  const [date, setDate] = useState(action === "renew" ? addDays(TODAY, 365) : TODAY);
  const [err, setErr] = useState("");
  const name = names.worker(workerId);

  const run = async (reason: string) => {
    if (!date) return setErr("Date is required.");
    if (action === "renew") {
      if (ext) await workerExt.save({ ...ext, contractEnd: date });
      await logAudit({ actor, entity: "worker", entityId: workerId, action: "renew_contract", reason, detail: `Contract renewed to ${date}${ext?.contractEnd && ext.contractEnd < TODAY ? " (after expiry)" : ""}` });
    } else if (action === "block") {
      await addStatusSegment({ workerId, status: "blocked", from: date, to: null, actor, auditReason: reason, note: reason });
      await logAudit({ actor, entity: "worker", entityId: workerId, action: "block", reason, detail: `Blocked from ${date}: no assignments, tasks or updates` });
    } else if (action === "unblock") {
      await addStatusSegment({ workerId, status: "active", from: date, to: null, actor, auditReason: reason, note: reason });
      await logAudit({ actor, entity: "worker", entityId: workerId, action: "unblock", reason, detail: `Unblocked from ${date}` });
    } else {
      for (const a of asg.filter((x) => x.workerId === workerId && (x.to === null || x.to > date))) await assignments.save({ ...a, to: date < a.from ? a.from : date, version: a.version + 1 });
      await addStatusSegment({ workerId, status: "terminated", from: addDays(date, 1), to: null, actor, auditReason: reason, note: reason });
      if (ext) await workerExt.save({ ...ext, offboarding: { startedOn: TODAY, lastDay: date } });
      await offboardings.save({ id: workerId, lastDay: date, startedOn: TODAY, reason: `Terminated: ${reason}`, vehicleReturned: false, docs: { civilId: false, licence: false, uniform: false, keys: false, simCard: false, deviceBag: false }, settlementApproved: false, completed: false, version: 1 });
      await logAudit({ actor, entity: "worker", entityId: workerId, action: "terminate", reason, detail: `Contract terminated, last day ${date}; offboarding started` });
    }
    setErr("");
    onClose();
  };

  return (
    <ReasonSheet open onOpenChange={(o) => !o && onClose()} title={`${TITLES[action]}: ${name}`} submitLabel={TITLES[action]} onConfirm={run}
      description={action === "terminate" ? "Ends the contract and starts offboarding: clearing dues and deductions." : action === "block" ? "A blocked worker gets no assignments, tasks or updates. This is a manual decision." : action === "renew" ? "A contract can be renewed after its expiry date." : undefined}>
      <Field label={action === "renew" ? "New contract end date" : action === "terminate" ? "Last working day" : "Effective from"}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      {action === "renew" && ext?.contractEnd && <p className="text-xs text-muted-foreground">Current contract end: {ext.contractEnd}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </ReasonSheet>
  );
}
