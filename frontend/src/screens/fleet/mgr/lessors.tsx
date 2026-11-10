"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { companies as companiesCol, vehicles as vehiclesCol } from "@/data/core";
import {
  assignmentActive, contractState, costSchedules, fleetAudit, fmtStamp, leaseLinks, lessorContracts, logAudit, vehicleAssignments, type LessorContract,
} from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { addDays, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { useActor } from "../_shared/hooks";

const stTone = { active: "good", expiring: "warn", expired: "bad", superseded: "neutral", future: "info" } as const;

export default function LessorsScreen(_: ScreenProps) {
  void _;
  const actor = useActor();
  const comps = companiesCol.useAll().filter((c) => c.kind === "lessor");
  const contracts = lessorContracts.useAll();
  const links = leaseLinks.useAll();
  const vehicles = vehiclesCol.useAll();
  const sched = costSchedules.useAll();
  const assignments = vehicleAssignments.useAll();
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<{ mode: "new" | "renew" | "edit"; c?: LessorContract } | null>(null);
  const [lessorForm, setLessorForm] = useState(false);
  const [showOld, setShowOld] = useState(false);

  const lessor = (id: string) => comps.find((c) => c.id === id)?.name ?? id;
  const vehOf = (c: LessorContract) => links.filter((l) => l.contractId === c.id).map((l) => vehicles.find((v) => v.id === l.id)).filter(Boolean) as typeof vehicles;
  const charge = (c: LessorContract) => vehOf(c).reduce((s, v) => s + (sched.find((x) => x.id === v.id)?.monthlyCharge ?? v.monthlyCost), 0);
  const rows = contracts.filter((c) => showOld || c.status === "active");
  const expired = contracts.filter((c) => contractState(c) === "expired");
  const affected = expired.flatMap((c) => vehOf(c));
  const liveAssign = affected.flatMap((v) => assignments.filter((a) => a.vehicleId === v.id && assignmentActive(a)));
  const cur = contracts.find((c) => c.id === sel);

  const cols: Column<LessorContract>[] = [
    { key: "lessor", header: "Lessor", value: (c) => lessor(c.lessorId), cell: (c) => <span className="font-medium">{lessor(c.lessorId)}</span> },
    { key: "no", header: "Contract", value: (c) => c.contractNo, cell: (c) => `${c.contractNo} v${c.contractVersion}` },
    { key: "start", header: "Start", value: (c) => c.start, cell: (c) => fmtDate(c.start) },
    { key: "end", header: "End", value: (c) => c.end, cell: (c) => fmtDate(c.end) },
    { key: "veh", header: "Vehicles", align: "end", value: (c) => vehOf(c).length },
    { key: "chg", header: "Charge / month", align: "end", value: (c) => charge(c), cell: (c) => formatKD(charge(c)) },
    { key: "st", header: "Status", value: (c) => contractState(c), cell: (c) => <StatusBadge tone={stTone[contractState(c)]}>{contractState(c)}</StatusBadge> },
    { key: "act", header: "", sortable: false, cell: (c) => (c.status === "active" ? <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setForm({ mode: "renew", c }); }}>Renew</Button> : null) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Lessors and lessor contracts" description="External companies supplying vehicles under contract." actions={<><Button variant="outline" onClick={() => setLessorForm(true)}><Plus /> Add lessor</Button><Button onClick={() => setForm({ mode: "new" })}><Plus /> Add contract</Button></>} />
      <KpiGrid>
        <KpiCard label="Lessors" value={comps.length} />
        <KpiCard label="Active contracts" value={contracts.filter((c) => ["active", "expiring"].includes(contractState(c))).length} />
        <KpiCard label="Expiring within 60 days" value={contracts.filter((c) => contractState(c) === "expiring").length} tone="warn" />
        <KpiCard label="Vehicles affected by expiry" value={affected.length} tone={affected.length ? "bad" : "good"} hint="Not assignable until renewed" />
      </KpiGrid>
      {expired.length > 0 && (
        <div className="space-y-1 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/30 dark:text-red-200">
          <p className="font-medium">Notification to the Fleet Manager (in app; email sent to fleet@demo.ithc)</p>
          {expired.map((c) => <p key={c.id}>{lessor(c.lessorId)} contract {c.contractNo} v{c.contractVersion} expired {fmtDate(c.end)}: {vehOf(c).map((v) => v.plate).join(", ") || "no vehicles"}. Vehicles are no longer offered for new assignments.</p>)}
          <p>{liveAssign.length} existing assignment(s) on these vehicles must be handled manually: the system does not end them.</p>
        </div>
      )}
      <DataTable rows={rows} columns={cols} exportName="lessor-contracts" onRowClick={(c) => setSel(c.id)} toolbar={<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} /> Show superseded versions</label>} />
      {cur && <ContractSheet c={cur} lessor={lessor} onClose={() => setSel(null)} onEdit={() => { setForm({ mode: "edit", c: cur }); setSel(null); }} onRenew={() => { setForm({ mode: "renew", c: cur }); setSel(null); }} actor={actor.name} />}
      {form && <ContractForm key={form.mode + (form.c?.id ?? "")} {...form} actor={actor.name} onClose={() => setForm(null)} />}
      {lessorForm && <LessorForm actor={actor.name} onClose={() => setLessorForm(false)} />}
    </div>
  );
}

