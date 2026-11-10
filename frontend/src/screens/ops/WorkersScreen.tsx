"use client";

import { useState } from "react";
import { MessageCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { Select } from "@/components/app/fields";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, toneFor, prettify } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { companies } from "@/data/core";
import type { Worker } from "@/data/entities";
import { STATUS_KEYS, STATUS_LABEL } from "@/data/ops/statuses";
import { assignments, workerExt } from "@/data/ops/store";
import { waLink } from "@/data/ops/worker-ops";
import { overlaps, TODAY } from "@/lib/dates";
import type { ScreenProps } from "../types";
import { WorkerDetail } from "./WorkerDetail";
import { ExpiryActions, LeasedHiring } from "./WorkerExpiry";
import { WorkerWizard } from "./WorkerWizard";
import { useNames } from "./shared";

export default function WorkersScreen({ readOnly, editedBy, role }: ScreenProps) {
  const names = useNames();
  const cos = companies.useAll();
  const asg = assignments.useAll();
  const ext = workerExt.useAll();
  const [sel, setSel] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [roleF, setRoleF] = useState(""), [statusF, setStatusF] = useState(""), [clientF, setClientF] = useState("");

  const current = (w: Worker) => asg.find((a) => a.workerId === w.id && a.kind === "regular" && overlaps(a.from, a.to, TODAY, TODAY));
  const rows = names.workers.filter((w) => (!roleF || w.roles.includes(roleF as never)) && (!statusF || w.status === statusF) && (!clientF || current(w)?.clientId === clientF));
  const cols: Column<Worker>[] = [
    { key: "name", header: "Name", cell: (w) => <span className="font-medium">{w.name}</span> },
    { key: "roles", header: "Roles", value: (w) => w.roles.join(", ") },
    { key: "co", header: "Employing company", value: (w) => cos.find((c) => c.id === w.employingCompany)?.name },
    { key: "owner", header: "Contract-owning", value: (w) => cos.find((c) => c.id === ext.find((e) => e.id === w.id)?.contractOwnerCompanyId)?.name },
    { key: "status", header: "Current status", cell: (w) => <StatusBadge tone={toneFor(w.status)}>{prettify(w.status)}</StatusBadge> },
    { key: "client", header: "Client / placement", value: (w) => { const a = current(w); return a ? `${names.client(a.clientId)}${a.place ? ` · ${a.place}` : ""}` : "Bench / none"; } },
    { key: "phone", header: "Phone", cell: (w) => <a href={waLink(w.phone)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-emerald-700 hover:underline"><MessageCircle className="size-3.5" />{w.phone}</a> },
    { key: "civil", header: "Civil ID", value: (w) => w.civilId ?? "", cell: (w) => (w.civilId ? "On file" : <StatusBadge tone="warn">Pending</StatusBadge>) },
    { key: "version", header: "Ver.", align: "end", value: (w) => w.version },
  ];

  const register = (
    <DataTable rows={rows} columns={cols} exportName="workers" onRowClick={(w) => setSel(w.id)} searchPlaceholder="Search name, username, rider ID…" pageSize={20}
      filters={<>
        <Select value={roleF} onChange={(e) => setRoleF(e.target.value)} className="w-32"><option value="">All roles</option>{["driver", "picker", "warehouse", "security", "barista", "handover", "service", "admin"].map((r) => <option key={r}>{r}</option>)}</Select>
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="w-40"><option value="">All statuses</option>{STATUS_KEYS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</Select>
        <Select value={clientF} onChange={(e) => setClientF(e.target.value)} className="w-40"><option value="">All clients</option>{names.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      </>} />
  );

  return (
    <div className="space-y-5">
      <PageHeader title={readOnly ? "Workers" : "Workers"} description="One record per person, whatever the role. A worker with no orders and no vehicle is valid." actions={!readOnly && <Button onClick={() => setWizard(true)}><UserPlus /> Onboard worker</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {readOnly ? register : (
        <Tabs tabs={[
          { id: "r", label: "Register", content: register },
          ...(role === "hr" ? [{ id: "e", label: "Expiry actions", content: <ExpiryActions /> }, { id: "h", label: "Leased-vehicle hiring", content: <LeasedHiring onOnboard={() => setWizard(true)} /> }] : []),
        ]} />
      )}
      {sel && <WorkerDetail key={sel} workerId={sel} editable={!readOnly} onClose={() => setSel(null)} />}
      {wizard && !readOnly && <WorkerWizard onClose={() => setWizard(false)} />}
    </div>
  );
}
