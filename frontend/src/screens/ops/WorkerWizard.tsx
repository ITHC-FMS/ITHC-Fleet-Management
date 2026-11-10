"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/status-badge";
import { companies } from "@/data/core";
import type { Worker, WorkerRole } from "@/data/entities";
import { parseKD, formatKD } from "@/lib/money";
import { TODAY } from "@/lib/dates";
import { STATUS_KEYS, STATUS_LABEL } from "@/data/ops/statuses";
import { logAudit, payConfig, payParams, workerExt, workerLogins, coreWorkersCol } from "@/data/ops/store";
import { addStatusSegment, makeUsername, tempPassword } from "@/data/ops/worker-ops";
import type { StatusKey } from "@/data/ops/types";
import { Notice, useActor, useNames } from "./shared";

const ROLES: WorkerRole[] = ["driver", "picker", "warehouse", "security", "barista", "handover", "service", "admin"];
const STEPS = ["Identity", "Role & employment", "Driver details", "Compensation", "Review"];

export function WorkerWizard({ onClose }: { onClose: () => void }) {
  const names = useNames();
  const actor = useActor();
  const cfg = payConfig.useAll();
  const cos = companies.useAll().filter((c) => c.kind === "operating");
  const def = (k: string) => String((cfg.find((c) => c.group === "allowance" && c.key === k)?.defaultFils ?? 0) / 1000);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ username: string; password: string; email?: string; id: string } | null>(null);
  const [f, setF] = useState({
    name: "", nationality: "", phone: "+965 ", email: "", civilId: "", passportNo: "", visaNo: "", healthCardNo: "",
    roles: ["driver"] as WorkerRole[], employingCompany: "cmp-ithc", contractOwner: "cmp-ithc", joiningDate: TODAY, contractEnd: "", status: "training" as StatusKey, clientId: "",
    licenceNo: "", vehicleTypes: ["car"] as ("car" | "bike")[], riderId: "", batch: "",
    base: "180", overtime: "0", food: def("food"), accom: def("accommodation"), target: "0", above: "0", below: "0",
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const isDriver = f.roles.includes("driver");
  const steps = isDriver ? STEPS : STEPS.filter((s) => s !== "Driver details");
  const cur = steps[step];

  const next = () => {
    setErr("");
    if (cur === "Identity" && !f.name.trim()) return setErr("Name is required. Civil ID, passport, visa and health card are optional: a new arrival may not have them yet.");
    if (cur === "Role & employment" && f.roles.length === 0) return setErr("Choose at least one role.");
    if (cur === "Compensation") {
      for (const k of ["base", "overtime", "food", "accom"] as const) if (!Number.isFinite(parseKD(f[k])) || parseKD(f[k]) < 0) return setErr("Compensation amounts must be valid KD values (3 decimals).");
    }
    setStep(step + 1);
  };

  const create = async () => {
    const all = await coreWorkersCol.list();
    const num = Math.max(0, ...all.map((w) => Number(w.id.split("-")[1]))) + 1;
    const id = `wrk-${String(num).padStart(4, "0")}`;
    const username = makeUsername(f.name, num);
    const w: Worker = {
      id, username, name: f.name.trim(), nationality: f.nationality.trim() || "Unknown", roles: f.roles, status: f.status, employingCompany: f.employingCompany, joiningDate: f.joiningDate, phone: f.phone.trim(),
      civilId: f.civilId.trim() || undefined, passportNo: f.passportNo.trim() || undefined, licenceNo: isDriver ? f.licenceNo.trim() || undefined : undefined, riderId: isDriver ? f.riderId.trim() || undefined : undefined,
      vehicleTypes: isDriver ? f.vehicleTypes : undefined, baseSalary: parseKD(f.base), overtimeComponent: parseKD(f.overtime), currentClientId: f.clientId || undefined, batch: f.batch || undefined, version: 1,
    };
    await coreWorkersCol.save(w);
    await workerExt.save({ id, email: f.email.trim() || undefined, visaNo: f.visaNo || undefined, healthCardNo: f.healthCardNo || undefined, contractEnd: f.contractEnd || undefined, contractOwnerCompanyId: f.contractOwner });
    await payParams.save({ id, foodAllowance: parseKD(f.food), accommodationMax: parseKD(f.accom), monthlyOrderTarget: Number(f.target) || 0, incentiveRateAbove: Number(f.above) || 0, incentiveRateBelow: Number(f.below) || 0, effectiveFrom: f.joiningDate, version: 1 });
    await addStatusSegment({ workerId: id, status: f.status, from: f.joiningDate, to: null, actor });
    const password = tempPassword();
    await workerLogins.save({ id, username, tempPassword: password, revealed: !f.email.trim(), views: [], emailedTo: f.email.trim() || undefined, mustChange: true, active: true });
    await logAudit({ actor, entity: "worker", entityId: id, action: "create", detail: `Onboarded ${w.name} (${w.roles.join(", ")}); login ${username} created; initial pay parameters set` });
    setDone({ username, password, email: f.email.trim() || undefined, id });
  };

  if (done)
    return (
      <FormSheet open onOpenChange={(o) => !o && onClose()} title="Worker onboarded" hideSubmit>
        <Notice tone="good">{f.name} was created as {done.id}. Profile, status timeline, pay parameters and worker login were created in one step.</Notice>
        <div className="space-y-1 text-sm"><p>Username (fixed from now on): <b>{done.username}</b></p>
          {done.email ? <p>Temporary password emailed to <b>{done.email}</b>. The worker must change it at first login.</p> : (
            <div className="space-y-2"><Notice tone="warn">No email on file. Copy these credentials to the worker manually (for example over WhatsApp). The password is shown once; later views are logged.</Notice>
              <p>Temporary password: <code className="rounded bg-muted px-1">{done.password}</code> <Button size="xs" variant="outline" onClick={() => navigator.clipboard?.writeText(`${done.username} / ${done.password}`)}><Copy /> Copy</Button></p></div>
          )}
        </div>
      </FormSheet>
    );

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Onboard worker" description={`Step ${step + 1} of ${steps.length}: ${cur}`} wide
      onSubmit={cur === "Review" ? create : next} submitLabel={cur === "Review" ? "Create worker" : "Next"}>
      <div className="flex gap-1">{steps.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded ${i <= step ? "bg-foreground" : "bg-muted"}`} />)}</div>
      {cur === "Identity" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name (required)" className="col-span-2"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} autoFocus /></Field>
          <Field label="Nationality"><Input value={f.nationality} onChange={(e) => set({ nationality: e.target.value })} /></Field>
          <Field label="Phone / WhatsApp"><Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Email" hint="Temporary password is emailed here"><Input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="Civil ID (optional)" hint="Not issued yet for new arrivals"><Input value={f.civilId} onChange={(e) => set({ civilId: e.target.value })} /></Field>
          <Field label="Passport no. (optional)"><Input value={f.passportNo} onChange={(e) => set({ passportNo: e.target.value })} /></Field>
          <Field label="Visa / residency no. (optional)"><Input value={f.visaNo} onChange={(e) => set({ visaNo: e.target.value })} /></Field>
          <Field label="Health card no. (optional)"><Input value={f.healthCardNo} onChange={(e) => set({ healthCardNo: e.target.value })} /></Field>
        </div>
      )}
      {cur === "Role & employment" && (
        <div className="space-y-3">
          <Field label="Roles (one or more)"><div className="flex flex-wrap gap-2">{ROLES.map((r) => <label key={r} className="flex items-center gap-1 rounded border px-2 py-1 text-sm"><input type="checkbox" checked={f.roles.includes(r)} onChange={(e) => set({ roles: e.target.checked ? [...f.roles, r] : f.roles.filter((x) => x !== r) })} />{r}</label>)}</div></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employing company"><Select value={f.employingCompany} onChange={(e) => set({ employingCompany: e.target.value })}>{cos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Contract-owning company"><Select value={f.contractOwner} onChange={(e) => set({ contractOwner: e.target.value })}>{cos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Joining date"><Input type="date" value={f.joiningDate} onChange={(e) => set({ joiningDate: e.target.value })} /></Field>
            <Field label="Contract end"><Input type="date" value={f.contractEnd} onChange={(e) => set({ contractEnd: e.target.value })} /></Field>
            <Field label="Initial status"><Select value={f.status} onChange={(e) => set({ status: e.target.value as StatusKey })}>{STATUS_KEYS.filter((k) => ["training", "probation", "active", "accommodation", "standby"].includes(k)).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}</Select></Field>
            <Field label="Client (optional)" hint="No client or vehicle is valid"><Select value={f.clientId} onChange={(e) => set({ clientId: e.target.value })}><option value="">None / bench</option>{names.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          </div>
        </div>
      )}
      {cur === "Driver details" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Licence no."><Input value={f.licenceNo} onChange={(e) => set({ licenceNo: e.target.value })} /></Field>
          <Field label="Platform rider ID"><Input value={f.riderId} onChange={(e) => set({ riderId: e.target.value })} /></Field>
          <Field label="Vehicle type qualification"><div className="flex gap-3 pt-1 text-sm">{(["car", "bike"] as const).map((t) => <label key={t} className="flex items-center gap-1"><input type="checkbox" checked={f.vehicleTypes.includes(t)} onChange={(e) => set({ vehicleTypes: e.target.checked ? [...f.vehicleTypes, t] : f.vehicleTypes.filter((x) => x !== t) })} />{t}</label>)}</div></Field>
          <Field label="Marketplace batch"><Select value={f.batch} onChange={(e) => set({ batch: e.target.value })}><option value="">None</option><option>Batch 1</option><option>Batch 2</option><option>Batch 3</option></Select></Field>
        </div>
      )}
      {cur === "Compensation" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Initial values only. After onboarding, only the Payroll Manager changes these (Pay Parameters), with an audit reason.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base salary (KD)"><Input value={f.base} onChange={(e) => set({ base: e.target.value })} inputMode="decimal" /></Field>
            <Field label="Overtime component (KD)"><Input value={f.overtime} onChange={(e) => set({ overtime: e.target.value })} inputMode="decimal" /></Field>
            <Field label="Food allowance (KD)"><Input value={f.food} onChange={(e) => set({ food: e.target.value })} inputMode="decimal" /></Field>
            <Field label="Accommodation allowance max (KD)"><Input value={f.accom} onChange={(e) => set({ accom: e.target.value })} inputMode="decimal" /></Field>
            <Field label="Monthly order target"><Input value={f.target} onChange={(e) => set({ target: e.target.value })} inputMode="numeric" /></Field>
            <div />
            <Field label="Incentive above target (fils/order)"><Input value={f.above} onChange={(e) => set({ above: e.target.value })} inputMode="numeric" /></Field>
            <Field label="Incentive below target (fils/order)"><Input value={f.below} onChange={(e) => set({ below: e.target.value })} inputMode="numeric" /></Field>
          </div>
        </div>
      )}
      {cur === "Review" && (
        <div className="space-y-2 text-sm">
          <p><b>{f.name}</b> · {f.roles.join(", ")} · {f.nationality || "nationality not set"}</p>
          <p>Employing company {cos.find((c) => c.id === f.employingCompany)?.name}; contract-owning {cos.find((c) => c.id === f.contractOwner)?.name}</p>
          <p>Identity documents: {[f.civilId && "civil ID", f.passportNo && "passport", f.visaNo && "visa", f.healthCardNo && "health card"].filter(Boolean).join(", ") || "none yet (allowed)"}</p>
          <p>Base {formatKD(parseKD(f.base) || 0)} + overtime {formatKD(parseKD(f.overtime) || 0)} · initial status <StatusBadge>{STATUS_LABEL[f.status]}</StatusBadge></p>
          <Notice tone="info">On create the system generates a fixed username from the name, creates the worker login with a temporary password, {f.email ? "emails it" : "and shows it once because no email is on file"}, and writes audit entries.</Notice>
        </div>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
      {step > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setStep(step - 1)}>Back</Button>}
    </FormSheet>
  );
}