function ContractSheet({ c, lessor, onClose, onEdit, onRenew, actor }: { c: LessorContract; lessor: (id: string) => string; onClose: () => void; onEdit: () => void; onRenew: () => void; actor: string }) {
  const contracts = lessorContracts.useAll();
  const links = leaseLinks.useAll();
  const vehicles = vehiclesCol.useAll();
  const audit = fleetAudit.useAll().filter((a) => a.entity === "Lessor contract" && contracts.filter((x) => x.contractNo === c.contractNo).some((x) => x.id === a.entityId)).slice().reverse();
  const [pick, setPick] = useState("");
  const chain: LessorContract[] = [];
  for (let x: LessorContract | undefined = c; x; x = contracts.find((y) => y.id === x!.renewalOfId)) chain.push(x);
  const later = contracts.filter((x) => x.renewalOfId === c.id);
  const mine = links.filter((l) => l.contractId === c.id).map((l) => vehicles.find((v) => v.id === l.id)!).filter(Boolean);
  const free = vehicles.filter((v) => v.ownership === "rented" && !links.some((l) => l.id === v.id && l.contractId === c.id));
  const link = async () => {
    if (!pick) return;
    await leaseLinks.save({ id: pick, contractId: c.id });
    await logAudit(actor, "Lessor contract", c.id, "Vehicle linked", vehicles.find((v) => v.id === pick)?.plate ?? pick);
    setPick("");
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={`${lessor(c.lessorId)} · ${c.contractNo} v${c.contractVersion}`} description={`${fmtDate(c.start)} to ${fmtDate(c.end)}`} hideSubmit wide>
      <div className="space-y-4 text-sm">
        <div className="flex gap-2"><StatusBadge tone={stTone[contractState(c)]}>{contractState(c)}</StatusBadge>{later.length > 0 && <StatusBadge tone="neutral">renewed as v{later[0].contractVersion}</StatusBadge>}</div>
        <p>{c.terms}</p>
        <div><p className="mb-1 font-medium">Renewal history</p>{[...chain].reverse().map((x) => <p key={x.id}>v{x.contractVersion}: {fmtDate(x.start)} to {fmtDate(x.end)} <span className="text-muted-foreground">({x.status})</span></p>)}</div>
        <div>
          <p className="mb-1 font-medium">Vehicles on this contract ({mine.length})</p>
          {mine.map((v) => <p key={v.id}>{v.plate} · {v.make} {v.model} · {v.mode} · {v.status.replace("_", " ")}</p>)}
          {c.status === "active" && (
            <div className="mt-2 flex gap-2"><Select value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Link a leased vehicle…</option>{free.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.make} {v.model}</option>)}</Select><Button type="button" variant="outline" onClick={link}>Link</Button></div>
          )}
        </div>
        <div><p className="mb-1 font-medium">Contract documents</p>{c.documents.map((d) => { const exp = d.expires < TODAY ? "expired" : "valid"; return <p key={d.name}>{d.name} · {d.type} · {fmtDate(d.issued)} to {fmtDate(d.expires)} <StatusBadge tone={exp === "valid" ? "good" : "bad"}>{exp}</StatusBadge></p>; })}<p className="text-xs text-muted-foreground">Expiry dates are listed for the Compliance Watchlist.</p></div>
        <div><p className="mb-1 font-medium">Audit log</p>{audit.map((a) => <p key={a.id}>{fmtStamp(a.at)} · {a.actor} · {a.action}: {a.detail}</p>)}{audit.length === 0 && <p className="text-muted-foreground">No changes recorded.</p>}</div>
        {c.status === "active" && <div className="flex gap-2 border-t pt-3"><Button type="button" onClick={onRenew}>Renew</Button><Button type="button" variant="outline" onClick={onEdit}>Edit terms</Button></div>}
      </div>
    </FormSheet>
  );
}

