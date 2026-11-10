"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, toneFor } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { clients } from "@/data/core";
import { approvals, fmtMultiple, multipleOf, thresholds, writeAudit, type ContractApproval } from "@/data/commercial";
import { MODEL_LABEL } from "@/data/commercial/engine";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import { Notice, Section, useActor } from "./ui";

export const useThresholds = () => thresholds.useAll()[0] ?? { id: "thresholds" as const, approvalMultiple: 200, escalateMultiple: 160 };

export default function ApprovalsScreen({ role }: { role: string }) {
  const rows = approvals.useAll(), cl = clients.useAll();
  const th = useThresholds();
  const [sel, setSel] = useState<ContractApproval | null>(null);
  const [edit, setEdit] = useState(false);
  const mult = (a: ContractApproval) => multipleOf(a.revenuePerHead, a.breakEvenPerHead);
  const escalated = (a: ContractApproval) => a.status === "pending" && mult(a) < th.escalateMultiple;
  const cols: Column<ContractApproval>[] = [
    { key: "opportunity", header: "Opportunity" }, { key: "client", header: "Client", value: (a) => cl.find((c) => c.id === a.clientId)?.name },
    { key: "rev", header: "Revenue/head (KD)", align: "end", value: (a) => a.revenuePerHead, cell: (a) => formatKD(a.revenuePerHead, { symbol: false }) },
    { key: "be", header: "Break-even (KD)", align: "end", value: (a) => a.breakEvenPerHead, cell: (a) => formatKD(a.breakEvenPerHead, { symbol: false }) },
    { key: "mult", header: "Multiple", align: "end", value: mult, cell: (a) => <StatusBadge tone={mult(a) < th.escalateMultiple ? "bad" : mult(a) < th.approvalMultiple ? "warn" : "good"}>{fmtMultiple(mult(a))}</StatusBadge> },
    { key: "by", header: "Requested by", value: (a) => `${a.requestedBy} (${a.requestedRole})` },
    { key: "age", header: "Waiting", align: "end", value: (a) => daysBetween(a.requestedAt, TODAY), cell: (a) => (a.status === "pending" ? `${daysBetween(a.requestedAt, TODAY)} d${escalated(a) && daysBetween(a.requestedAt, TODAY) >= 7 ? " (escalated weekly)" : ""}` : "-") },
    { key: "status", header: "Decision", cell: (a) => <StatusBadge tone={toneFor(a.status)}>{a.status}</StatusBadge> },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Contract Approvals" description="Written approval for opportunities below the economics gate. The Group CEO approves or declines."
        actions={<Button variant="outline" onClick={() => setEdit(true)}>Thresholds: {fmtMultiple(th.approvalMultiple)} / {fmtMultiple(th.escalateMultiple)}</Button>} />
      <KpiGrid>
        <KpiCard label="Waiting for decision" value={rows.filter((a) => a.status === "pending").length} tone="warn" />
        <KpiCard label={`Below ${fmtMultiple(th.escalateMultiple)} (escalated weekly)`} value={rows.filter(escalated).length} tone="bad" />
        <KpiCard label="Approved" value={rows.filter((a) => a.status === "approved").length} tone="good" />
        <KpiCard label="Declined" value={rows.filter((a) => a.status === "declined").length} />
      </KpiGrid>
      <DataTable rows={rows} columns={cols} exportName="contract-approvals" onRowClick={setSel} rowClassName={(a) => (escalated(a) ? "bg-red-50/60 dark:bg-red-950/20" : undefined)} />
      {sel && <DecisionSheet key={sel.id} row={sel} role={role} onClose={() => setSel(null)} />}
      {edit && <ThresholdSheet role={role} onClose={() => setEdit(false)} />}
    </div>
  );
}

