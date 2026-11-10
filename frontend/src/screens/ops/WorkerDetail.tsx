"use client";

import { useState } from "react";
import { Eye, MessageCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input } from "@/components/app/fields";
import { StatusBadge, toneFor, prettify } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { companies } from "@/data/core";
import type { WorkerRole } from "@/data/entities";
import { fmtDate } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import { contractInForce } from "@/data/ops/revenue";
import { contracts } from "@/data/core";
import { assignments, coreWorkersCol, logAudit, orders, payParams, workerExt, workerLogins } from "@/data/ops/store";
import { waLink } from "@/data/ops/worker-ops";
import { StatusTimeline } from "./StatusTimeline";
import { WorkerActionSheet, type WorkerAction } from "./WorkerActions";
import { Notice, useActor, useNames } from "./shared";

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4 border-b py-1.5 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-end">{v || "—"}</span></div>;

export function WorkerDetail({ workerId, editable, onClose }: { workerId: string; editable: boolean; onClose: () => void }) {
  const names = useNames();
  const actor = useActor();
  const w = names.wById.get(workerId)!;
  const ext = workerExt.useAll().find((e) => e.id === workerId);
  const login = workerLogins.useAll().find((l) => l.id === workerId);
  const prm = payParams.useAll().find((p) => p.id === workerId);
  const asg = assignments.useAll();
  const ords = orders.useAll();
  const cons = contracts.useAll();
  const cos = companies.useAll();
  const [action, setAction] = useState<WorkerAction | null>(null);
  const [edit, setEdit] = useState(false);
  const [shown, setShown] = useState(false);
  const [f, setF] = useState({ phone: w?.phone ?? "", nationality: w?.nationality ?? "", civilId: w?.civilId ?? "", passportNo: w?.passportNo ?? "", licenceNo: w?.licenceNo ?? "", riderId: w?.riderId ?? "", visaNo: ext?.visaNo ?? "", healthCardNo: ext?.healthCardNo ?? "", email: ext?.email ?? "" });
  const [roles, setRoles] = useState<WorkerRole[]>(w?.roles ?? []);
  const [opened] = useState(w?.version ?? 0);
  const [err, setErr] = useState("");
  if (!w) return null;

  const mine = asg.filter((a) => a.workerId === workerId).sort((a, b) => b.from.localeCompare(a.from));
  const covered = asg.filter((a) => a.substitutesWorkerId === workerId);
  const hasWork = ords.some((o) => o.workerId === workerId) || mine.some((a) => a.vehicleId);
  const blocked = w.status === "blocked";

  const saveProfile = async () => {
    const cur = coreWorkersCol.getSync(workerId);
    if (cur && cur.version !== opened) return setErr(`This worker was changed by someone else (now v${cur.version}). Close and reopen.`);
    await coreWorkersCol.save({ ...(cur ?? w), phone: f.phone, nationality: f.nationality, civilId: f.civilId || undefined, passportNo: f.passportNo || undefined, licenceNo: f.licenceNo || undefined, riderId: f.riderId || undefined, roles: roles.length ? roles : (cur ?? w).roles, version: (cur?.version ?? 1) + 1 });
    if (roles.length && roles.join() !== w.roles.join()) await logAudit({ actor, entity: "worker", entityId: workerId, action: "role_change", detail: `Roles ${w.roles.join(", ")} to ${roles.join(", ")}` });
    if (ext) await workerExt.save({ ...ext, visaNo: f.visaNo || undefined, healthCardNo: f.healthCardNo || undefined, email: f.email || undefined });
    await logAudit({ actor, entity: "worker", entityId: workerId, action: "update_profile", detail: "Profile and identity fields updated" });
    setEdit(false); setErr("");
  };

  const reveal = async () => {
    if (!login) return;
    await workerLogins.save({ ...login, revealed: true, views: [...login.views, { at: "2026-11-09", by: actor }] });
    await logAudit({ actor, entity: "worker_login", entityId: workerId, action: "view_temp_password", detail: "Temporary password viewed" });
    setShown(true);
  };

  const profile = (
    <div className="space-y-3">
      {!edit ? (
        <>
          <Row k="Roles" v={w.roles.join(", ")} /><Row k="Nationality" v={w.nationality} /><Row k="Phone" v={w.phone} /><Row k="Email" v={ext?.email} />
          <Row k="Civil ID" v={w.civilId ?? <StatusBadge tone="warn">Not recorded yet</StatusBadge>} /><Row k="Passport" v={w.passportNo} /><Row k="Visa / residency" v={ext?.visaNo} /><Row k="Health card" v={ext?.healthCardNo} />
          {w.roles.includes("driver") && <><Row k="Licence" v={w.licenceNo} /><Row k="Vehicle types" v={w.vehicleTypes?.join(", ")} /><Row k="Platform rider ID" v={w.riderId} /><Row k="Marketplace batch" v={w.batch} /></>}
          <Row k="Employing company" v={cos.find((c) => c.id === w.employingCompany)?.name} /><Row k="Contract-owning company" v={cos.find((c) => c.id === ext?.contractOwnerCompanyId)?.name} />
          <Row k="Joined" v={fmtDate(w.joiningDate)} /><Row k="Contract end" v={ext?.contractEnd ? <>{fmtDate(ext.contractEnd)}{ext.contractEnd < "2026-11-09" && <StatusBadge tone="bad" className="ms-2">Expired</StatusBadge>}</> : null} />
          <Row k="Work type" v={hasWork ? "Delivery work" : "Placed labour (no orders, no vehicle)"} /><Row k="Record version" v={`v${w.version}`} />
          {editable && <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil /> Edit profile</Button>}
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {(["phone", "nationality", "email", "civilId", "passportNo", "visaNo", "healthCardNo", "licenceNo", "riderId"] as const).map((k) => <Field key={k} label={k}><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
          </div>
          <Field label="Roles (changes are audit-logged)"><div className="flex flex-wrap gap-2">{(["driver", "picker", "warehouse", "security", "barista", "handover", "service", "admin"] as WorkerRole[]).map((r) => <label key={r} className="flex items-center gap-1 rounded border px-2 py-1 text-sm"><input type="checkbox" checked={roles.includes(r)} onChange={(e) => setRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))} />{r}</label>)}</div></Field>
          {err && <Notice tone="bad">{err}</Notice>}
          <div className="flex gap-2"><Button size="sm" onClick={saveProfile}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button></div>
        </div>
      )}
    </div>
  );

  const comp = (
    <div className="space-y-2">
      <Row k="Base salary" v={formatKD(w.baseSalary)} /><Row k="Overtime component" v={formatKD(w.overtimeComponent)} />
      <Row k="Food allowance" v={prm ? formatKD(prm.foodAllowance) : null} /><Row k="Accommodation allowance (max)" v={prm ? formatKD(prm.accommodationMax) : null} />
      <Row k="Monthly order target" v={prm?.monthlyOrderTarget || "None (no order-based pay)"} /><Row k="Incentive above / below target" v={prm ? `${prm.incentiveRateAbove} / ${prm.incentiveRateBelow} fils per order` : null} />
      {prm?.marketplace && <Row k="Marketplace targets (pickups / dropoffs)" v={`${prm.marketplace.pickupTarget} / ${prm.marketplace.dropoffTarget}`} />}
      <Row k="Effective from" v={prm ? fmtDate(prm.effectiveFrom) : null} />
      <p className="text-xs text-muted-foreground">HR enters the initial values at onboarding. Later changes are made by the Payroll Manager on Pay Parameters, with a reason.</p>
    </div>
  );

  const hist = (
    <div className="space-y-2 text-sm">
      {mine.length === 0 && <p className="text-muted-foreground">No assignments or placements.</p>}
      {mine.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-2 border-b py-1.5">
          <b>{names.client(a.clientId)}</b><span className="text-muted-foreground">{a.place}</span><span>{fmtDate(a.from)} to {a.to ? fmtDate(a.to) : "open"}</span>
          {a.kind === "substitution" && <StatusBadge tone="info">Covered {names.worker(a.substitutesWorkerId)}</StatusBadge>}
          {a.vehicleId && <span className="text-muted-foreground">{names.plate(a.vehicleId)}</span>}
          <span className="text-xs text-muted-foreground">contract {contractInForce(cons, a.clientId, a.from)?.contractNo ?? "—"} · owner {cos.find((c) => c.id === a.ownerCompanyId)?.name}</span>
        </div>
      ))}
      {covered.length > 0 && <p className="text-xs text-muted-foreground">Covered by: {covered.map((a) => `${names.worker(a.workerId)} (${a.from} to ${a.to ?? "open"})`).join("; ")}</p>}
    </div>
  );

  const account = (
    <div className="space-y-2">
      <Row k="Username (fixed)" v={login?.username ?? w.username} /><Row k="Login" v={login ? <StatusBadge tone={login.active ? "good" : "bad"}>{login.active ? "Active" : "Deactivated"}</StatusBadge> : null} />
      <Row k="Temporary password sent to" v={login?.emailedTo ?? "No email: shown to HR"} /><Row k="Must change at first login" v={login?.mustChange ? "Yes" : "No"} />
      <Row k="Password views logged" v={login?.views.length ?? 0} />
      {editable && login?.active && !login.emailedTo && (
        <div className="space-y-2">
          {shown ? <p className="text-sm">Temporary password: <code className="rounded bg-muted px-1">{login.tempPassword}</code> (this view was logged)</p> : <Button size="sm" variant="outline" onClick={reveal}><Eye /> Show temporary password (logged)</Button>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Accounts are never deleted by hand; completing offboarding deactivates the login.</p>
    </div>
  );

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={w.name} description={`${w.id} · ${w.username}`} wide hideSubmit>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={toneFor(w.status)}>{prettify(w.status)}</StatusBadge>
        {w.roles.map((r) => <StatusBadge key={r}>{r}</StatusBadge>)}
        <a href={waLink(w.phone)} target="_blank" rel="noreferrer" className="ms-auto inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted"><MessageCircle className="size-3.5" /> WhatsApp</a>
      </div>
      {blocked && <Notice tone="bad">Blocked: no assignments, tasks or updates can be given to this worker.</Notice>}
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setAction("renew")}>Renew contract</Button>
          {blocked ? <Button size="sm" variant="outline" onClick={() => setAction("unblock")}>Unblock</Button> : <Button size="sm" variant="outline" onClick={() => setAction("block")}>Block</Button>}
          <Button size="sm" variant="destructive" onClick={() => setAction("terminate")}>Terminate contract</Button>
        </div>
      )}
      <Tabs tabs={[
        { id: "p", label: "Profile", content: profile },
        { id: "s", label: "Status timeline", content: <StatusTimeline workerId={workerId} editable={editable} /> },
        { id: "c", label: "Compensation", content: comp },
        { id: "a", label: "Assignment history", content: hist },
        { id: "l", label: "Account", content: account },
      ]} />
      {action && <WorkerActionSheet workerId={workerId} action={action} onClose={() => setAction(null)} />}
    </FormSheet>
  );
}