function ContractForm({ mode, c, actor, onClose }: { mode: "new" | "renew" | "edit"; c?: LessorContract; actor: string; onClose: () => void }) {
  const comps = companiesCol.useAll().filter((x) => x.kind === "lessor");
  const all = lessorContracts.useAll();
  const [lessorId, setLessorId] = useState(c?.lessorId ?? comps[0]?.id ?? "");
  const [no, setNo] = useState(c?.contractNo ?? "");
  const [start, setStart] = useState(mode === "renew" && c ? addDays(c.end, 1) : c?.start ?? TODAY);
  const [end, setEnd] = useState(mode === "renew" && c ? addDays(c.end, 365) : c?.end ?? addDays(TODAY, 365));
  const [terms, setTerms] = useState(c?.terms ?? "");
  const [doc, setDoc] = useState("");
  const [err, setErr] = useState("");
  const [lock] = useState(c?.version);

  const save = async () => {
    if (!lessorId || !no.trim() || !terms.trim()) return setErr("Lessor, contract number and terms are required.");
    if (end <= start) return setErr("End date must be after the start date.");
    if (mode === "new" && all.some((x) => x.contractNo.toLowerCase() === no.trim().toLowerCase())) return setErr("Contract number already exists; renew it instead.");
    const docs = doc.trim() ? [{ name: doc.trim(), type: "Lease agreement", issued: start, expires: end }] : mode === "edit" ? c!.documents : [];
    if (mode === "edit" && c) {
      const cur = lessorContracts.getSync(c.id);
      if (!cur || cur.version !== lock) return setErr("This contract changed elsewhere. Reopen it.");
      await lessorContracts.save({ ...cur, terms: terms.trim(), end, start, documents: doc.trim() ? [...cur.documents, ...docs] : cur.documents, version: cur.version + 1 });
      await logAudit(actor, "Lessor contract", c.id, "Edited", `${c.contractNo} v${c.contractVersion}: ${start} to ${end}`);
    } else {
      const id = lessorContracts.nextId("lc");
      const ver = mode === "renew" && c ? c.contractVersion + 1 : 1;
      await lessorContracts.save({ id, lessorId, contractNo: no.trim(), contractVersion: ver, start, end, terms: terms.trim(), renewalOfId: mode === "renew" ? c?.id : undefined, status: "active", documents: docs, version: 1 });
      if (mode === "renew" && c) {
        await lessorContracts.save({ ...c, status: "superseded", version: c.version + 1 });
        for (const l of (await leaseLinks.list()).filter((x) => x.contractId === c.id)) await leaseLinks.save({ id: l.id, contractId: id });
        await logAudit(actor, "Lessor contract", id, "Renewed", `${no.trim()} v${c.contractVersion} renewed as v${ver} (${start} to ${end}); vehicles moved and assignable again`);
      } else await logAudit(actor, "Lessor contract", id, "Created", `${no.trim()} v1 (${start} to ${end})`);
    }
    onClose();
  };

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={mode === "renew" ? `Renew ${c?.contractNo}` : mode === "edit" ? `Edit ${c?.contractNo}` : "Add contract"} description={mode === "renew" ? "Creates the next version; its vehicles become assignable again." : undefined} onSubmit={save}>
      <Field label="Lessor"><Select value={lessorId} disabled={mode !== "new"} onChange={(e) => setLessorId(e.target.value)}>{comps.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
      <Field label="Contract number"><Input value={no} disabled={mode !== "new"} onChange={(e) => setNo(e.target.value)} placeholder="e.g. MD-2026-C" /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Start"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label="End"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field></div>
      <Field label="Terms"><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
      <Field label="Contract document file name" hint="Stored with the contract; its dates feed the Compliance Watchlist"><Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="signed-contract.pdf" /></Field>
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}

function LessorForm({ actor, onClose }: { actor: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const save = async () => {
    const all = await companiesCol.list();
    if (!name.trim()) return setErr("Name is required.");
    if (all.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) return setErr("A company with this name exists.");
    const id = `cmp-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    await companiesCol.save({ id, name: name.trim(), kind: "lessor" });
    await logAudit(actor, "Lessor", id, "Created", name.trim());
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Add lessor" onSubmit={save}>
      <Field label="Lessor name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}
