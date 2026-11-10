"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge, prettify } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { clients, contracts, workers, type Contract } from "@/data/core";
import { placements, renewals, seatRequirements, useSettings, type Renewal } from "@/data/people";
import { seatRows } from "@/data/people/calc";
import { addDays, daysBetween, fmtDate, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { Notice } from "../common";

interface Ev { id: string; contract: Contract; date: string; kind: "Contract end" | "Annual review"; heads: number; filled: number; rec?: Renewal }
const [TY, TM] = TODAY.split("-").map(Number);
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(TY, TM - 1 + i, 1)).toISOString().slice(0, 7));
const monthLabel = (m: string) => fmtDate(`${m}-01`).slice(3);

export default function Renewals({ readOnly, editedBy }: ScreenProps) {
  const cons = contracts.useAll();
  const clientList = clients.useAll();
  const recs = renewals.useAll();
  const reqs = seatRequirements.useAll();
  const plc = placements.useAll();
  const ws = workers.useAll();
  const settings = useSettings();
  const [edit, setEdit] = useState<{ ev: Ev; status: Renewal["status"]; note: string } | null>(null);
  const horizon = addDays(TODAY, 365);

  const events: Ev[] = useMemo(() => {
    const seat = seatRows({ contracts: cons, reqs, placements: plc, workers: ws, settings });
    const out: Ev[] = [];
    for (const c of cons.filter((x) => x.status === "active")) {
      const row = seat.find((r) => r.contract.id === c.id);
      let date: string | null = null, kind: Ev["kind"] = "Contract end";
      if (c.validTo) date = c.validTo;
      else {
        // open-ended: the anniversary of the first version drives an annual review
        const first = cons.filter((x) => x.contractNo === c.contractNo).map((x) => x.validFrom).sort()[0];
        let d = first;
        while (d <= TODAY) d = `${Number(d.slice(0, 4)) + 1}${d.slice(4)}`;
        date = d; kind = "Annual review";
      }
      if (date >= TODAY && date <= horizon) out.push({ id: c.id, contract: c, date, kind, heads: row?.contracted ?? c.seatsContracted ?? 0, filled: row?.filled ?? 0, rec: recs.find((r) => r.contractId === c.id) });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [cons, reqs, plc, ws, settings, recs, horizon]);

  const cname = (id: string) => clientList.find((c) => c.id === id)?.name ?? id;
  const notifyDue = (e: Ev) => daysBetween(TODAY, e.date) <= 90;

  const cols: Column<Ev>[] = [
    { key: "month", header: "Month", value: (e) => e.date.slice(0, 7), cell: (e) => monthLabel(e.date.slice(0, 7)) },
    { key: "contract", header: "Contract", value: (e) => `${e.contract.contractNo} v${e.contract.version}`, cell: (e) => <Link className="underline" href="/finance/contracts">{e.contract.contractNo} v{e.contract.version}</Link> },
    { key: "client", header: "Client", value: (e) => cname(e.contract.clientId) },
    { key: "kind", header: "Type" },
    { key: "date", header: "Renewal date", cell: (e) => fmtDate(e.date) },
    { key: "left", header: "Days", align: "end", value: (e) => daysBetween(TODAY, e.date) },
    { key: "heads", header: "Heads at stake", align: "end", cell: (e) => <Link className="underline" href="/client/seat-fill">{e.filled} filled / {e.heads}</Link> },
    { key: "status", header: "Status", value: (e) => e.rec?.status ?? "upcoming", cell: (e) => <StatusBadge tone={e.rec?.status === "renewed" ? "good" : e.rec?.status === "lost" ? "bad" : e.rec?.status === "in_talks" ? "info" : "warn"}>{prettify(e.rec?.status ?? "upcoming")}</StatusBadge> },
    { key: "fin", header: "Finance notified", value: (e) => e.rec?.financeNotifiedOn ?? "", cell: (e) => (e.rec?.financeNotifiedOn ? fmtDate(e.rec.financeNotifiedOn) : notifyDue(e) ? <StatusBadge tone="warn">Due</StatusBadge> : "—") },
  ];

  const saveRec = async () => {
    if (!edit) return;
    const base = edit.ev.rec ?? { id: renewals.nextId("ren"), contractId: edit.ev.contract.id, status: "upcoming" as const };
    await renewals.save({ ...base, status: edit.status, note: edit.note || undefined });
    setEdit(null);
  };
  const notify = async (e: Ev) => {
    const base = e.rec ?? { id: renewals.nextId("ren"), contractId: e.contract.id, status: "upcoming" as const };
    await renewals.save({ ...base, financeNotifiedOn: TODAY });
  };

  const totalHeads = events.reduce((a, e) => a + e.heads, 0);
  const next90 = events.filter((e) => daysBetween(TODAY, e.date) <= 90);

  return (
    <div className="space-y-6">
      <PageHeader title="Renewal Calendar" description="Twelve months out, driven by contract end dates." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Renewals in 12 months" value={events.length} />
        <KpiCard label="Within 90 days" value={next90.length} tone={next90.length ? "warn" : "good"} />
        <KpiCard label="Heads at stake" value={totalHeads} />
        <KpiCard label="Finance notifications due" value={events.filter((e) => notifyDue(e) && !e.rec?.financeNotifiedOn).length} />
      </KpiGrid>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {MONTHS.map((m) => {
          const here = events.filter((e) => e.date.startsWith(m));
          return (
            <div key={m} className={`rounded-lg border p-2 text-xs ${here.length ? "bg-card" : "bg-muted/30 text-muted-foreground"}`}>
              <div className="font-medium">{monthLabel(m)}</div>
              {here.length === 0 && <div className="mt-1">No renewals</div>}
              {here.map((e) => <div key={e.id} className="mt-1 rounded bg-amber-100 px-1.5 py-1 text-amber-900 dark:bg-amber-950 dark:text-amber-200">{e.contract.contractNo}<br />{e.heads} heads, {fmtDate(e.date)}</div>)}
            </div>
          );
        })}
      </div>
      {events.some((e) => notifyDue(e) && !e.rec?.financeNotifiedOn) && <Notice tone="warn">Contracts ending within 90 days need the Finance / Commercial Manager notified. Use “Notify Finance” on the row.</Notice>}
      <DataTable rows={events} columns={[...cols, ...(!readOnly ? [{ key: "act", header: "", sortable: false, cell: (e: Ev) => (
        <span className="flex gap-1">
          <Button size="xs" variant="outline" onClick={() => setEdit({ ev: e, status: e.rec?.status ?? "upcoming", note: e.rec?.note ?? "" })}>Update</Button>
          <Button size="xs" variant="outline" onClick={() => notify(e)}>Notify Finance</Button>
        </span>) } as Column<Ev>] : [])]} exportName="renewals" empty="No renewals in the next 12 months." />

      <FormSheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit ? `${edit.ev.contract.contractNo} renewal` : ""} description={edit ? `${cname(edit.ev.contract.clientId)}, ${edit.ev.kind} on ${fmtDate(edit.ev.date)}` : undefined} onSubmit={saveRec}>
        {edit && (
          <>
            <Field label="Renewal status"><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Renewal["status"] })}><option value="upcoming">Upcoming</option><option value="in_talks">In talks</option><option value="renewed">Renewed</option><option value="lost">Lost</option></Select></Field>
            <Field label="Note"><Textarea value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
          </>
        )}
      </FormSheet>
    </div>
  );
}
