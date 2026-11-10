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
import { clients, contracts } from "@/data/core";
import { contactLog, useSettings, type ContactEntry } from "@/data/people";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { Errors, useActor } from "../common";

interface Draft { date: string; contractId: string; type: ContactEntry["type"]; contactPerson: string; outcome: string }
interface CRow { id: string; contractId: string; contractNo: string; client: string; last?: string; days: number | null; state: "ok" | "nearing" | "breach" | "none" }

export default function ContactLog({ readOnly, editedBy }: ScreenProps) {
  const actor = useActor();
  const log = contactLog.useAll();
  const cons = contracts.useAll();
  const clientList = clients.useAll();
  const settings = useSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [contractF, setContractF] = useState("all");

  const cname = (id: string) => clientList.find((c) => c.id === id)?.name ?? id;
  const live = useMemo(() => cons.filter((c) => c.status === "active"), [cons]);
  const status: CRow[] = useMemo(() => live.map((c) => {
    const last = log.filter((l) => l.contractId === c.id).map((l) => l.date).sort().pop();
    const days = last ? daysBetween(last, TODAY) : null;
    const state = days === null ? "none" : days > settings.contactLimitDays ? "breach" : days >= settings.contactWarnDays ? "nearing" : "ok";
    return { id: c.id, contractId: c.id, contractNo: c.contractNo, client: cname(c.clientId), last, days, state };
  }), [live, log, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const flagged = status.filter((s) => s.state === "breach" || s.state === "none");
  const nearing = status.filter((s) => s.state === "nearing");

  const badge = (s: CRow) => s.state === "breach" ? <StatusBadge tone="bad">Flagged to principal</StatusBadge> : s.state === "none" ? <StatusBadge tone="bad">No contact logged</StatusBadge> : s.state === "nearing" ? <StatusBadge tone="warn">Nearing {settings.contactLimitDays}-day limit</StatusBadge> : <StatusBadge tone="good">OK</StatusBadge>;

  const statusCols: Column<CRow>[] = [
    { key: "contractNo", header: "Contract" }, { key: "client", header: "Client" },
    { key: "last", header: "Last contact", value: (s) => s.last, cell: (s) => fmtDate(s.last) },
    { key: "days", header: "Days since", align: "end", value: (s) => s.days ?? 9999, cell: (s) => (s.days === null ? "—" : s.days) },
    { key: "left", header: "Days until breach", align: "end", value: (s) => (s.days === null ? -1 : settings.contactLimitDays - s.days), cell: (s) => (s.days === null ? "—" : settings.contactLimitDays - s.days) },
    { key: "state", header: "Flag", value: (s) => s.state, cell: badge },
  ];

  const logRows = log.filter((l) => contractF === "all" || l.contractId === contractF).sort((a, b) => b.date.localeCompare(a.date));
  const cols: Column<ContactEntry>[] = [
    { key: "date", header: "Date", cell: (l) => fmtDate(l.date) },
    { key: "client", header: "Client", value: (l) => cname(l.clientId) },
    { key: "contract", header: "Contract", value: (l) => cons.find((c) => c.id === l.contractId)?.contractNo ?? l.contractId },
    { key: "type", header: "Type", cell: (l) => prettify(l.type) },
    { key: "contactPerson", header: "Contact" },
    { key: "outcome", header: "Outcome", className: "max-w-md" },
    { key: "loggedBy", header: "Logged by" },
  ];

  const save = async () => {
    if (!draft) return;
    const e: string[] = [];
    const c = cons.find((x) => x.id === draft.contractId);
    if (!c) e.push("Choose a contract");
    if (!draft.date) e.push("Date is required");
    else if (draft.date > TODAY) e.push("A contact cannot be dated in the future");
    if (!draft.contactPerson.trim()) e.push("Who did you speak to?");
    if (!draft.outcome.trim()) e.push("Outcome is required");
    setErrs(e);
    if (e.length || !c) return;
    await contactLog.save({ id: contactLog.nextId("cl"), date: draft.date, clientId: c.clientId, contractId: c.id, type: draft.type, contactPerson: draft.contactPerson.trim(), outcome: draft.outcome.trim(), loggedBy: actor });
    setDraft(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Client Contact Log" description="A dated record of every visit, call or meeting, with outcome." actions={!readOnly && <Button onClick={() => { setErrs([]); setDraft({ date: TODAY, contractId: flagged[0]?.contractId ?? live[0]?.id ?? "", type: "visit", contactPerson: "", outcome: "" }); }}>Log contact</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Live contracts" value={live.length} />
        <KpiCard label={`No contact in ${settings.contactLimitDays}+ days`} value={flagged.length} tone={flagged.length ? "bad" : "good"} hint="Flagged to the principal" />
        <KpiCard label="Nearing the limit" value={nearing.length} tone={nearing.length ? "warn" : "good"} hint={`${settings.contactWarnDays}+ days since contact`} />
        <KpiCard label="Entries logged" value={log.length} />
      </KpiGrid>
      <Tabs tabs={[
        { id: "status", label: "By contract", content: <DataTable rows={status} columns={statusCols} exportName="contact-status" rowClassName={(s) => (s.state === "breach" || s.state === "none" ? "bg-red-50/60 dark:bg-red-950/30" : undefined)} onRowClick={(s) => { setContractF(s.contractId); }} /> },
        { id: "log", label: "Log", content: <DataTable rows={logRows} columns={cols} exportName="client-contact-log" searchPlaceholder="Search the log…" filters={<Select className="w-48" value={contractF} onChange={(e) => setContractF(e.target.value)}><option value="all">All contracts</option>{cons.filter((c) => c.status !== "superseded").map((c) => <option key={c.id} value={c.id}>{c.contractNo}</option>)}</Select>} /> },
      ]} />

      <FormSheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title="Log contact" onSubmit={save}>
        {draft && (
          <>
            <Errors list={errs} />
            <Field label="Contract"><Select value={draft.contractId} onChange={(e) => setDraft({ ...draft, contractId: e.target.value })}>{cons.filter((c) => c.status !== "superseded" && c.status !== "expired").map((c) => <option key={c.id} value={c.id}>{c.contractNo}, {cname(c.clientId)}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><Input type="date" max={TODAY} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Field>
              <Field label="Type"><Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ContactEntry["type"] })}><option value="visit">Visit</option><option value="call">Call</option><option value="meeting">Meeting</option><option value="email">Email</option></Select></Field>
            </div>
            <Field label="Spoke to"><Input value={draft.contactPerson} onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })} /></Field>
            <Field label="Outcome"><Textarea value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })} /></Field>
          </>
        )}
      </FormSheet>
    </div>
  );
}
