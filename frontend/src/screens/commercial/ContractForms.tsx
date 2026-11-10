"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { clients, companies, contracts, type Contract, type PricingModel, type RateLine } from "@/data/core";
import { signedOpps, writeAudit, type SignedOpportunity } from "@/data/commercial";
import { defaultRates, latestVersion, MODEL_LABEL } from "@/data/commercial/engine";
import { addDays, TODAY } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import { Notice, useActor } from "./ui";

interface Line { key: string; label: string; unit: string; amount: string }
const toLines = (r: RateLine[]): Line[] => r.map((x) => ({ ...x, amount: (x.amount / 1000).toFixed(3) }));

export function RateLinesEditor({ lines, onChange }: { lines: Line[]; onChange: (l: Line[]) => void }) {
  const set = (i: number, patch: Partial<Line>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Rate lines are the whole pricing configuration. Key suffixes: <code>_car</code> / <code>_bike</code> apply to that vehicle type, <code>_b1</code> / <code>_b2</code> apply to that batch.
        Amounts are KD with three decimals.
      </p>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[6rem_1fr_5.5rem_6.5rem_2rem] items-end gap-1.5">
          <Field label={i === 0 ? "Key" : ""}><Input value={l.key} onChange={(e) => set(i, { key: e.target.value.trim() })} /></Field>
          <Field label={i === 0 ? "Label" : ""}><Input value={l.label} onChange={(e) => set(i, { label: e.target.value })} /></Field>
          <Field label={i === 0 ? "Unit" : ""}><Input value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} /></Field>
          <Field label={i === 0 ? "Amount (KD)" : ""}><Input inputMode="decimal" value={l.amount} onChange={(e) => set(i, { amount: e.target.value })} /></Field>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove rate line" onClick={() => onChange(lines.filter((_, j) => j !== i))}><Trash2 /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, { key: "", label: "", unit: "unit", amount: "0.000" }])}><Plus /> Add rate line</Button>
    </div>
  );
}

function parseLines(lines: Line[]): { rates?: RateLine[]; error?: string } {
  if (!lines.length) return { error: "Add at least one rate line." };
  const keys = new Set<string>();
  const rates: RateLine[] = [];
  for (const l of lines) {
    if (!l.key || !l.label) return { error: "Every rate line needs a key and a label." };
    if (keys.has(l.key)) return { error: `Rate line key "${l.key}" is used twice.` };
    keys.add(l.key);
    const amount = parseKD(l.amount);
    if (!Number.isFinite(amount) || amount < 0) return { error: `Rate line "${l.key}" has an invalid amount.` };
    rates.push({ key: l.key, label: l.label, unit: l.unit || "unit", amount });
  }
  return { rates };
}

const MODELS = Object.keys(MODEL_LABEL) as PricingModel[];

/** Creates version 1 of a new contract, optionally from a signed opportunity. */
const ratesFromSigned = (s: SignedOpportunity): RateLine[] => {
  const model = (s.pricingModel as PricingModel) ?? "order_based";
  return defaultRates(model).map((r, i) => (i === 0 && model !== "order_based" && model !== "marketplace_batched" ? { ...r, amount: s.revenuePerHead } : r));
};

