"use client";

import { AlertTriangle } from "lucide-react";
import { DataTable, type Column } from "@/components/app/data-table";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { clients, contracts } from "@/data/core";
import { contactLog, type ContactEntry } from "@/data/commercial";
import { latestVersion } from "@/data/commercial/engine";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { Notice, Section } from "./ui";

export default function ContactLogScreen() {
  const log = contactLog.useAll(), cl = clients.useAll(), ks = contracts.useAll();
  const name = (id: string) => cl.find((c) => c.id === id)?.name ?? id;
  const nos = [...new Set(ks.map((c) => c.contractNo))];
  const flags = nos.map((no) => {
    const v = latestVersion(ks, no)!;
    const last = log.filter((e) => e.contractNo === no).map((e) => e.date).sort().pop();
    return { no, client: v.clientId, last, days: last ? daysBetween(last, TODAY) : null, live: !v.validTo || v.validTo >= TODAY, started: v.validFrom <= TODAY };
  }).filter((f) => f.live && f.started && (f.days === null || f.days > 30));
  const cols: Column<ContactEntry>[] = [
    { key: "date", header: "Date", cell: (e) => fmtDate(e.date) }, { key: "client", header: "Client", value: (e) => name(e.clientId) }, { key: "contractNo", header: "Contract" },
    { key: "type", header: "Type", cell: (e) => <StatusBadge>{e.type}</StatusBadge> }, { key: "outcome", header: "Outcome" }, { key: "loggedBy", header: "Logged by" },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Client Contact Log" description="Every client contact, unfiltered. Read-only." />
      <KpiGrid>
        <KpiCard label="Contacts logged" value={log.length} />
        <KpiCard label="Contracts with no contact in 30 days" value={flags.length} tone={flags.length ? "bad" : "good"} />
        <KpiCard label="Contacts in last 30 days" value={log.filter((e) => daysBetween(e.date, TODAY) <= 30).length} />
        <KpiCard label="Contracts tracked" value={nos.length} />
      </KpiGrid>
      {flags.length > 0 && (
        <Notice tone="bad">
          <Section title="Flagged: no logged contact in 30 days">
            <ul className="space-y-1">{flags.map((f) => <li key={f.no}><AlertTriangle className="me-1 inline size-4" />{f.no} ({name(f.client)}): {f.last ? `last contact ${fmtDate(f.last)}, ${f.days} days ago` : "no contact ever logged"}</li>)}</ul>
          </Section>
        </Notice>
      )}
      <DataTable rows={[...log].sort((a, b) => (a.date < b.date ? 1 : -1))} columns={cols} exportName="client-contact-log" />
    </div>
  );
}
