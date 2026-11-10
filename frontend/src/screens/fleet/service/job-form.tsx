"use client";

import { useState } from "react";
import { vehicles as vehiclesCol } from "@/data/core";
import { incidents, logAudit, serviceJobs, type ServiceJob } from "@/data/fleet";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { addDays, TODAY } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import { useActor } from "../_shared/hooks";

/** Create (from an incident) or edit a service job. */
export function JobForm({ incidentId, job, onClose }: { incidentId?: string; job?: ServiceJob; onClose: () => void }) {
  const actor = useActor();
  const vehicles = vehiclesCol.useAll();
  const incs = incidents.useAll();
  const jobs = serviceJobs.useAll();
  const available = incs.filter((i) => (i.status === "routed" || i.status === "received") && !i.serviceJobId);
  const [incId, setIncId] = useState(incidentId ?? job?.incidentId ?? "");
  const inc = incs.find((i) => i.id === incId);
  const [work, setWork] = useState(job?.work ?? "");
  const [cost, setCost] = useState(job ? (job.costFils / 1000).toFixed(3) : "");
  const [ret, setRet] = useState(job?.expectedReturn ?? addDays(TODAY, 7));
  const [repl, setRepl] = useState(job?.replacementVehicleId ?? inc?.replacementVehicleId ?? "");
  const [reason, setReason] = useState("");
  const [lock] = useState(job?.version);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!inc && !job) return setErr("A service job starts from a damaged-vehicle record or an accident in service. Choose the incident.");
    if (!work.trim()) return setErr("Describe the work to be performed.");
    const c = parseKD(cost || "0");
    if (!(c >= 0)) return setErr("Cost must be a valid KD amount.");
    if (!ret || ret < (job?.opened ?? TODAY)) return setErr("Return-to-fleet date cannot be before the job opened.");
    if (job) {
      const cur = serviceJobs.getSync(job.id);
      if (!cur || cur.version !== lock) return setErr("This job changed elsewhere. Reopen it.");
      if (!reason.trim() && cur.costFils !== c) return setErr("A reason is required when the cost changes.");
      await serviceJobs.save({ ...cur, work: work.trim(), costFils: c, expectedReturn: ret, replacementVehicleId: repl || undefined, version: cur.version + 1 });
      await logAudit(actor.name, "Service job", job.id, "Edited", `Cost ${formatKD(c)}, return ${ret}`, reason.trim() || undefined);
    } else if (inc) {
      if (jobs.some((j) => j.incidentId === inc.id && j.status !== "returned")) return setErr("This incident already has an open job.");
      const id = serviceJobs.nextId("sj");
      await serviceJobs.save({ id, vehicleId: inc.vehicleId, incidentId: inc.id, source: inc.kind === "damage" ? "damaged" : "accident", opened: TODAY, work: work.trim(), costFils: c, expectedReturn: ret, replacementVehicleId: repl || undefined, status: "open", version: 1 });
      await incidents.save({ ...inc, status: "in_service", serviceJobId: id, receivedOn: inc.receivedOn ?? TODAY, version: inc.version + 1 });
      const v = vehiclesCol.getSync(inc.vehicleId);
      if (v && v.status !== "under_repair") {
        await vehiclesCol.save({ ...v, status: "under_repair", version: v.version + 1 });
        await logAudit(actor.name, "Vehicle", v.id, "Status change", "in service to under repair", `Service job ${id} opened`);
      }
      await logAudit(actor.name, "Service job", id, "Opened", `${v?.plate}: ${work.trim()}`, `From incident ${inc.id}`);
    }
    onClose();
  };

  const v = vehicles.find((x) => x.id === (inc?.vehicleId ?? job?.vehicleId));
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={job ? `Edit ${job.id}` : "New service job"} description={job ? `Version ${job.version}` : "Vehicle goes under repair while the job is open."} onSubmit={save}>
      {!job && (
        <Field label="Damaged-vehicle record / accident in service">
          <Select value={incId} onChange={(e) => { setIncId(e.target.value); setRepl(incs.find((i) => i.id === e.target.value)?.replacementVehicleId ?? ""); }}>
            <option value="">Choose incident…</option>
            {available.map((i) => <option key={i.id} value={i.id}>{i.id} · {vehicles.find((x) => x.id === i.vehicleId)?.plate} · {i.kind} · {i.description.slice(0, 40)}</option>)}
          </Select>
        </Field>
      )}
      {v && <p className="text-sm text-muted-foreground">Vehicle: <b>{v.plate}</b> {v.make} {v.model}</p>}
      <Field label="Work performed / planned"><Textarea value={work} onChange={(e) => setWork(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost (KD)"><Input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.000" /></Field>
        <Field label="Return-to-fleet date"><Input type="date" value={ret} onChange={(e) => setRet(e.target.value)} /></Field>
      </div>
      <Field label="Replacement vehicle issued"><Select value={repl} onChange={(e) => setRepl(e.target.value)}><option value="">None</option>{vehicles.filter((x) => x.id !== v?.id && x.mode !== "transport").map((x) => <option key={x.id} value={x.id}>{x.plate} · {x.make} {x.model}</option>)}</Select></Field>
      {job && <Field label="Reason for change (required if cost changes)"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}