export function NewContractSheet({ open, onClose, role, initialSig }: { open: boolean; onClose: () => void; role: string; initialSig?: string }) {
  const actor = useActor();
  const init = initialSig ? signedOpps.getSync(initialSig) : undefined;
  const cl = clients.useAll(), co = companies.useAll(), all = contracts.useAll(), sig = signedOpps.useAll();
  const [f, setF] = useState({ contractNo: "", clientId: init?.clientId ?? "cli-americana", owner: "cmp-ithc", model: ((init?.pricingModel as PricingModel) ?? "order_based") as PricingModel, validFrom: init?.startDate ?? TODAY, validTo: "", seats: init ? String(init.heads) : "", floor: "", reason: init ? `Created from signed opportunity: ${init.name}` : "", sig: init?.id ?? "" });
  const [lines, setLines] = useState<Line[]>(toLines(init ? ratesFromSigned(init) : defaultRates("order_based")));
  const [err, setErr] = useState("");
  const awaiting = sig.filter((s) => s.status === "awaiting_contract");
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const fromSigned = (id: string) => {
    const s = awaiting.find((x) => x.id === id);
    if (!s) return set({ sig: "" });
    set({ sig: id, clientId: s.clientId, model: (s.pricingModel as PricingModel) ?? "order_based", validFrom: s.startDate, seats: String(s.heads), reason: `Created from signed opportunity: ${s.name}` });
    setLines(toLines(ratesFromSigned(s)));
  };

  const submit = async () => {
    const no = f.contractNo.trim().toUpperCase();
    if (!no) return setErr("Contract number is required.");
    if (all.some((c) => c.contractNo === no)) return setErr("That contract number already exists. Use New version to change rates.");
    if (!f.reason.trim()) return setErr("A reason is required for the audit log.");
    if (f.validTo && f.validTo < f.validFrom) return setErr("Valid-to cannot be before valid-from.");
    const { rates, error } = parseLines(lines);
    if (error || !rates) return setErr(error ?? "Invalid rates.");
    const seats = f.seats ? Number(f.seats) : undefined, floor = f.floor ? Number(f.floor) : undefined;
    if ((seats !== undefined && (!Number.isInteger(seats) || seats < 0)) || (floor !== undefined && (!Number.isInteger(floor) || floor < 0))) return setErr("Seats and volume floor must be whole numbers.");
    const c: Contract = { id: contracts.nextId("con"), contractNo: no, version: 1, clientId: f.clientId, ownerCompanyId: f.owner, pricingModel: f.model, validFrom: f.validFrom, validTo: f.validTo || null, seatsContracted: seats, volumeFloor: floor, rates, status: f.validFrom <= TODAY ? "active" : "draft" };
    await contracts.save(c);
    if (f.sig) {
      const s = sig.find((x) => x.id === f.sig);
      if (s) await signedOpps.save({ ...s, status: "converted", contractNo: no });
    }
    await writeAudit({ user: actor.name, role, entityType: "contract", entityId: no, entityLabel: `${no} v1`, action: "create", summary: `Contract created (${MODEL_LABEL[f.model]}), ${rates.length} rate lines, effective ${f.validFrom}`, reason: f.reason.trim(), after: rates.map((r) => `${r.key} ${formatKD(r.amount, { symbol: false })}`).join(", ") });
    setErr("");
    onClose();
  };

  return (
    <FormSheet wide open={open} onOpenChange={(o) => !o && onClose()} title="New contract" description="Creates version 1. Later rate changes create new versions." onSubmit={submit} submitLabel="Create contract">
      {err && <Notice tone="bad">{err}</Notice>}
      {role === "finance" && (
        <Field label="From signed opportunity (optional)" hint="Carries over client, type, heads, revenue per head and start date.">
          <Select value={f.sig} onChange={(e) => fromSigned(e.target.value)}>
            <option value="">None, enter manually</option>
            {awaiting.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contract number"><Input value={f.contractNo} placeholder="CT-XXXX-01" onChange={(e) => set({ contractNo: e.target.value })} /></Field>
        <Field label="Client" hint={`Legal entity: ${cl.find((c) => c.id === f.clientId)?.legalName ?? ""}`}>
          <Select value={f.clientId} onChange={(e) => set({ clientId: e.target.value })}>{cl.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Contract-owning company"><Select value={f.owner} onChange={(e) => set({ owner: e.target.value })}>{co.filter((c) => c.kind === "operating").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Pricing model (template for rate lines)">
          <Select value={f.model} onChange={(e) => { const m = e.target.value as PricingModel; set({ model: m }); setLines(toLines(defaultRates(m))); }}>
            {MODELS.map((m) => <option key={m} value={m}>{MODEL_LABEL[m]}</option>)}
          </Select>
        </Field>
        <Field label="Valid from"><Input type="date" value={f.validFrom} onChange={(e) => set({ validFrom: e.target.value })} /></Field>
        <Field label="Valid to (blank = open)"><Input type="date" value={f.validTo} onChange={(e) => set({ validTo: e.target.value })} /></Field>
        <Field label="Seats contracted"><Input inputMode="numeric" value={f.seats} onChange={(e) => set({ seats: e.target.value })} /></Field>
        <Field label="Volume floor / minimum seats"><Input inputMode="numeric" value={f.floor} onChange={(e) => set({ floor: e.target.value })} /></Field>
      </div>
      <RateLinesEditor lines={lines} onChange={setLines} />
      <Field label="Reason (audit log)"><Textarea value={f.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
    </FormSheet>
  );
}

/** A rate change: closes the previous version's validity window and creates the next version. Old rates are never edited. */
export function NewVersionSheet({ contractNo, onClose, role }: { contractNo: string | null; onClose: () => void; role: string }) {
  const actor = useActor();
  const all = contracts.useAll();
  const latest = contractNo ? latestVersion(all, contractNo) : undefined;
  return latest ? <VersionBody key={latest.id} latest={latest} onClose={onClose} role={role} actor={actor.name} /> : null;
}

function VersionBody({ latest, onClose, role, actor }: { latest: Contract; onClose: () => void; role: string; actor: string }) {
  const [loadedId] = useState(latest.id);
  const [from, setFrom] = useState(latest.validFrom > TODAY ? addDays(latest.validFrom, 1) : TODAY);
  const [to, setTo] = useState(latest.validTo ?? "");
  const [seats, setSeats] = useState(String(latest.seatsContracted ?? ""));
  const [floor, setFloor] = useState(String(latest.volumeFloor ?? ""));
  const [lines, setLines] = useState<Line[]>(toLines(latest.rates));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    const cur = latestVersion(await contracts.list(), latest.contractNo);
    if (!cur || cur.id !== loadedId) return setErr("Conflict: a newer version of this contract was saved by someone else. Close this form and reopen it.");
    if (from <= cur.validFrom) return setErr(`The new version must start after the current version's start date (${cur.validFrom}).`);
    if (to && to < from) return setErr("Valid-to cannot be before valid-from.");
    if (!reason.trim()) return setErr("A reason for the change is required.");
    const { rates, error } = parseLines(lines);
    if (error || !rates) return setErr(error ?? "Invalid rates.");
    const unchanged = rates.length === cur.rates.length && rates.every((r, i) => JSON.stringify(r) === JSON.stringify(cur.rates[i]));
    if (unchanged) return setErr("No rate has changed. A new version is only created for a rate change.");
    const next: Contract = { ...cur, id: contracts.nextId("con"), version: cur.version + 1, validFrom: from, validTo: to || null, seatsContracted: seats ? Number(seats) : undefined, volumeFloor: floor ? Number(floor) : undefined, rates, status: from <= TODAY ? "active" : "draft" };
    const closing: Contract = { ...cur, validTo: !cur.validTo || cur.validTo >= from ? addDays(from, -1) : cur.validTo, status: from <= TODAY ? "superseded" : cur.status };
    await contracts.saveMany([closing, next]);
    const diff = rates.filter((r) => cur.rates.find((o) => o.key === r.key)?.amount !== r.amount).map((r) => `${r.key} ${formatKD(cur.rates.find((o) => o.key === r.key)?.amount ?? 0, { symbol: false })} to ${formatKD(r.amount, { symbol: false })}`).join("; ");
    await writeAudit({ user: actor, role, entityType: "contract", entityId: cur.contractNo, entityLabel: `${cur.contractNo} v${next.version}`, action: "create", summary: `New version v${next.version} effective ${from}; v${cur.version} closed ${closing.validTo}`, reason: reason.trim(), before: `v${cur.version}`, after: diff || `v${next.version}` });
    onClose();
  };

  return (
    <FormSheet wide open onOpenChange={(o) => !o && onClose()} title={`New version of ${latest.contractNo}`} description={`Based on v${latest.version}. v${latest.version} keeps its rates; transactions before the new start date still price against it.`} onSubmit={submit} submitLabel={`Create v${latest.version + 1}`}>
      {err && <Notice tone="bad">{err}</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Effective from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Valid to (blank = open)"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Seats contracted"><Input inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} /></Field>
        <Field label="Volume floor / minimum seats"><Input inputMode="numeric" value={floor} onChange={(e) => setFloor(e.target.value)} /></Field>
      </div>
      <RateLinesEditor lines={lines} onChange={setLines} />
      <Field label="Reason for rate change (audit log)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </FormSheet>
  );
}

/** Corrects non-rate details of an existing version (typos in seats, floor, owner, end date). Rates cannot be edited here. */
export function CorrectSheet({ contract, onClose, role }: { contract: Contract | null; onClose: () => void; role: string }) {
  return contract ? <CorrectBody key={contract.id} contract={contract} onClose={onClose} role={role} /> : null;
}
function CorrectBody({ contract, onClose, role }: { contract: Contract; onClose: () => void; role: string }) {
  const actor = useActor();
  const co = companies.useAll();
  const [snapshot] = useState(JSON.stringify(contract));
  const [owner, setOwner] = useState(contract.ownerCompanyId);
  const [seats, setSeats] = useState(String(contract.seatsContracted ?? ""));
  const [floor, setFloor] = useState(String(contract.volumeFloor ?? ""));
  const [to, setTo] = useState(contract.validTo ?? "");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const submit = async () => {
    const cur = contracts.getSync(contract.id);
    if (!cur || JSON.stringify(cur) !== snapshot) return setErr("Conflict: this contract version was changed by someone else since you opened it. Close and reopen.");
    if (!reason.trim()) return setErr("A reason is required for the audit log.");
    if (to && to < cur.validFrom) return setErr("Valid-to cannot be before valid-from.");
    await contracts.save({ ...cur, ownerCompanyId: owner, seatsContracted: seats ? Number(seats) : undefined, volumeFloor: floor ? Number(floor) : undefined, validTo: to || null });
    await writeAudit({ user: actor.name, role, entityType: "contract", entityId: cur.contractNo, entityLabel: `${cur.contractNo} v${cur.version}`, action: "update", summary: "Contract details corrected (rates untouched)", reason: reason.trim(), before: `owner ${cur.ownerCompanyId}, seats ${cur.seatsContracted ?? "-"}, floor ${cur.volumeFloor ?? "-"}, to ${cur.validTo ?? "open"}`, after: `owner ${owner}, seats ${seats || "-"}, floor ${floor || "-"}, to ${to || "open"}` });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={`Correct ${contract.contractNo} v${contract.version}`} description="Rates are locked on an existing version. Use New version to change a rate." onSubmit={submit}>
      {err && <Notice tone="bad">{err}</Notice>}
      <Field label="Contract-owning company"><Select value={owner} onChange={(e) => setOwner(e.target.value)}>{co.filter((c) => c.kind === "operating").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Seats contracted"><Input inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} /></Field>
      <Field label="Volume floor / minimum seats"><Input inputMode="numeric" value={floor} onChange={(e) => setFloor(e.target.value)} /></Field>
      <Field label="Valid to"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      <Field label="Reason (audit log)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </FormSheet>
  );
}
