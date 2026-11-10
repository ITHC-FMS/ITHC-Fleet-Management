"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { addDays, fmtDate, overlaps, TODAY } from "@/lib/dates";
import { assignments, docExpiries, workerExt } from "@/data/ops/store";
import { WorkerActionSheet, type WorkerAction } from "./WorkerActions";
import { useNames } from "./shared";

export function ExpiryActions() {
  const names = useNames();
  const ext = workerExt.useAll();
  const docs = docExpiries.useAll();
  const [act, setAct] = useState<{ id: string; a: WorkerAction } | null>(null);
  const rows = names.workers.filter((w) => !["terminated", "absconded"].includes(w.status)).map((w) => {
    const issues: string[] = [];
    const ce = ext.find((e) => e.id === w.id)?.contractEnd;
    if (ce && ce < addDays(TODAY, 30)) issues.push(ce < TODAY ? `Contract expired ${fmtDate(ce)}` : `Contract ends ${fmtDate(ce)}`);
    for (const d of docs.filter((x) => x.workerId === w.id && x.expires < addDays(TODAY, 30))) issues.push(`${d.type.replace(/_/g, " ")} ${d.expires < TODAY ? "expired" : "expires"} ${fmtDate(d.expires)}`);
    return { w, issues };
  }).filter((r) => r.issues.length);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Nothing blocks automatically. For each expiring or expired contract or document, HR chooses one action: Renew, Block or Terminate.</p>
      <div className="divide-y rounded-lg border bg-card">
        {rows.length === 0 && <p className="p-6 text-center text-muted-foreground">Nothing needs action.</p>}
        {rows.map(({ w, issues }) => (
          <div key={w.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="min-w-40 font-medium">{w.name}</span>
            <span className="min-w-64 flex-1 text-muted-foreground">{issues.join("; ")}</span>
            {w.status === "blocked" && <StatusBadge tone="bad">Blocked</StatusBadge>}
            <Button size="xs" variant="outline" onClick={() => setAct({ id: w.id, a: "renew" })}>Renew</Button>
            {w.status !== "blocked" && <Button size="xs" variant="outline" onClick={() => setAct({ id: w.id, a: "block" })}>Block</Button>}
            <Button size="xs" variant="destructive" onClick={() => setAct({ id: w.id, a: "terminate" })}>Terminate</Button>
          </div>
        ))}
      </div>
      {act && <WorkerActionSheet workerId={act.id} action={act.a} onClose={() => setAct(null)} />}
    </div>
  );
}

const Tick = ({ ok }: { ok: boolean }) => (ok ? <Check className="mx-auto size-4 text-emerald-600" /> : <X className="mx-auto size-4 text-red-600" />);

export function LeasedHiring({ onOnboard }: { onOnboard: () => void }) {
  const names = useNames();
  const asg = assignments.useAll();
  const docs = docExpiries.useAll();
  const ext = workerExt.useAll();
  const covered = new Set(asg.filter((a) => a.vehicleId && overlaps(a.from, a.to, TODAY, TODAY)).map((a) => a.vehicleId));
  const open = names.vehicles.filter((v) => v.ownership === "rented" && v.status === "in_service" && v.type !== "transport" && !covered.has(v.id));
  const hasVeh = new Set(asg.filter((a) => a.vehicleId && overlaps(a.from, a.to, TODAY, TODAY)).map((a) => a.workerId));
  const cands = names.workers.filter((w) => w.roles.includes("driver") && !hasVeh.has(w.id) && !["terminated", "absconded"].includes(w.status));
  const ok = (id: string, type: string) => !docs.some((d) => d.workerId === id && d.type === type && d.expires < TODAY);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3"><p className="text-sm text-muted-foreground">Leased vehicles with no driver today, and drivers who could take them with compliance checks.</p><Button size="sm" className="ms-auto" onClick={onOnboard}>Onboard new driver</Button></div>
      <div className="rounded-lg border bg-card p-3 text-sm">
        <b>Leased vehicles needing a driver ({open.length}):</b> {open.map((v) => `${v.plate} (${v.type}, ${v.lessor ?? "lessor n/a"})`).join(", ") || "none"}
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="px-2 py-2 text-start">Candidate</th><th className="px-2">Status</th><th className="px-2">Licence valid</th><th className="px-2">Vehicle type qualified</th><th className="px-2">Civil ID</th><th className="px-2">Visa valid</th><th className="px-2">Contract valid</th></tr></thead>
          <tbody>{cands.map((w) => (
            <tr key={w.id} className="border-t text-center">
              <td className="px-2 py-1.5 text-start font-medium">{w.name}</td><td>{w.status}</td>
              <td><Tick ok={!!w.licenceNo && ok(w.id, "licence")} /></td><td><Tick ok={!!w.vehicleTypes?.length} /></td><td><Tick ok={!!w.civilId} /></td>
              <td><Tick ok={ok(w.id, "visa")} /></td><td><Tick ok={(ext.find((e) => e.id === w.id)?.contractEnd ?? "9999") >= TODAY} /></td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
