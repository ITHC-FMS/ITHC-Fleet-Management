"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Select } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { acceptanceGates } from "@/data/admin";
import { workers } from "@/data/core";
import { formatKD } from "@/lib/money";
import { Notice, Section } from "../shared";

const STACK = [
  ["Frontend", "Next.js (this demo)"], ["Database, auth, storage", "Supabase: PostgreSQL, Auth, Storage"],
  ["Server layer", "TypeScript, for payroll, imports and exports"], ["Spec alternative", "NestJS and AWS: acceptable, not required"],
];
const FLOW = ["Platform (master of drivers, vehicles, documents)", "Monthly export: CSV or JSON", "Accounting system (one way, once a month)"];
const DOCS = ["README", "Schema", "API docs", "Architecture decision record", "Runbooks", "Operator guide"];

export default function TechnicalScreen() {
  const ws = workers.useAll();
  const gates = acceptanceGates.useAll();
  const [fmt, setFmt] = useState<"csv" | "json">("csv");
  const [month, setMonth] = useState("2026-10");

  const lines = ws.filter((w) => w.roles.includes("driver")).map((w) => ({
    driver_id: w.id, username: w.username, name: w.name, month, base_salary: formatKD(w.baseSalary, { symbol: false }), overtime_component: formatKD(w.overtimeComponent, { symbol: false }),
    gross_before_adjustments: formatKD(w.baseSalary + w.overtimeComponent, { symbol: false }),
  }));
  const download = () => {
    const body = fmt === "json" ? JSON.stringify(lines, null, 2) : [Object.keys(lines[0]).join(","), ...lines.map((l) => Object.values(l).map((v) => `"${v}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: fmt === "json" ? "application/json" : "text/csv" }));
    a.download = `accounting-export-${month}.${fmt}`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Technical & Integration" description="Stack, integration boundary and governance." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Stack"><dl className="divide-y text-sm">{STACK.map(([a, b]) => <div key={a} className="flex justify-between gap-3 py-1.5"><dt className="text-muted-foreground">{a}</dt><dd className="text-end">{b}</dd></div>)}</dl></Section>
        <Section title="Integration boundary" hint="One integration, one direction, once per month. No live synchronisation in Phase 1.">
          <ol className="space-y-2">{FLOW.map((f, i) => <li key={f} className="rounded-md border px-3 py-2 text-sm">{i + 1}. {f}</li>)}</ol>
          <p className="text-xs text-muted-foreground">Nothing writes back to the platform.</p>
        </Section>
      </div>
      <Section title="Accounting export" hint="Driver-identified, with the component breakdown. The demo carries base salary and overtime component only; the full payroll breakdown comes from the Payroll Run.">
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-36" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month"><option>2026-10</option><option>2026-09</option></Select>
          <Select className="w-28" value={fmt} onChange={(e) => setFmt(e.target.value as "csv" | "json")} aria-label="Format"><option value="csv">CSV</option><option value="json">JSON</option></Select>
          <Button onClick={download}><Download /> Export {lines.length} drivers</Button>
        </div>
        <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-muted/50"><tr>{Object.keys(lines[0] ?? {}).map((k) => <th key={k} className="px-2 py-1 text-start">{k}</th>)}</tr></thead><tbody>{lines.slice(0, 5).map((l) => <tr key={l.driver_id} className="border-t">{Object.values(l).map((v, i) => <td key={i} className="px-2 py-1">{v}</td>)}</tr>)}</tbody></table></div>
      </Section>
      <Section title="Acceptance gates" hint="Tracked by hand; the platform does not run these checks itself.">
        <Notice tone="warn">Status below is recorded by people, not measured here.</Notice>
        <ul className="divide-y">{gates.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div className="min-w-64 flex-1"><p>{g.label}</p><p className="text-xs text-muted-foreground">{g.ref}. {g.detail}</p></div>
            <Select className="w-36" value={g.status} aria-label={`Status: ${g.label}`} onChange={(e) => acceptanceGates.save({ ...g, status: e.target.value as typeof g.status, version: g.version + 1 })}>
              <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="passed">Passed</option>
            </Select>
            <StatusBadge tone={g.status === "passed" ? "good" : g.status === "in_progress" ? "warn" : "neutral"}>{g.status.replace("_", " ")}</StatusBadge>
          </li>))}</ul>
      </Section>
      <Section title="Documentation deliverables"><div className="flex flex-wrap gap-2">{DOCS.map((d) => <StatusBadge key={d}>{d}</StatusBadge>)}</div></Section>
    </div>
  );
}