function DecisionSheet({ row, role, onClose }: { row: ApprovalRow; role: string; onClose: () => void }) {
  const actor = useActor();
  const th = useThresholds();
  const cl = clients.useAll();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const m = multipleOf(row.revenuePerHead, row.breakEvenPerHead);
  const decide = async (status: "approved" | "declined") => {
    const live = approvals.getSync(row.id);
    if (!live || live.status !== "pending") return setErr("Conflict: this request was already decided. Close and reopen.");
    if (reason.trim().length < 5) return setErr("A written reason is required.");
    await approvals.save({ ...live, status, decidedBy: actor.name, decidedAt: TODAY, reason: reason.trim() });
    await writeAudit({ user: actor.name, role, entityType: "approval", entityId: row.id, entityLabel: row.opportunity, action: status === "approved" ? "approve" : "decline", summary: `Opportunity ${status} at ${fmtMultiple(m)} (gate ${fmtMultiple(th.approvalMultiple)})`, reason: reason.trim(), before: "pending", after: status });
    onClose();
  };
  const pending = row.status === "pending";
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={row.opportunity} description={`${cl.find((c) => c.id === row.clientId)?.name}, ${MODEL_LABEL[row.pricingModel as keyof typeof MODEL_LABEL] ?? row.pricingModel}, ${row.heads} heads`} hideSubmit>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Revenue / head</div><b>{formatKD(row.revenuePerHead)}</b></div>
        <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Break-even / head</div><b>{formatKD(row.breakEvenPerHead)}</b></div>
        <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Multiple</div><b className={m < th.escalateMultiple ? "text-red-600" : ""}>{fmtMultiple(m)}</b></div>
      </div>
      <p className="text-sm text-muted-foreground">Requested by {row.requestedBy} ({row.requestedRole}) on {fmtDate(row.requestedAt)}. Monthly revenue at {row.heads} heads: {formatKD(row.revenuePerHead * row.heads)}; break-even {formatKD(row.breakEvenPerHead * row.heads)}.</p>
      {m < th.approvalMultiple && <Notice tone={m < th.escalateMultiple ? "bad" : "warn"}>Below {fmtMultiple(th.approvalMultiple)}: written approval required{m < th.escalateMultiple ? `; below ${fmtMultiple(th.escalateMultiple)} so it is escalated weekly` : ""}.</Notice>}
      {!pending && <Notice tone={row.status === "approved" ? "info" : "bad"}>{row.status} by {row.decidedBy} on {fmtDate(row.decidedAt)}: {row.reason}</Notice>}
      {pending && (
        <Section title="Decision">
          {err && <Notice tone="bad">{err}</Notice>}
          <Field label="Written reason (recorded in the audit log)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="flex gap-2"><Button type="button" onClick={() => decide("approved")}>Approve</Button><Button type="button" variant="destructive" onClick={() => decide("declined")}>Decline</Button></div>
        </Section>
      )}
    </FormSheet>
  );
}
type ApprovalRow = ContractApproval;

function ThresholdSheet({ role, onClose }: { role: string; onClose: () => void }) {
  const actor = useActor();
  const th = useThresholds();
  const [a, setA] = useState((th.approvalMultiple / 100).toFixed(2));
  const [e, setE] = useState((th.escalateMultiple / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const submit = async () => {
    const ap = Math.round(Number(a) * 100), es = Math.round(Number(e) * 100);
    if (!Number.isFinite(ap) || !Number.isFinite(es) || ap <= 0 || es <= 0) return setErr("Enter valid multiples such as 2.00.");
    if (es > ap) return setErr("The escalation threshold cannot be above the approval threshold.");
    if (!reason.trim()) return setErr("A reason is required.");
    await thresholds.save({ id: "thresholds", approvalMultiple: ap, escalateMultiple: es });
    await writeAudit({ user: actor.name, role, entityType: "settings", entityId: "thresholds", entityLabel: "Approval thresholds", action: "update", summary: "Economics gate thresholds changed", reason: reason.trim(), before: `${fmtMultiple(th.approvalMultiple)} / ${fmtMultiple(th.escalateMultiple)}`, after: `${fmtMultiple(ap)} / ${fmtMultiple(es)}` });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Approval thresholds" description="Revenue per head as a multiple of break-even cost per head." onSubmit={submit}>
      {err && <Notice tone="bad">{err}</Notice>}
      <Field label="Written approval required below (x)"><Input inputMode="decimal" value={a} onChange={(x) => setA(x.target.value)} /></Field>
      <Field label="Escalated weekly below (x)"><Input inputMode="decimal" value={e} onChange={(x) => setE(x.target.value)} /></Field>
      <Field label="Reason"><Textarea value={reason} onChange={(x) => setReason(x.target.value)} /></Field>
    </FormSheet>
  );
}
