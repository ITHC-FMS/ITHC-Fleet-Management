"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { peopleSettings, TIER_ROWS, useSettings } from "@/data/people";
import type { AlertItem } from "@/data/people/calc";
import { useAlerts } from "@/data/people/hooks";
import { fmtDate } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { DaysBadge, Errors, Notice } from "./common";

type Row = AlertItem & { id: string };
const KIND_LABEL: Record<AlertItem["ownerKind"], string> = { worker: "Worker", vehicle: "Vehicle", contract: "Client contract", property: "Property", stay: "Stay contract", lease: "Building contract" };

/** Roles see their own items; admin and CEO see everything. */
const scopeFor = (role: string): AlertItem["ownerKind"][] | null =>
  role === "hr" ? ["worker"] : role === "housing" ? ["property", "stay", "lease"] : role === "finance" ? ["contract"] : role === "fleet" ? ["vehicle"] : null;

export default function Watchlist({ role, readOnly, editedBy }: ScreenProps) {
  const all = useAlerts();
  const settings = useSettings();
  const scope = scopeFor(role);
  const items = useMemo<Row[]>(() => all.filter((a) => !scope || scope.includes(a.ownerKind)).map((a) => ({ ...a, id: a.key })), [all, scope]);
  const [kind, setKind] = useState<"all" | "expired" | "30" | "60" | "missing">("all");
  const [owner, setOwner] = useState("all");
  const [cfg, setCfg] = useState<Record<string, string> | null>(null);
  const [errs, setErrs] = useState<string[]>([]);

  const expired = items.filter((i) => i.kind === "expired").length;
  const d30 = items.filter((i) => i.kind === "expiring" && i.daysLeft! <= 30).length;
  const d60 = items.filter((i) => i.kind === "expiring" && i.daysLeft! > 30 && i.daysLeft! <= 60).length;
  const later = items.filter((i) => i.kind === "expiring" && i.daysLeft! > 60).length;
  const missing = items.filter((i) => i.kind === "missing").length;

  const shown = items.filter((i) => {
    if (owner !== "all" && i.ownerKind !== owner) return false;
    if (kind === "expired") return i.kind === "expired";
    if (kind === "30") return i.kind === "expiring" && i.daysLeft! <= 30;
    if (kind === "60") return i.kind === "expiring" && i.daysLeft! > 30;
    if (kind === "missing") return i.kind === "missing";
    return true;
  });

  const cols: Column<Row>[] = [
    { key: "owner", header: "Owner", value: (i) => i.ownerLabel, cell: (i) => <div><div className="font-medium">{i.ownerLabel}</div><div className="text-xs text-muted-foreground">{KIND_LABEL[i.ownerKind]}</div></div> },
    { key: "type", header: "Document", value: (i) => i.typeLabel },
    { key: "expiry", header: "Expires", value: (i) => i.expiry, cell: (i) => (i.kind === "missing" ? "—" : fmtDate(i.expiry)) },
    { key: "left", header: "Days left", value: (i) => i.daysLeft ?? 99999, cell: (i) => (i.kind === "missing" ? <StatusBadge tone="bad">Missing entirely</StatusBadge> : <DaysBadge days={i.daysLeft} />) },
    { key: "tier", header: "Tier", value: (i) => i.tierDays, cell: (i) => `${i.tierDays}-day` },
    { key: "dept", header: "Notify", value: (i) => i.dept },
    { key: "act", header: "Action", sortable: false, cell: (i) => <Link href={i.link.href} className="text-xs underline" onClick={(e) => e.stopPropagation()}>{i.link.label}</Link> },
  ];

  const canConfig = !readOnly && (role === "admin" || role === "hr" || role === "ceo");
  const rowsToConfig = TIER_ROWS.filter((r) => !scope || (scope.includes("worker") ? r.label.startsWith("Worker") : scope.includes("property") ? /Property|Stay/.test(r.label) : true));

  const saveCfg = async () => {
    if (!cfg) return;
    const e: string[] = [];
    const tiers = { ...settings.tiers };
    for (const r of rowsToConfig) {
      const n = Number(cfg[r.key]);
      if (!Number.isInteger(n) || n < 1 || n > 365) e.push(`${r.label}: enter whole days between 1 and 365`);
      else tiers[r.key] = n;
    }
    setErrs(e);
    if (e.length) return;
    await peopleSettings.save({ ...settings, tiers, version: settings.version + 1 });
    setCfg(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Compliance Watchlist" description="Whose documents expire in the next 30 and 60 days, and what is missing entirely."
        actions={canConfig && <Button variant="outline" onClick={() => { setErrs([]); setCfg(Object.fromEntries(rowsToConfig.map((r) => [r.key, String(settings.tiers[r.key] ?? 30)]))); }}>Configure tiers</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {scope && <Notice>Showing items you own. Other owners see theirs; Admin sees the full watchlist.</Notice>}
      <KpiGrid>
        <KpiCard label="Expired" value={expired} tone={expired ? "bad" : "good"} />
        <KpiCard label="Expiring ≤30 days" value={d30} tone={d30 ? "warn" : "good"} />
        <KpiCard label="Expiring 31–60 days" value={d60} hint={later ? `${later} more on longer tiers` : undefined} />
        <KpiCard label="Missing" value={missing} tone={missing ? "bad" : "good"} />
      </KpiGrid>
      <DataTable rows={shown} columns={cols} exportName="compliance-watchlist" searchPlaceholder="Search owner or document…" pageSize={30}
        filters={<>
          <Select className="w-44" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">Everything</option><option value="expired">Expired</option><option value="30">Within 30 days</option><option value="60">31 to 60 days (and longer tiers)</option><option value="missing">Missing entirely</option>
          </Select>
          {(!scope || scope.length > 1) && (
            <Select className="w-44" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="all">All owners</option>
              {(scope ?? (Object.keys(KIND_LABEL) as AlertItem["ownerKind"][])).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
          )}
        </>} />
      <p className="text-xs text-muted-foreground">Alerts are derived from current documents, contracts, building contracts and stays each time this page opens; nothing is stored.</p>

      <FormSheet open={!!cfg} onOpenChange={(o) => !o && setCfg(null)} title="Expiry alert tiers" description="Alert lead time in days before expiry, per document type." onSubmit={saveCfg}>
        {cfg && (
          <>
            <Errors list={errs} />
            {rowsToConfig.map((r) => (
              <Field key={r.key} label={r.label}><Input inputMode="numeric" value={cfg[r.key]} onChange={(e) => setCfg({ ...cfg, [r.key]: e.target.value })} /></Field>
            ))}
          </>
        )}
      </FormSheet>
    </div>
  );
}
