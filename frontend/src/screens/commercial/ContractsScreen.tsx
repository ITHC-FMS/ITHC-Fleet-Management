"use client";

import { AlertTriangle, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Select } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, toneFor } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { clients, companies, contracts, type Contract } from "@/data/core";
import { approvals, fmtMultipleSafe } from "./approvalsLib";
import { MODEL_LABEL } from "@/data/commercial/engine";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "../types";
import { CorrectSheet, NewContractSheet, NewVersionSheet } from "./ContractForms";
import { Notice, Section } from "./ui";

interface Row { id: string; latest: Contract; versions: Contract[] }

export default function ContractsScreen({ role, readOnly, editedBy }: ScreenProps) {
  const all = contracts.useAll(), cl = clients.useAll(), co = companies.useAll(), apr = approvals.useAll();
  const [detail, setDetail] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [versioning, setVersioning] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<Contract | null>(null);
  const [clientF, setClientF] = useState("");
  const [typeF, setTypeF] = useState("");

  const rows: Row[] = useMemo(() => {
    const nos = [...new Set(all.map((c) => c.contractNo))];
    return nos.map((no) => {
      const versions = all.filter((c) => c.contractNo === no).sort((a, b) => b.version - a.version);
      return { id: no, latest: versions[0], versions };
    });
  }, [all]);

  const clientName = (id: string) => cl.find((c) => c.id === id)?.name ?? id;
  const approvalFor = (no: string) => apr.filter((a) => a.contractNo === no).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))[0];
  const eff = (r: Row) => {
    const l = r.latest;
    if (l.validTo && l.validTo < TODAY) return "expired";
    if (l.validFrom > TODAY) return "scheduled";
    return "active";
  };
  const ending = rows.filter((r) => r.latest.validTo && daysBetween(TODAY, r.latest.validTo) >= 0 && daysBetween(TODAY, r.latest.validTo) <= 180);

  const columns: Column<Row>[] = [
    { key: "no", header: "Contract", value: (r) => r.id, cell: (r) => <span className="font-medium">{r.id}</span> },
    { key: "client", header: "Client", value: (r) => clientName(r.latest.clientId) },
    { key: "co", header: "Company", value: (r) => co.find((c) => c.id === r.latest.ownerCompanyId)?.name },
    { key: "type", header: "Type", value: (r) => MODEL_LABEL[r.latest.pricingModel] },
    { key: "ver", header: "Version", value: (r) => r.latest.version, cell: (r) => `v${r.latest.version} of ${r.versions.length}` },
    { key: "from", header: "Effective from", value: (r) => r.latest.validFrom, cell: (r) => fmtDate(r.latest.validFrom) },
    { key: "to", header: "Valid to", value: (r) => r.latest.validTo ?? "9999", cell: (r) => (r.latest.validTo ? fmtDate(r.latest.validTo) : "Open") },
    { key: "seats", header: "Seats / floor", value: (r) => r.latest.seatsContracted ?? 0, cell: (r) => (r.latest.seatsContracted || r.latest.volumeFloor ? `${r.latest.seatsContracted ?? "-"} / ${r.latest.volumeFloor ?? "-"}` : "-") },
    { key: "status", header: "Status", value: eff, cell: (r) => <StatusBadge tone={toneFor(eff(r) === "scheduled" ? "draft" : eff(r))}>{eff(r)}</StatusBadge> },
  ];
  if (role === "finance")
    columns.push({
      key: "ceo", header: "CEO approval",
      value: (r) => approvalFor(r.id)?.status ?? "not required",
      cell: (r) => { const a = approvalFor(r.id); return a ? <StatusBadge tone={toneFor(a.status)}>{a.status} · {fmtMultipleSafe(a)}</StatusBadge> : <span className="text-muted-foreground">Not required</span>; },
    });

  const filtered = rows.filter((r) => (!clientF || r.latest.clientId === clientF) && (!typeF || r.latest.pricingModel === typeF));
  const sel = rows.find((r) => r.id === detail);

  return (
    <div className="space-y-4">
      <PageHeader title={role === "admin" ? "Client Contracts" : "Clients & Contracts"} description="Date-versioned configuration. A rate change creates a new version; earlier versions are never edited."
        actions={!readOnly && <Button onClick={() => setAdding(true)}><Plus /> New contract</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {role === "finance" && ending.length > 0 && (
        <Notice tone="warn"><AlertTriangle className="me-1 inline size-4" />
          Notification sent in app and by email to Finance / Commercial Manager: {ending.map((r) => `${r.id} ends ${fmtDate(r.latest.validTo)} (${daysBetween(TODAY, r.latest.validTo!)} days)`).join("; ")}.
        </Notice>
      )}
      <DataTable rows={filtered} columns={columns} exportName="client-contracts" onRowClick={(r) => setDetail(r.id)} searchPlaceholder="Search contracts…"
        filters={<>
          <Select className="w-44" value={clientF} onChange={(e) => setClientF(e.target.value)} aria-label="Client"><option value="">All clients</option>{cl.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select className="w-52" value={typeF} onChange={(e) => setTypeF(e.target.value)} aria-label="Type"><option value="">All types</option>{Object.entries(MODEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        </>} />

      <FormSheet wide open={!!sel && !adding && !versioning && !correcting} onOpenChange={(o) => !o && setDetail(null)} title={sel ? `${sel.id} · ${clientName(sel.latest.clientId)}` : ""} description={sel ? `Legal entity for invoicing: ${cl.find((c) => c.id === sel.latest.clientId)?.legalName}` : ""} hideSubmit>
        {sel && (
          <>
            {!readOnly && (
              <div className="flex gap-2">
                <Button type="button" onClick={() => setVersioning(sel.id)}>New version (rate change)</Button>
                <Button type="button" variant="outline" onClick={() => setCorrecting(sel.latest)}>Correct details</Button>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Contract-owning company</dt><dd>{co.find((c) => c.id === sel.latest.ownerCompanyId)?.name}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Pricing model</dt><dd>{MODEL_LABEL[sel.latest.pricingModel]}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Seats contracted</dt><dd>{sel.latest.seatsContracted ?? "-"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Volume floor / minimum seats</dt><dd>{sel.latest.volumeFloor ?? "-"}</dd></div>
              {approvalFor(sel.id) && <div className="col-span-2"><dt className="text-xs text-muted-foreground">CEO approval</dt><dd>{approvalFor(sel.id)!.status} ({fmtMultipleSafe(approvalFor(sel.id)!)}){approvalFor(sel.id)!.reason ? `: ${approvalFor(sel.id)!.reason}` : ""}</dd></div>}
            </dl>
            <Section title="Version history">
              {sel.versions.map((v) => {
                const older = sel.versions.find((x) => x.version === v.version - 1);
                return (
                  <div key={v.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">v{v.version}: {fmtDate(v.validFrom)} to {v.validTo ? fmtDate(v.validTo) : "open"}</span>
                      <StatusBadge tone={toneFor(v === sel.latest && eff(sel) === "active" ? "active" : v.status)}>{v === sel.latest ? eff(sel) : v.status}</StatusBadge>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {v.rates.map((r) => {
                          const prev = older?.rates.find((x) => x.key === r.key)?.amount;
                          return (
                            <tr key={r.key} className="border-t">
                              <td className="py-1 text-muted-foreground">{r.key}</td><td>{r.label}</td>
                              <td className="text-end tabular-nums">{formatKD(r.amount)} / {r.unit}</td>
                              <td className="ps-2 text-xs text-muted-foreground">{prev !== undefined && prev !== r.amount ? `was ${formatKD(prev)}` : prev === undefined && older ? "new line" : ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </Section>
          </>
        )}
      </FormSheet>

      {adding && <NewContractSheet open onClose={() => setAdding(false)} role={role} />}
      <NewVersionSheet contractNo={versioning} onClose={() => setVersioning(null)} role={role} />
      <CorrectSheet contract={correcting} onClose={() => setCorrecting(null)} role={role} />
    </div>
  );
}
