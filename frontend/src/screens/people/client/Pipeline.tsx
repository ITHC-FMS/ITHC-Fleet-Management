"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { Button } from "@/components/ui/button";
import { clients, contracts, workers, type Client, type Contract } from "@/data/core";
import { escalations, opportunities, peopleSettings, seatRequirements, useSettings, type Opportunity, type Stage } from "@/data/people";
import { benchEligible, fmtX, gateOf, isDeployed, multipleX100 } from "@/data/people/calc";
import { placements } from "@/data/people";
import { addDays, daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { Errors, Notice, Section, useActor } from "../common";

const STAGES: Stage[] = ["lead", "proposal", "negotiation", "signed", "lost"];
interface Draft {
  id?: string; version?: number; clientId: string; prospectName: string; contractType: "fixed_labour" | "hourly"; heads: string; revenue: string; breakEven: string;
  startDate: string; stage: Stage; owner: string; notes: string;
}
const blank = (owner: string, be: number): Draft => ({ clientId: "", prospectName: "", contractType: "fixed_labour", heads: "", revenue: "", breakEven: (be / 1000).toFixed(3), startDate: addDays(TODAY, 60), stage: "lead", owner, notes: "" });

export default function Pipeline({ readOnly, editedBy }: ScreenProps) {
  const actor = useActor();
  const opps = opportunities.useAll();
  const clientList = clients.useAll();
  const cons = contracts.useAll();
  const ws = workers.useAll();
  const plc = placements.useAll();
  const esc = escalations.useAll();
  const settings = useSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [cfg, setCfg] = useState<{ a: string; b: string } | null>(null);
  const [apprRef, setApprRef] = useState("");

  const cname = useMemo(() => new Map(clientList.map((c) => [c.id, c.name])), [clientList]);
  const nameOf = (o: Opportunity) => (o.clientId ? cname.get(o.clientId) : o.prospectName) ?? "Unknown";
  const open = opps.filter((o) => o.stage !== "lost" && o.stage !== "signed");
  const signedNotStarted = opps.filter((o) => o.stage === "signed" && !o.convertedContractId ? true : o.stage === "signed" && o.startDate > TODAY);
  const benchCount = ws.filter((w) => benchEligible(w) && !isDeployed(w, plc)).length;
  const flagged = open.filter((o) => gateOf(o, settings) !== "ok");
  const weekly = open.filter((o) => gateOf(o, settings) === "escalate");
  const lastEsc = (o: Opportunity) => [...esc.filter((e) => e.kind === "gate_low" && e.refId === o.id).map((e) => e.date), o.lastEscalated ?? ""].sort().pop() || undefined;

  const gateBadge = (o: Opportunity) => {
    const g = gateOf(o, settings);
    if (o.stage === "lost") return <StatusBadge>Closed</StatusBadge>;
    if (g === "ok") return <StatusBadge tone="good">Passes</StatusBadge>;
    if (g === "approval") return o.approval === "approved" ? <StatusBadge tone="good">Approved in writing</StatusBadge> : <StatusBadge tone="warn">{o.approval === "requested" ? "Approval requested" : "Needs written approval"}</StatusBadge>;
    return o.approval === "approved" ? <StatusBadge tone="good">Approved in writing</StatusBadge> : <StatusBadge tone="bad">Escalate weekly</StatusBadge>;
  };

  const cols: Column<Opportunity>[] = [
    { key: "client", header: "Client", value: nameOf, cell: (o) => <div><div className="font-medium">{nameOf(o)}</div>{!o.clientId && <div className="text-xs text-muted-foreground">Prospect</div>}</div> },
    { key: "type", header: "Contract type", value: (o) => o.contractType, cell: (o) => prettify(o.contractType) },
    { key: "heads", header: "Heads", align: "end" },
    { key: "rev", header: "Revenue/head (KD)", align: "end", value: (o) => o.revenuePerHead, cell: (o) => formatKD(o.revenuePerHead, { symbol: false }) },
    { key: "be", header: "Break-even (KD)", align: "end", value: (o) => o.breakEvenPerHead, cell: (o) => formatKD(o.breakEvenPerHead, { symbol: false }) },
    { key: "mult", header: "Multiple", align: "end", value: multipleX100, cell: (o) => <span className={gateOf(o, settings) === "escalate" ? "font-semibold text-red-600" : gateOf(o, settings) === "approval" ? "font-semibold text-amber-600" : ""}>{fmtX(multipleX100(o))}</span> },
    { key: "monthly", header: "Monthly revenue (KD)", align: "end", value: (o) => o.heads * o.revenuePerHead, cell: (o) => formatKD(o.heads * o.revenuePerHead, { symbol: false }) },
    { key: "start", header: "Start", value: (o) => o.startDate, cell: (o) => fmtDate(o.startDate) },
    { key: "stage", header: "Stage", cell: (o) => <StatusBadge tone={o.stage === "signed" ? "good" : o.stage === "lost" ? "bad" : "info"}>{prettify(o.stage)}</StatusBadge> },
    { key: "gate", header: "Gate", value: (o) => gateOf(o, settings), cell: gateBadge },
    { key: "owner", header: "Owner" },
  ];

  const toDraft = (o: Opportunity): Draft => ({ id: o.id, version: o.version, clientId: o.clientId, prospectName: o.prospectName ?? "", contractType: o.contractType, heads: String(o.heads), revenue: (o.revenuePerHead / 1000).toFixed(3), breakEven: (o.breakEvenPerHead / 1000).toFixed(3), startDate: o.startDate, stage: o.stage, owner: o.owner, notes: o.notes ?? "" });
  const current = draft?.id ? opps.find((o) => o.id === draft.id) : undefined;
  const locked = !!current && (current.stage === "signed" || current.stage === "lost");

  const preview = useMemo(() => {
    if (!draft) return null;
    const rev = parseKD(draft.revenue), be = parseKD(draft.breakEven);
    if (!(rev > 0) || !(be > 0)) return null;
    return { rev, be, x100: multipleX100({ revenuePerHead: rev, breakEvenPerHead: be }) };
  }, [draft]);

  const validate = (d: Draft): string[] => {
    const e: string[] = [];
    if (!d.clientId && !d.prospectName.trim()) e.push("Choose a client or enter a prospect name");
    const h = Number(d.heads);
    if (!Number.isInteger(h) || h < 1) e.push("Heads must be a whole number of at least 1");
    if (!(parseKD(d.revenue) > 0)) e.push("Revenue per head must be a KD amount above 0");
    if (!(parseKD(d.breakEven) > 0)) e.push("Break-even cost per head must be a KD amount above 0");
    if (!d.startDate) e.push("Expected start date is required");
    if (!d.owner.trim()) e.push("Owner is required");
    if (d.id && current && (current.version !== d.version)) e.push("This opportunity was changed by someone else. Close and reopen it.");
    return e;
  };

  const buildOpp = (d: Draft, base?: Opportunity): Opportunity => ({
    ...(base ?? { approval: "none" as const }),
    id: d.id ?? opportunities.nextId("opp"),
    clientId: d.clientId, prospectName: d.clientId ? undefined : d.prospectName.trim(),
    contractType: d.contractType, heads: Number(d.heads), revenuePerHead: parseKD(d.revenue), breakEvenPerHead: parseKD(d.breakEven),
    startDate: d.startDate, stage: d.stage, owner: d.owner.trim(), notes: d.notes || undefined, version: (base?.version ?? 0) + 1,
  });

  const save = async () => {
    if (!draft) return;
    const e = validate(draft);
    if (draft.stage === "signed" && !locked) e.push("Use “Mark as signed” on the opportunity to sign it");
    setErrs(e);
    if (e.length) return;
    const next = buildOpp(draft, current);
    // moving the multiple back above the approval threshold clears nothing; approval remains on record
    await opportunities.save(next);
    setDraft(null);
  };

  const patch = async (o: Opportunity, p: Partial<Opportunity>) => opportunities.save({ ...o, ...p, version: o.version + 1 });

  const requestApproval = async () => {
    if (!current) return;
    await patch(current, { approval: "requested" });
    await escalations.save({ id: escalations.nextId("esc"), kind: "gate_approval", refId: current.id, date: TODAY, by: actor, note: `Written approval requested from the Group CEO at ${fmtX(multipleX100(current))} for ${nameOf(current)}` });
    setMsg("Approval request recorded for the Group CEO.");
  };
  const recordApproval = async () => {
    if (!current) return;
    if (!apprRef.trim()) { setErrs(["Enter the reference of the written approval (for example the file name)"]); return; }
    await patch(current, { approval: "approved", approvalRef: apprRef.trim(), approvalDate: TODAY });
    setApprRef(""); setErrs([]); setMsg("Written approval recorded.");
  };
  const escalateNow = async () => {
    if (!current) return;
    await escalations.save({ id: escalations.nextId("esc"), kind: "gate_low", refId: current.id, date: TODAY, by: actor, note: `${nameOf(current)} at ${fmtX(multipleX100(current))}, weekly escalation` });
    setMsg("Escalation recorded; next one is due in 7 days.");
  };

  const sign = async () => {
    if (!current || !draft) return;
    const e = validate(draft);
    const gate = gateOf(current, settings);
    if (gate !== "ok" && current.approval !== "approved") e.push(`At ${fmtX(multipleX100(current))} (below ${fmtX(settings.gateApprovalX100)}) written approval is required before this can be signed`);
    setErrs(e);
    if (e.length) return;
    // client record: create for a prospect
    let clientId = current.clientId;
    if (!clientId) {
      const nm = current.prospectName ?? "New client";
      const cl: Client = { id: `cli-${nm.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, name: nm, legalName: nm, model: current.contractType === "hourly" ? "Labour supply (hourly)" : "Labour supply", contactName: "", contactPhone: "" };
      await clients.save(cl);
      clientId = cl.id;
    }
    const abbr = (cname.get(clientId) ?? current.prospectName ?? "NEW").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase();
    const id = contracts.nextId("con");
    const to = addDays(current.startDate, 364);
    const contract: Contract = {
      id, contractNo: `CT-${abbr}-${String(cons.filter((c) => c.clientId === clientId).length + 1).padStart(2, "0")}`, version: 1, clientId, ownerCompanyId: "cmp-ithc",
      pricingModel: current.contractType, validFrom: current.startDate, validTo: to, seatsContracted: current.heads, volumeFloor: Math.ceil(current.heads * 0.9), status: "draft",
      rates: current.contractType === "hourly"
        ? [{ key: "hour", label: "Per hour", unit: "hour", amount: Math.round(current.revenuePerHead / 208) }]
        : [{ key: "monthly", label: "Monthly fee per head", unit: "head/month", amount: current.revenuePerHead }],
    };
    await contracts.save(contract);
    await seatRequirements.save({ id: seatRequirements.nextId("seat"), contractId: id, from: current.startDate, to, heads: current.heads, volumeFloor: contract.volumeFloor!, note: `From opportunity ${current.id}` });
    await opportunities.save({ ...current, stage: "signed", convertedContractId: id, version: current.version + 1 });
    setDraft(null);
    setMsg(`${nameOf(current)} signed. Draft contract ${contract.contractNo} created and handed to Finance to activate; seat requirement added.`);
  };

  const sheetOpp = current;
  const gate = sheetOpp ? gateOf(sheetOpp, settings) : "ok";
  const nextEsc = sheetOpp && lastEsc(sheetOpp) ? addDays(lastEsc(sheetOpp)!, 7) : undefined;

  const saveCfg = async () => {
    if (!cfg) return;
    const a = Math.round(Number(cfg.a) * 100), b = Math.round(Number(cfg.b) * 100);
    const e: string[] = [];
    if (!(a > 0) || !(b > 0)) e.push("Both thresholds must be above 0");
    if (b > a) e.push("The escalation threshold cannot be above the approval threshold");
    setErrs(e);
    if (e.length) return;
    await peopleSettings.save({ ...settings, gateApprovalX100: a, gateEscalateX100: b, version: settings.version + 1 });
    setCfg(null);
  };

  const signedHeads = signedNotStarted.reduce((a, o) => a + o.heads, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Commercial Pipeline" description="Opportunities in seats: N heads at X revenue per head from date D."
        actions={<>
          <Button variant="outline" onClick={() => { setErrs([]); setCfg({ a: String(settings.gateApprovalX100 / 100), b: String(settings.gateEscalateX100 / 100) }); }}>Gate thresholds</Button>
          {!readOnly && <Button onClick={() => { setErrs([]); setMsg(""); setDraft(blank(actor, settings.breakEven.fixed_labour)); }}>New opportunity</Button>}
        </>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {msg && <Notice tone="good">{msg}</Notice>}
      <KpiGrid>
        <KpiCard label="Open pipeline (heads)" value={open.reduce((a, o) => a + o.heads, 0)} hint={`${open.length} opportunities`} />
        <KpiCard label="Monthly revenue if won" value={formatKD(open.reduce((a, o) => a + o.heads * o.revenuePerHead, 0))} />
        <KpiCard label="Below approval threshold" value={flagged.length} tone={flagged.length ? "warn" : "good"} hint={`Under ${fmtX(settings.gateApprovalX100)} needs written approval`} />
        <KpiCard label="Escalated weekly" value={weekly.length} tone={weekly.length ? "bad" : "good"} hint={`Under ${fmtX(settings.gateEscalateX100)}`} />
      </KpiGrid>

      <Tabs tabs={[
        { id: "opps", label: "Opportunities", content: <DataTable rows={opps} columns={cols} onRowClick={(o) => { setErrs([]); setMsg(""); setDraft(toDraft(o)); }} exportName="pipeline" searchPlaceholder="Search opportunities…"
          filters={<span className="text-xs text-muted-foreground">Multiple = revenue per head ÷ break-even cost per head</span>} /> },
        { id: "weekly", label: `Weekly escalations (${weekly.length})`, content: (
          <Section title="Opportunities under the escalation threshold">
            <div className="space-y-2">
              {weekly.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
              {weekly.map((o) => {
                const le = lastEsc(o); const due = le ? addDays(le, 7) : TODAY; const overdue = due <= TODAY;
                return (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span><b>{nameOf(o)}</b> at {fmtX(multipleX100(o))}. Last escalated {le ? fmtDate(le) : "never"}; next due {fmtDate(due)} {overdue && <StatusBadge tone="bad">Due now</StatusBadge>}</span>
                    {!readOnly && <Button size="sm" variant="outline" onClick={async () => { await escalations.save({ id: escalations.nextId("esc"), kind: "gate_low", refId: o.id, date: TODAY, by: actor, note: `${nameOf(o)} at ${fmtX(multipleX100(o))}, weekly escalation` }); }}>Escalate now</Button>}
                  </div>
                );
              })}
            </div>
          </Section>) },
        { id: "hiring", label: "Hiring justification", content: (
          <Section title="Signed-not-started seats are the only justification for hiring ahead of deployment">
            <div className="grid gap-3 sm:grid-cols-3">
              <KpiCard label="Signed seats not yet started" value={signedHeads} />
              <KpiCard label="Bench available" value={benchCount} />
              <KpiCard label="Hiring justified" value={Math.max(0, signedHeads - benchCount)} tone={signedHeads > benchCount ? "warn" : "good"} hint="Signed seats minus bench" />
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-start text-muted-foreground"><th className="text-start">Client</th><th className="text-end">Heads</th><th className="text-start ps-4">Start</th><th className="text-start">Contract</th></tr></thead>
              <tbody>{signedNotStarted.map((o) => <tr key={o.id} className="border-t"><td>{nameOf(o)}</td><td className="text-end">{o.heads}</td><td className="ps-4">{fmtDate(o.startDate)}</td><td>{o.convertedContractId ?? "Awaiting Finance"}</td></tr>)}</tbody>
            </table>
          </Section>) },
      ]} />

      <FormSheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} wide title={draft?.id ? `Opportunity ${draft.id}` : "New opportunity"}
        description="Expressed in seats. Deliberately not a CRM." onSubmit={locked ? undefined : save} hideSubmit={locked || readOnly}>
        {draft && (
          <>
            <Errors list={errs} />
            {locked && <Notice>{current?.stage === "signed" ? `Signed${current.convertedContractId ? `; contract ${current.convertedContractId} created.` : "."}` : "Closed as lost."}</Notice>}
            <fieldset disabled={locked || readOnly} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Client">
                  <Select value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}>
                    <option value="">New prospect…</option>
                    {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                {!draft.clientId && <Field label="Prospect name"><Input value={draft.prospectName} onChange={(e) => setDraft({ ...draft, prospectName: e.target.value })} /></Field>}
                <Field label="Contract type">
                  <Select value={draft.contractType} onChange={(e) => { const t = e.target.value as Draft["contractType"]; setDraft({ ...draft, contractType: t, breakEven: draft.id ? draft.breakEven : (settings.breakEven[t] / 1000).toFixed(3) }); }}>
                    <option value="fixed_labour">Fixed labour</option><option value="hourly">Hourly</option>
                  </Select>
                </Field>
                <Field label="Heads"><Input inputMode="numeric" value={draft.heads} onChange={(e) => setDraft({ ...draft, heads: e.target.value })} /></Field>
                <Field label="Revenue per head per month (KD)"><Input inputMode="decimal" value={draft.revenue} onChange={(e) => setDraft({ ...draft, revenue: e.target.value })} /></Field>
                <Field label="Break-even cost per head (KD)" hint="Typical value for this contract type is pre-filled; edit if the deal differs"><Input inputMode="decimal" value={draft.breakEven} onChange={(e) => setDraft({ ...draft, breakEven: e.target.value })} /></Field>
                <Field label="Expected start date"><Input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></Field>
                <Field label="Stage">
                  <Select value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value as Stage })}>
                    {STAGES.filter((s) => s !== "signed" || draft.stage === "signed").map((s) => <option key={s} value={s}>{prettify(s)}</option>)}
                  </Select>
                </Field>
                <Field label="Owner"><Input value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></Field>
              </div>
              <Field label="Notes"><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
            </fieldset>

            {preview && (
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">Contract economics gate: {fmtX(preview.x100)}</div>
                <div className="text-muted-foreground">
                  {draft.heads && Number(draft.heads) > 0 ? `${draft.heads} heads × ${formatKD(preview.rev)} = ${formatKD(Number(draft.heads) * preview.rev)} per month. ` : ""}
                  {preview.x100 < settings.gateEscalateX100 ? `Below ${fmtX(settings.gateEscalateX100)}: escalated weekly and needs written approval.` : preview.x100 < settings.gateApprovalX100 ? `Below ${fmtX(settings.gateApprovalX100)}: needs written approval.` : "Passes the gate."}
                </div>
              </div>
            )}

            {sheetOpp && !readOnly && !locked && (
              <div className="space-y-3 rounded-md border p-3 text-sm">
                <h3 className="font-medium">Gate actions</h3>
                {gate === "ok" && <p className="text-muted-foreground">No approval needed at {fmtX(multipleX100(sheetOpp))}.</p>}
                {gate !== "ok" && (
                  <>
                    <p>Approval: <b>{sheetOpp.approval === "approved" ? `approved in writing (${sheetOpp.approvalRef}, ${fmtDate(sheetOpp.approvalDate)})` : prettify(sheetOpp.approval === "none" ? "not requested" : sheetOpp.approval)}</b></p>
                    <div className="flex flex-wrap gap-2">
                      {sheetOpp.approval === "none" && <Button type="button" variant="outline" size="sm" onClick={requestApproval}>Request written approval from Group CEO</Button>}
                      {sheetOpp.approval !== "approved" && (
                        <span className="flex items-center gap-2">
                          <Input className="w-56" placeholder="Approval reference / file name" value={apprRef} onChange={(e) => setApprRef(e.target.value)} />
                          <Button type="button" variant="outline" size="sm" onClick={recordApproval}>Record approval</Button>
                        </span>
                      )}
                    </div>
                  </>
                )}
                {gate === "escalate" && (
                  <div className="flex items-center gap-2">
                    <span>Weekly escalation: last {lastEsc(sheetOpp) ? fmtDate(lastEsc(sheetOpp)) : "never"}{nextEsc ? `, next due ${fmtDate(nextEsc)} (${daysBetween(TODAY, nextEsc)} days)` : ""}</span>
                    <Button type="button" variant="outline" size="sm" onClick={escalateNow}>Escalate now</Button>
                  </div>
                )}
                <div className="border-t pt-3">
                  <Button type="button" onClick={sign}>Mark as signed and hand to Finance</Button>
                  <p className="mt-1 text-xs text-muted-foreground">Creates the client contract (draft) and its seat requirement. Finance activates the contract.</p>
                </div>
              </div>
            )}
          </>
        )}
      </FormSheet>

      <FormSheet open={!!cfg} onOpenChange={(o) => !o && setCfg(null)} title="Gate thresholds" description="Configurable multiples of break-even cost per head." onSubmit={saveCfg}>
        {cfg && (
          <>
            <Errors list={errs} />
            <Field label="Written approval required below (×)"><Input inputMode="decimal" value={cfg.a} onChange={(e) => setCfg({ ...cfg, a: e.target.value })} /></Field>
            <Field label="Escalated weekly below (×)"><Input inputMode="decimal" value={cfg.b} onChange={(e) => setCfg({ ...cfg, b: e.target.value })} /></Field>
          </>
        )}
      </FormSheet>
    </div>
  );
}
