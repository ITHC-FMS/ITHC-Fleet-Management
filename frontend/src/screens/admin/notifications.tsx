"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { Button } from "@/components/ui/button";
import { DOC_LABEL, ROLE_LABEL, TIER_DAYS, notifications, type AppNotification } from "@/data/admin";
import { TODAY, daysBetween, fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../types";
import { OutboxPanel } from "./outbox-panel";
import { Notice } from "./shared";

const SCOPE: Record<string, string> = {
  admin: "every expiring record, across workers, vehicles, buildings, stays and contracts",
  hr: "worker contracts and documents",
  fleet: "lessor contracts and vehicle documents",
  finance: "client contracts and contract documents",
  housing: "building contracts and worker stay contracts",
};

/** One shared notifications centre, registered under the five roles that receive alerts. */
export default function NotificationsScreen({ role }: ScreenProps) {
  const all = notifications.useAll();
  const mine = all.filter((n) => n.recipientRole === role).sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unread = mine.filter((n) => !n.read);
  const shown = filter === "unread" ? unread : mine;
  const expired = mine.filter((n) => daysBetween(TODAY, n.expiresOn) < 0).length;

  const setRead = (n: AppNotification, read: boolean) => notifications.save({ ...n, read });
  const markAll = () => notifications.saveMany(unread.map((n) => ({ ...n, read: true })));

  const list = (
    <div className="space-y-4">
      <KpiGrid>
        <KpiCard label="Alerts" value={mine.length} />
        <KpiCard label="Unread" value={unread.length} tone={unread.length ? "warn" : "default"} />
        <KpiCard label="Already expired" value={expired} tone={expired ? "bad" : "default"} />
        <KpiCard label="Within 30 days" value={mine.filter((n) => { const d = daysBetween(TODAY, n.expiresOn); return d >= 0 && d <= 30; }).length} />
      </KpiGrid>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "unread"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? `All (${mine.length})` : `Unread (${unread.length})`}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="ms-auto" disabled={!unread.length} onClick={markAll}>Mark all as read</Button>
      </div>
      <Notice>Alerts only inform. Renew, block, terminate or reassign manually on the module page behind each link.</Notice>
      <ul className="divide-y rounded-lg border bg-card">
        {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing here.</li>}
        {shown.map((n) => {
          const days = daysBetween(TODAY, n.expiresOn);
          const tier = TIER_DAYS[n.docType];
          return (
            <li key={n.id} className={cn("flex flex-wrap items-start gap-3 px-4 py-3", !n.read && "bg-sky-50/60 dark:bg-sky-950/30")}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-sky-500")} aria-label={n.read ? "Read" : "Unread"} />
              <div className="min-w-60 flex-1 space-y-1">
                <p className={cn("text-sm", !n.read && "font-semibold")}>
                  {DOC_LABEL[n.docType]}: {n.recordLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {days < 0 ? `Expired ${-days} day${days === -1 ? "" : "s"} ago` : days === 0 ? "Expires today" : `Expires in ${days} days`} ({fmtDate(n.expiresOn)}).
                  Alert tier: {tier} days before expiry, raised {fmtDate(n.raisedOn)}. Email sent {n.emailId ? `(${n.emailId})` : "—"}.
                </p>
              </div>
              <StatusBadge tone={days < 0 ? "bad" : days <= 30 ? "warn" : "info"}>{days < 0 ? "Expired" : days <= 30 ? "≤ 30 days" : "≤ 60 days"}</StatusBadge>
              <div className="flex gap-2">
                <Link href={n.link} onClick={() => setRead(n, true)} className="inline-flex h-7 items-center rounded-lg border px-2.5 text-[0.8rem] hover:bg-muted">Open record</Link>
                <Button size="sm" variant="ghost" onClick={() => setRead(n, !n.read)}>{n.read ? "Mark unread" : "Mark read"}</Button>
              </div>
            </li>
          );
        })}
      </ul>
      <details className="rounded-lg border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-medium">Alert timing tiers</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(TIER_DAYS).map(([k, v]) => <StatusBadge key={k}>{DOC_LABEL[k as keyof typeof DOC_LABEL]}: {v} days</StatusBadge>)}
        </div>
      </details>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" description={`${ROLE_LABEL[role] ?? role}: expiry alerts for ${SCOPE[role] ?? "your records"}.`} />
      <Tabs tabs={[
        { id: "inbox", label: `In-app alerts${unread.length ? ` (${unread.length})` : ""}`, content: list },
        { id: "email", label: "Email outbox", content: <OutboxPanel kind="alert" role={role} /> },
      ]} />
    </div>
  );
}
