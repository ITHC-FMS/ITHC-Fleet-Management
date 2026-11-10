"use client";

import { useState } from "react";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { Field, Input } from "@/components/app/fields";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { Button } from "@/components/ui/button";
import { companies } from "@/data/core";
import {
  PERM_ROLES, ROLE_LABEL, auditMany, creationRules, managedUsers, permissions, type CreationRule, type PermLevel, type PermissionRow,
} from "@/data/admin";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../types";
import { AuditTrail, CONFLICT, Notice, Section, stillCurrent, useActor, useBanner } from "./shared";

const ORDER: PermLevel[] = ["none", "view", "edit", "approve"];
const TONE: Record<PermLevel, string> = {
  none: "text-muted-foreground", view: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  edit: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", approve: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};
const SHORT: Record<PermLevel, string> = { none: "-", view: "View", edit: "Edit", approve: "Approve" };
const ASSIGNABLE = PERM_ROLES.filter((r) => r !== "ceo" && r !== "admin");

const SCOPES = [
  ["Group CEO", "Read-only everywhere; all companies"],
  ["Company Admin", "All companies; no financial data"],
  ["Managers (7)", "Resolved on employing company, contract-owning company and client, independently (set per user on Manager Users)"],
  ["Site Supervisor", "Only their own site, including trusted client contacts"],
  ["Handover Desk Staff", "Only vehicles homed at their own desk"],
  ["Worker (Driver)", "Only their own shift, vehicle and acknowledgements"],
];

export default function RolesScreen({ readOnly, editedBy }: ScreenProps) {
  const rows = permissions.useAll();
  const rules = creationRules.useAll();
  const cos = companies.useAll();
  const users = managedUsers.useAll();
  const actor = useActor();
  const banner = useBanner();
  const [editing, setEditing] = useState(false);
  const [staged, setStaged] = useState<Record<string, PermLevel>>({}); // "rowId|role" -> level
  const [rulesStaged, setRulesStaged] = useState<Record<string, string[]>>({});
  const [reason, setReason] = useState("");
  const [opened, setOpened] = useState<Record<string, number>>({});
  const [err, setErr] = useState("");

  const level = (r: PermissionRow, role: string) => staged[`${r.id}|${role}`] ?? r.levels[role];
  const cycle = (r: PermissionRow, role: string) => {
    const cur = level(r, role);
    const max = role === "ceo" ? 1 : 3; // Group CEO is read-only everywhere
    const next = ORDER[(ORDER.indexOf(cur) + 1) % (max + 1)];
    setStaged((s) => ({ ...s, [`${r.id}|${role}`]: next }));
  };
  const startEdit = () => { setEditing(true); setStaged({}); setRulesStaged({}); setReason(""); setErr(""); setOpened({ ...Object.fromEntries(rows.map((r) => [`p:${r.id}`, r.version])), ...Object.fromEntries(rules.map((r) => [`c:${r.id}`, r.version])) }); };
  const changed = Object.entries(staged).filter(([k, v]) => rows.find((r) => r.id === k.split("|")[0])?.levels[k.split("|")[1]] !== v);
  const ruleChanged = Object.keys(rulesStaged).filter((id) => { const o = rules.find((r) => r.id === id)!; const n = rulesStaged[id]; return [...o.may].sort().join() !== [...n].sort().join(); });

  const save = async () => {
    if (!changed.length && !ruleChanged.length) return setErr("No changes to save.");
    if (!reason.trim()) return setErr("A reason is required; it is written to the audit log.");
    for (const r of rows) if (changed.some(([k]) => k.startsWith(r.id + "|")) && !stillCurrent(permissions.getSync(r.id), opened[`p:${r.id}`])) return setErr(CONFLICT);
    for (const id of ruleChanged) if (!stillCurrent(creationRules.getSync(id), opened[`c:${id}`])) return setErr(CONFLICT);
    const entries: Parameters<typeof auditMany>[0] = [];
    const touched = new Map<string, PermissionRow>();
    for (const [k, v] of changed) {
      const [rid, role] = k.split("|");
      const row = touched.get(rid) ?? { ...rows.find((r) => r.id === rid)!, levels: { ...rows.find((r) => r.id === rid)!.levels } };
      entries.push({ actor, entity: "role", entityId: rid, action: "Permission changed", detail: `${row.module}, ${ROLE_LABEL[role]}: ${row.levels[role]} -> ${v}`, reason });
      row.levels[role] = v;
      touched.set(rid, row);
    }
    await permissions.saveMany([...touched.values()].map((r) => ({ ...r, version: r.version + 1 })));
    await creationRules.saveMany(ruleChanged.map((id) => {
      const o = rules.find((r) => r.id === id)!;
      entries.push({ actor, entity: "role", entityId: `create:${id}`, action: "Creation rule changed", detail: `${ROLE_LABEL[id]} may create: ${o.may.map((x) => ROLE_LABEL[x]).join(", ") || "none"} -> ${rulesStaged[id].map((x) => ROLE_LABEL[x]).join(", ") || "none"}`, reason });
      return { ...o, may: rulesStaged[id], version: o.version + 1 };
    }));
    await auditMany(entries);
    banner.ok(`${entries.length} change(s) saved and audited. No code change or deploy needed.`);
    setEditing(false);
  };

  const matrix = (
    <div className="space-y-3">
      {editing && <Notice tone="warn">Editing: click a cell to cycle none, view, edit, approve. Group CEO is capped at view.</Notice>}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-start font-medium">Module</th>{PERM_ROLES.map((r) => <th key={r} className="px-2 py-2 text-center text-xs font-medium">{ROLE_LABEL[r].replace(" / ", "/").split(" ").slice(0, 2).join(" ")}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="whitespace-nowrap px-3 py-1.5 font-medium">{r.module}</td>
                {PERM_ROLES.map((role) => {
                  const l = level(r, role);
                  const dirty = staged[`${r.id}|${role}`] !== undefined && staged[`${r.id}|${role}`] !== r.levels[role];
                  return (
                    <td key={role} className="px-1 py-1 text-center">
                      <button type="button" disabled={!editing} onClick={() => cycle(r, role)} aria-label={`${r.module}, ${ROLE_LABEL[role]}: ${l}`}
                        className={cn("min-w-14 rounded-md px-1.5 py-1 text-xs", TONE[l], dirty && "ring-2 ring-foreground", editing && "cursor-pointer")}>{SHORT[l]}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const creation = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Who may create which role. The Group CEO and Company Admin are created by the dev team and cannot be assigned.</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-start">Creator</th><th className="px-3 py-2 text-start">Route</th>{ASSIGNABLE.map((r) => <th key={r} className="px-2 py-2 text-xs font-medium">{ROLE_LABEL[r].split(" ")[0]}</th>)}</tr></thead>
          <tbody>
            {rules.map((r: CreationRule) => {
              const may = rulesStaged[r.id] ?? r.may;
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{ROLE_LABEL[r.id]}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.how}</td>
                  {ASSIGNABLE.map((role) => (
                    <td key={role} className="px-2 py-2 text-center">
                      <input type="checkbox" disabled={!editing} checked={may.includes(role)} aria-label={`${ROLE_LABEL[r.id]} may create ${ROLE_LABEL[role]}`}
                        onChange={(e) => setRulesStaged((s) => ({ ...s, [r.id]: e.target.checked ? [...may, role] : may.filter((x) => x !== role) }))} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const scoping = (
    <div className="space-y-4">
      <Section title="Company scoping" hint="Every permission is checked inside a company boundary. ITHC is the only operating company today; adding a second needs no permission change.">
        <ul className="grid gap-2 sm:grid-cols-3">
          {cos.map((c) => <li key={c.id} className="rounded-md border p-3 text-sm"><p className="font-medium">{c.name}</p><StatusBadge tone={c.kind === "operating" ? "good" : "info"}>{c.kind === "operating" ? "Operating company" : "External lessor"}</StatusBadge><p className="mt-1 text-xs text-muted-foreground">{c.kind === "operating" ? `${users.filter((u) => u.status === "active" && u.scope.employingCompanyIds.includes(c.id)).length} manager(s) with access` : "No users; supplies vehicles under contract"}</p></li>)}
        </ul>
      </Section>
      <Section title="Visibility scopes">
        <table className="w-full text-sm"><tbody>{SCOPES.map(([a, b]) => <tr key={a} className="border-t first:border-0"><td className="py-2 pe-4 font-medium">{a}</td><td className="py-2 text-muted-foreground">{b}</td></tr>)}</tbody></table>
      </Section>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Roles & Permissions" description="What each role can see and do, per module."
        actions={!readOnly && (editing ? <><Button variant="outline" onClick={() => setEditing(false)}>Discard</Button><Button onClick={save}>Save changes ({changed.length + ruleChanged.length})</Button></> : <Button onClick={startEdit}>Edit permissions</Button>)}
      />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {banner.msg && <Notice tone={banner.msg.tone}>{banner.msg.text}</Notice>}
      <KpiGrid><KpiCard label="Modules" value={rows.length} /><KpiCard label="Roles" value={PERM_ROLES.length} /><KpiCard label="Approval rights" value={rows.reduce((n, r) => n + Object.values(r.levels).filter((l) => l === "approve").length, 0)} /><KpiCard label="Pending changes" value={changed.length + ruleChanged.length} /></KpiGrid>
      {editing && (<>{err && <Notice tone="bad">{err}</Notice>}<Field label="Reason for this change (audited)"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field></>)}
      <Tabs tabs={[
        { id: "matrix", label: "Permission matrix", content: matrix },
        { id: "create", label: "Who may create which role", content: creation },
        { id: "scope", label: "Company and site scoping", content: scoping },
        { id: "audit", label: "Audit log", content: <AuditTrail entity="role" /> },
      ]} />
    </div>
  );
}
