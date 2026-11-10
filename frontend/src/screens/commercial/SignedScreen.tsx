"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, toneFor } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { clients } from "@/data/core";
import { approvals, fmtMultiple, multipleOf, signedOpps, writeAudit, type SignedOpportunity } from "@/data/commercial";
import { MODEL_LABEL } from "@/data/commercial/engine";
import { fmtDate, TODAY } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import { useThresholds } from "./ApprovalsScreen";
import { NewContractSheet } from "./ContractForms";
import { useMarginModel } from "./model";
import { Notice, useActor } from "./ui";

export default function SignedScreen({ role }: { role: string }) {
  const rows = signedOpps.useAll(), apr = approvals.useAll(), cl = clients.useAll();
  const th = useThresholds();
  const [convert, setConvert] = useState<string | null>(null);
  const [request, setRequest] = useState<SignedOpportunity | null>(null);
  const aprOf = (s: SignedOpportunity) => apr.find((a) => a.id === s.approvalId);
  const blocked = (s: SignedOpportunity) => { const a = aprOf(s); return !!a && a.status !== "approved"; };
  const cols: Column<SignedOpportunity>[] = [
    { key: "name", header: "Opportunity" }, { key: "client", header: "Client", value: (s) => cl.find((c) => c.id === s.clientId)?.name },
    { key: "type", header: "Contract type", value: (s) => MODEL_LABEL[s.pricingModel as keyof typeof MODEL_LABEL] ?? s.pricingModel },
    { key: "heads", header: "Heads", align: "end" },
    { key: "rev", header: "Revenue/head (KD)", align: "end", value: (s) => s.revenuePerHead, cell: (s) => formatKD(s.revenuePerHead, { symbol: false }) },
    { key: "start", header: "Start", cell: (s) => fmtDate(s.startDate) },
    { key: "ceo", header: "CEO approval", value: (s) => aprOf(s)?.status ?? "not assessed", cell: (s) => { const a = aprOf(s); return a ? <StatusBadge tone={toneFor(a.status)}>{a.status} · {fmtMultiple(multipleOf(a.revenuePerHead, a.breakEvenPerHead))}</StatusBadge> : <span className="text-muted-foreground">Gate not assessed</span>; } },
    { key: "act", header: "Action", sortable: false, value: (s) => s.status, cell: (s) => s.status === "converted" ? <StatusBadge tone="good">contract {s.contractNo}</StatusBadge> : (
      <span className="flex gap-1">
        <Button size="sm" disabled={blocked(s)} title={blocked(s) ? "Waiting for CEO approval" : undefined} onClick={(e) => { e.stopPropagation(); setConvert(s.id); }}>Create contract</Button>
        {!s.approvalId && <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setRequest(s); }}>Check gate</Button>}
      </span>) },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Signed Opportunities" description="Opportunities marked as signed by Client & Deployment, waiting to become a client contract." />
      <Notice>Contracts below {fmtMultiple(th.approvalMultiple)} revenue-to-break-even stay blocked until the Group CEO approves them.</Notice>
      <DataTable rows={rows} columns={cols} exportName="signed-opportunities" />
      {convert && <NewContractSheet open onClose={() => setConvert(null)} role={role} initialSig={convert} />}
      {request && <GateSheet opp={request} role={role} onClose={() => setRequest(null)} />}
    </div>
  );
}

function GateSheet({ opp, role, onClose }: { opp: SignedOpportunity; role: string; onClose: () => void }) {
  const actor = useActor();
  const th = useThresholds();
  const m = useMarginModel("2026-10");
  const placed = m.workers.filter((w) => w.clientId);
  const est = placed.length ? Math.round(placed.reduce((a, w) => a + w.cost + w.housing + w.transport, 0) / placed.length) : 200_000;
  const [be, setBe] = useState((est / 1000).toFixed(3));
  const [why, setWhy] = useState("");
  const [err, setErr] = useState("");
  const beF = parseKD(be);
  const mult = Number.isFinite(beF) && beF > 0 ? multipleOf(opp.revenuePerHead, beF) : 0;
  const needs = mult > 0 && mult < th.approvalMultiple;
  const submit = async () => {
    if (!(beF > 0)) return setErr("Enter the break-even cost per head in KD.");
    if (!needs) return onClose();
    if (!why.trim()) return setErr("Explain why the contract should be accepted below the gate.");
    const id = approvals.nextId("apr");
    await approvals.save({ id, opportunity: opp.name, clientId: opp.clientId, pricingModel: opp.pricingModel, heads: opp.heads, revenuePerHead: opp.revenuePerHead, breakEvenPerHead: beF, requestedBy: actor.name, requestedRole: role === "finance" ? "Finance / Commercial" : "Client & Deployment", requestedAt: TODAY, status: "pending", reason: undefined });
    await signedOpps.save({ ...opp, approvalId: id });
    await writeAudit({ user: actor.name, role, entityType: "approval", entityId: id, entityLabel: opp.name, action: "create", summary: `CEO approval requested at ${fmtMultiple(mult)}`, reason: why.trim() });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Economics gate check" description={opp.name} onSubmit={submit} submitLabel={needs ? "Request CEO approval" : "Close"}>
      {err && <Notice tone="bad">{err}</Notice>}
      <Field label="Break-even cost per head (KD)" hint={`Suggested from the current average cost per placed head: ${formatKD(est)}`}><Input inputMode="decimal" value={be} onChange={(e) => setBe(e.target.value)} /></Field>
      <p className="text-sm">Revenue per head {formatKD(opp.revenuePerHead)} = <b>{fmtMultiple(mult)}</b> of break-even (gate {fmtMultiple(th.approvalMultiple)}).</p>
      {mult > 0 && !needs && <Notice>Above the gate: no CEO approval is required.</Notice>}
      {needs && <Field label="Why accept below the gate"><Textarea value={why} onChange={(e) => setWhy(e.target.value)} /></Field>}
    </FormSheet>
  );
}
