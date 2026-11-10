"use client";

import Link from "next/link";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { clients } from "@/data/core";
import { DOC_LABEL, MANAGER_ROLES, ROLE_LABEL, assignmentAudit, clientMeta, managedUsers, notifications } from "@/data/admin";
import { TODAY, daysBetween, fmtDate } from "@/lib/dates";
import { Section } from "./shared";

const LINKS = [
  ["/admin/clients", "Clients", "Add and edit customer platforms"],
  ["/admin/users", "Manager Users", "Onboard and offboard managers"],
  ["/admin/roles", "Roles & Permissions", "Permission matrix and creation rules"],
  ["/admin/company", "Company Profile", "ITHC record and letterhead"],
  ["/admin/contracts", "Contracts", "Edit with audited reason"],
  ["/admin/documents", "Documents", "Edit with audited reason"],
  ["/admin/watchlist", "Compliance Watchlist", "Full list of expiring records"],
  ["/admin/assignment-audit", "Assignment Audit Log", "Who changed what"],
  ["/admin/go-live-import", "Go-Live Data Import", "Day-one migration"],
  ["/admin/notifications", "Notifications", "In-app alerts and email outbox"],
] as const;

export default function AdminHomeScreen() {
  const users = managedUsers.useAll();
  const cls = clients.useAll();
  const metas = clientMeta.useAll();
  const alerts = notifications.useAll().filter((n) => n.recipientRole === "admin");
  const audits = assignmentAudit.useAll();
  const active = users.filter((u) => u.status === "active");
  const pw = active.filter((u) => u.mustChangePassword);
  const due = alerts.map((n) => ({ n, d: daysBetween(TODAY, n.expiresOn) })).filter((x) => x.d <= 30).sort((a, b) => a.d - b.d);
  const noRole = users.filter((u) => u.status === "active" && !MANAGER_ROLES.includes(u.role)).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Admin Overview" description="Set-up and access control." />
      <KpiGrid>
        <KpiCard label="Active users" value={active.length} />
        <KpiCard label="Clients" value={cls.length} hint={`${metas.filter((m) => !m.active).length} inactive`} />
        <KpiCard label="Users without a role" value={noRole} tone={noRole ? "bad" : "good"} />
        <KpiCard label="Expiring within 30 days" value={due.length} tone={due.length ? "warn" : "default"} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Role assignments">
          <ul className="divide-y text-sm">
            {MANAGER_ROLES.map((r) => {
              const people = active.filter((u) => u.role === r);
              return <li key={r} className="flex items-center justify-between py-1.5"><span>{ROLE_LABEL[r]}</span><span className="text-muted-foreground">{people.length ? people.map((p) => p.name).join(", ") : "Vacant"}</span></li>;
            })}
          </ul>
        </Section>
        <Section title="Temporary password not yet changed" hint="Managers who have not completed first login.">
          {pw.length === 0 ? <p className="text-sm text-muted-foreground">Everyone has set their own password.</p> : (
            <ul className="divide-y text-sm">
              {pw.map((u) => {
                const expired = !!u.tempPasswordExpires && u.tempPasswordExpires < TODAY;
                return <li key={u.id} className="flex items-center justify-between gap-2 py-1.5"><span>{u.name} <span className="text-muted-foreground">({ROLE_LABEL[u.role]})</span></span><StatusBadge tone={expired ? "bad" : "warn"}>{expired ? `Expired ${fmtDate(u.tempPasswordExpires)}` : `Expires ${fmtDate(u.tempPasswordExpires)}`}</StatusBadge></li>;
              })}
            </ul>
          )}
        </Section>
        <Section title="Expiring documents and contracts" hint="Most urgent first.">
          <ul className="divide-y text-sm">
            {due.slice(0, 6).map(({ n, d }) => (
              <li key={n.id} className="flex items-center justify-between gap-2 py-1.5"><span>{DOC_LABEL[n.docType]}: {n.recordLabel}</span><StatusBadge tone={d < 0 ? "bad" : "warn"}>{d < 0 ? `Expired ${-d}d ago` : `${d}d left`}</StatusBadge></li>
            ))}
          </ul>
          <Link href="/admin/watchlist" className="text-sm underline">Open the Compliance Watchlist ({due.length} within 30 days)</Link>
        </Section>
        <Section title="Recent assignment changes">
          <ul className="divide-y text-sm">{[...audits].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4).map((a) => <li key={a.id} className="py-1.5">{a.at.slice(0, 10)} {a.user}: {a.change}</li>)}</ul>
          <Link href="/admin/assignment-audit" className="text-sm underline">Open the assignment audit log</Link>
        </Section>
      </div>
      <Section title="Admin screens">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map(([href, t, d]) => <Link key={href} href={href} className="rounded-lg border p-3 hover:bg-muted"><p className="text-sm font-medium">{t}</p><p className="text-xs text-muted-foreground">{d}</p></Link>)}
        </div>
      </Section>
    </div>
  );
}
