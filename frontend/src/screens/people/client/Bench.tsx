"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { clients, contracts, locations, workers, type Worker } from "@/data/core";
import { benchRecords, leases, occupancy, placements, seatRequirements, useSettings } from "@/data/people";
import { benchEligible, dailyCarry, housingCostPerHead, isDeployed, isLabour, seatRows } from "@/data/people/calc";
import { addDays, daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { Errors, Notice } from "../common";

interface Row { id: string; worker: Worker; since: string; days: number; reason: string; housing: number; daily: number }
interface Redeploy { workerId: string; contractId: string; siteId: string; from: string; reason: string }

export default function Bench({ readOnly, editedBy }: ScreenProps) {
  const ws = workers.useAll();
  const plc = placements.useAll();
  const cons = contracts.useAll();
  const clientList = clients.useAll();
  const locs = locations.useAll();
  const occ = occupancy.useAll();
  const ls = leases.useAll();
  const recs = benchRecords.useAll();
  const reqs = seatRequirements.useAll();
  const settings = useSettings();
  const [rd, setRd] = useState<Redeploy | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  const cname = useMemo(() => new Map(clientList.map((c) => [c.id, c.name])), [clientList]);
  const housing = useMemo(() => housingCostPerHead(occ, ls), [occ, ls]);
  const eligible = useMemo(() => ws.filter(benchEligible), [ws]);
  const deployed = eligible.filter((w) => isDeployed(w, plc));

  const rows: Row[] = useMemo(() => eligible.filter((w) => !isDeployed(w, plc)).map((w) => {
    const rec = recs.find((r) => r.workerId === w.id);
    const ended = plc.filter((p) => p.workerId === w.id && p.to).sort((a, b) => b.to!.localeCompare(a.to!))[0];
    const since = rec?.since ?? (ended ? addDays(ended.to!, 1) : w.joiningDate);
    const h = housing.byWorker.get(w.id) ?? 0;
    return { id: w.id, worker: w, since, days: Math.max(0, daysBetween(since, TODAY)), reason: rec?.reason ?? (ended ? "Placement ended" : "No assignment"), housing: h, daily: dailyCarry({ worker: w, housingPerHead: h, settings }) };
  }), [eligible, plc, recs, housing, settings]);

  const benchPct = deployed.length ? (rows.length / deployed.length) * 100 : 0;
  const inBand = benchPct >= settings.benchMinPct && benchPct <= settings.benchMaxPct;
  const dailyTotal = rows.reduce((a, r) => a + r.daily, 0);
  const seats = useMemo(() => seatRows({ contracts: cons, reqs, placements: plc, workers: ws, settings }).filter((s) => s.gap > 0), [cons, reqs, plc, ws, settings]);
  const clientSites = locs.filter((l) => l.kind === "client_site");

  const cols: Column<Row>[] = [
    { key: "name", header: "Worker", value: (r) => r.worker.name, cell: (r) => <div><div className="font-medium">{r.worker.name}</div><div className="text-xs text-muted-foreground">{r.worker.username}</div></div> },
    { key: "role", header: "Role", value: (r) => r.worker.roles.join(", "), cell: (r) => r.worker.roles.map(prettify).join(", ") },
    { key: "status", header: "Status", value: (r) => r.worker.status, cell: (r) => <StatusBadge>{prettify(r.worker.status)}</StatusBadge> },
    { key: "since", header: "On bench since", value: (r) => r.since, cell: (r) => fmtDate(r.since) },
    { key: "days", header: "Days on bench", align: "end", value: (r) => r.days, cell: (r) => <span className={r.days > 30 ? "font-medium text-red-600" : r.days > 14 ? "text-amber-600" : ""}>{r.days}</span> },
    { key: "reason", header: "Reason" },
    { key: "housing", header: "Housing / month (KD)", align: "end", value: (r) => r.housing, cell: (r) => formatKD(r.housing, { symbol: false }) },
    { key: "base", header: "Base pay (KD)", align: "end", value: (r) => r.worker.baseSalary, cell: (r) => formatKD(r.worker.baseSalary, { symbol: false }) },
    { key: "daily", header: "Daily cost (KD)", align: "end", value: (r) => r.daily, cell: (r) => formatKD(r.daily, { symbol: false }) },
    ...(!readOnly ? [{ key: "act", header: "", sortable: false, cell: (r: Row) => <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setErrs([]); setMsg(""); setRd({ workerId: r.id, contractId: seats[0]?.contract.id ?? "", siteId: clientSites[0]?.id ?? "", from: TODAY, reason: "" }); }}>Redeploy</Button> } as Column<Row>] : []),
  ];

  const target = rd ? cons.find((c) => c.id === rd.contractId) : undefined;
  const w = rd ? ws.find((x) => x.id === rd.workerId) : undefined;

  const submit = async () => {
    if (!rd || !w) return;
    const e: string[] = [];
    if (!target) e.push("Choose a signed contract with open seats");
    else if (target.status !== "active") e.push("Redeployment is only to a signed (active) contract");
    if (!rd.from) e.push("Choose a start date");
    if (target && isLabour(target)) {
      if (!rd.siteId) e.push("Choose the client placement site");
      if (target.validTo && rd.from > target.validTo) e.push("Start is after the contract end date");
      if (rd.from < target.validFrom) e.push("Start is before the contract start date");
    }
    setErrs(e);
    if (e.length || !target) return;
    if (isLabour(target)) {
      await placements.save({ id: placements.nextId("plc"), workerId: w.id, clientId: target.clientId, contractId: target.id, siteLocationId: rd.siteId, from: rd.from, to: null, version: 1 });
      await workers.save({ ...w, currentClientId: target.clientId, currentLocationId: rd.siteId, version: w.version + 1 });
      setMsg(`${w.name} placed on ${target.contractNo} from ${fmtDate(rd.from)}.`);
    } else {
      await workers.save({ ...w, currentClientId: target.clientId, currentLocationId: undefined, version: w.version + 1 });
      setMsg(`${w.name} marked as deployed to ${cname.get(target.clientId)}. Operations creates the formal driver assignment.`);
    }
    const rec = recs.find((r) => r.workerId === w.id);
    if (rec) await benchRecords.remove(rec.id);
    setRd(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Bench" description="Workers with no active assignment or placement." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {msg && <Notice tone="good">{msg}</Notice>}
      <KpiGrid>
        <KpiCard label="Bench size" value={rows.length} />
        <KpiCard label="Bench % of deployed" value={`${benchPct.toFixed(1)}%`} tone={inBand ? "good" : "warn"} hint={`Target ${settings.benchMinPct}–${settings.benchMaxPct}% (${rows.length} of ${deployed.length} deployed)`} />
        <KpiCard label="Daily carrying cost" value={formatKD(dailyTotal)} hint="Housing, food, insurance, permit amortisation, base pay" />
        <KpiCard label="Open signed seats" value={seats.reduce((a, s) => a + s.gap, 0)} hint="Redeploy only to these" />
      </KpiGrid>
      <DataTable rows={rows} columns={cols} exportName="bench" searchPlaceholder="Search bench…" empty="Nobody on the bench." />

      <FormSheet open={!!rd} onOpenChange={(o) => !o && setRd(null)} title={`Redeploy ${w?.name ?? ""}`} description="A worker can only be placed on a contract that exists in the system." onSubmit={submit} submitLabel="Redeploy">
        {rd && (
          <>
            <Errors list={errs} />
            {seats.length === 0 && <Notice tone="warn">No signed contract has open seats right now.</Notice>}
            <Field label="Signed contract with open seats">
              <Select value={rd.contractId} onChange={(e) => setRd({ ...rd, contractId: e.target.value })}>
                <option value="">Choose…</option>
                {seats.map((s) => <option key={s.contract.id} value={s.contract.id}>{s.contract.contractNo}, {cname.get(s.contract.clientId)} ({s.gap} open)</option>)}
              </Select>
            </Field>
            {target && isLabour(target) && (
              <Field label="Client placement site">
                <Select value={rd.siteId} onChange={(e) => setRd({ ...rd, siteId: e.target.value })}>
                  {clientSites.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
              </Field>
            )}
            {target && !isLabour(target) && <Notice>This is a driver contract. The worker is marked as deployed to the client; Operations creates the formal vehicle assignment.</Notice>}
            <Field label="Start date"><Input type="date" value={rd.from} onChange={(e) => setRd({ ...rd, from: e.target.value })} /></Field>
            <Field label="Note"><Textarea value={rd.reason} onChange={(e) => setRd({ ...rd, reason: e.target.value })} /></Field>
          </>
        )}
      </FormSheet>
    </div>
  );
}
