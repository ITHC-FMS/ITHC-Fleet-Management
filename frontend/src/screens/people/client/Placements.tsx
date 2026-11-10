"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { clients, contracts, locations, workers, type WorkerRole } from "@/data/core";
import { placements, type Placement } from "@/data/people";
import { isLabour, placementActive } from "@/data/people/calc";
import { fmtDate, overlaps, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { Errors, Notice } from "../common";

/** Role decides which modules apply to a placed worker. */
const MODULES: Record<WorkerRole, string> = {
  picker: "Placement, attendance, monthly summary",
  warehouse: "Placement, attendance, monthly summary",
  security: "Placement, attendance (shift roster), monthly summary",
  barista: "Placement, attendance (hourly), monthly summary",
  driver: "Assignments, vehicles, handover, payroll bonuses",
  handover: "Handover desk",
  service: "Fleet service jobs",
  admin: "Back office",
};

interface Draft { id?: string; version?: number; workerId: string; contractId: string; siteId: string; from: string; to: string }
type Row = Placement & { wName: string; roles: string; client: string; contractNo: string; site: string; active: boolean };

export default function Placements({ readOnly, editedBy }: ScreenProps) {
  const plc = placements.useAll();
  const ws = workers.useAll();
  const cons = contracts.useAll();
  const clientList = clients.useAll();
  const locs = locations.useAll();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [show, setShow] = useState<"active" | "ended" | "all">("active");

  const labourContracts = cons.filter((c) => c.status === "active" && isLabour(c));
  const sites = locs.filter((l) => l.kind === "client_site");

  const rows: Row[] = useMemo(() => plc.map((p) => {
    const w = ws.find((x) => x.id === p.workerId);
    const c = cons.find((x) => x.id === p.contractId);
    return { ...p, wName: w?.name ?? p.workerId, roles: w?.roles.map(prettify).join(", ") ?? "", client: clientList.find((x) => x.id === p.clientId)?.name ?? p.clientId, contractNo: c ? `${c.contractNo} (${prettify(c.pricingModel)})` : p.contractId, site: locs.find((l) => l.id === p.siteLocationId)?.name ?? p.siteLocationId, active: placementActive(p) };
  }).filter((r) => show === "all" || (show === "active" ? r.active : !r.active)), [plc, ws, cons, clientList, locs, show]);

  const cols: Column<Row>[] = [
    { key: "wName", header: "Worker" },
    { key: "roles", header: "Role" },
    { key: "client", header: "Client" },
    { key: "site", header: "Site" },
    { key: "contractNo", header: "Contract" },
    { key: "from", header: "From", cell: (r) => fmtDate(r.from) },
    { key: "to", header: "To (inclusive)", value: (r) => r.to ?? "9999", cell: (r) => (r.to ? fmtDate(r.to) : "Open") },
    { key: "state", header: "State", value: (r) => (r.active ? "active" : r.from > TODAY ? "future" : "ended"), cell: (r) => (r.active ? <StatusBadge tone="good">Active</StatusBadge> : r.from > TODAY ? <StatusBadge tone="info">Starts later</StatusBadge> : <StatusBadge>Ended</StatusBadge>) },
  ];

  const w = draft ? ws.find((x) => x.id === draft.workerId) : undefined;
  const contract = draft ? cons.find((x) => x.id === draft.contractId) : undefined;

  const save = async () => {
    if (!draft) return;
    const e: string[] = [];
    if (!draft.workerId) e.push("Choose the worker");
    if (!contract) e.push("A worker can only be placed on a contract that exists in the system");
    else {
      if (contract.status !== "active") e.push("The contract is not active");
      if (!isLabour(contract)) e.push("Placements are for fixed-labour and hourly contracts only");
    }
    if (!draft.siteId) e.push("Choose the client placement site");
    if (!draft.from) e.push("Start date is required");
    if (draft.to && draft.to < draft.from) e.push("End date cannot be before the start date");
    if (contract && draft.from && draft.from < contract.validFrom) e.push(`Starts before the contract (${fmtDate(contract.validFrom)})`);
    if (contract?.validTo && (draft.to || draft.from) > contract.validTo) e.push(`Goes past the contract end (${fmtDate(contract.validTo)})`);
    if (draft.workerId && draft.from) {
      const clash = plc.find((p) => p.id !== draft.id && p.workerId === draft.workerId && overlaps(p.from, p.to, draft.from, draft.to || null));
      if (clash) e.push(`Overlaps another placement of this worker (${fmtDate(clash.from)} to ${clash.to ? fmtDate(clash.to) : "open"})`);
    }
    const cur = draft.id ? plc.find((p) => p.id === draft.id) : undefined;
    if (cur && cur.version !== draft.version) e.push("Changed by someone else. Close and reopen.");
    setErrs(e);
    if (e.length || !contract || !w) return;
    const rec: Placement = { id: draft.id ?? placements.nextId("plc"), workerId: draft.workerId, clientId: contract.clientId, contractId: contract.id, siteLocationId: draft.siteId, from: draft.from, to: draft.to || null, version: (cur?.version ?? 0) + 1 };
    await placements.save(rec);
    if (placementActive(rec)) await workers.save({ ...w, currentClientId: contract.clientId, currentLocationId: draft.siteId, version: w.version + 1 });
    setDraft(null);
  };

  const active = plc.filter((p) => placementActive(p));
  return (
    <div className="space-y-6">
      <PageHeader title="Labour Placements" description="Date-ranged placements of workers at client sites under fixed-labour and hourly contracts." actions={!readOnly && <Button onClick={() => { setErrs([]); setDraft({ workerId: "", contractId: labourContracts[0]?.id ?? "", siteId: sites[0]?.id ?? "", from: TODAY, to: "" }); }}>New placement</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Active placements" value={active.length} />
        <KpiCard label="Contracts with placements" value={new Set(active.map((p) => p.contractId)).size} />
        <KpiCard label="Sites" value={new Set(active.map((p) => p.siteLocationId)).size} />
        <KpiCard label="Ended" value={plc.length - active.length} />
      </KpiGrid>
      <DataTable rows={rows} columns={cols} exportName="placements" searchPlaceholder="Search placements…"
        onRowClick={readOnly ? undefined : (r) => { setErrs([]); setDraft({ id: r.id, version: r.version, workerId: r.workerId, contractId: r.contractId, siteId: r.siteLocationId, from: r.from, to: r.to ?? "" }); }}
        filters={<Select className="w-36" value={show} onChange={(e) => setShow(e.target.value as typeof show)}><option value="active">Active</option><option value="ended">Ended</option><option value="all">All</option></Select>} />

      <FormSheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title={draft?.id ? "Edit placement" : "New placement"} description="End dates are inclusive. A worker cannot be in two placements on the same day." onSubmit={save}>
        {draft && (
          <>
            <Errors list={errs} />
            <Field label="Worker">
              <Select value={draft.workerId} disabled={!!draft.id} onChange={(e) => setDraft({ ...draft, workerId: e.target.value })}>
                <option value="">Choose…</option>
                {ws.filter((x) => !["terminated", "inactive", "absconded", "blocked"].includes(x.status) && !x.roles.includes("handover")).map((x) => <option key={x.id} value={x.id}>{x.name}, {x.roles.map(prettify).join("/")}</option>)}
              </Select>
            </Field>
            {w && <Notice>Modules for {w.roles.map(prettify).join(", ")}: {w.roles.map((r) => MODULES[r]).join("; ")}</Notice>}
            <Field label="Contract (fixed-labour or hourly)" hint="Only contracts that exist in the system. There is no internal-project type.">
              <Select value={draft.contractId} onChange={(e) => setDraft({ ...draft, contractId: e.target.value })}>
                <option value="">Choose…</option>
                {labourContracts.map((c) => <option key={c.id} value={c.id}>{c.contractNo}, {clientList.find((x) => x.id === c.clientId)?.name} ({prettify(c.pricingModel)})</option>)}
              </Select>
            </Field>
            <Field label="Client placement site"><Select value={draft.siteId} onChange={(e) => setDraft({ ...draft, siteId: e.target.value })}>{sites.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><Input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></Field>
              <Field label="To (inclusive, optional)"><Input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></Field>
            </div>
          </>
        )}
      </FormSheet>
    </div>
  );
}
