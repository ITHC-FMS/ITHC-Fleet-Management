"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { FormSheet } from "@/components/app/form-sheet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { clients, contracts, workers } from "@/data/core";
import { escalations, placements, seatRequirements, useSettings, type SeatRequirement } from "@/data/people";
import { filledIds, seatRows, type SeatRow } from "@/data/people/calc";
import { addDays, fmtDate, overlaps, TODAY } from "@/lib/dates";
import type { ScreenProps } from "@/screens/types";
import { Errors, Section, useActor } from "../common";

const STATE: Record<SeatRow["state"], { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  ok: { label: "On target", tone: "good" },
  below_target: { label: "Below target", tone: "warn" },
  below_minimum: { label: "Below client minimum", tone: "bad" },
  no_requirement: { label: "No requirement", tone: "neutral" },
};

type SR = SeatRow & { id: string };
interface Draft { id?: string; contractId: string; from: string; to: string; heads: string; floor: string; note: string }

export default function SeatFill({ readOnly, editedBy }: ScreenProps) {
  const actor = useActor();
  const cons = contracts.useAll();
  const clientList = clients.useAll();
  const reqs = seatRequirements.useAll();
  const plc = placements.useAll();
  const ws = workers.useAll();
  const esc = escalations.useAll();
  const settings = useSettings();
  const [sel, setSel] = useState<SR | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errs, setErrs] = useState<string[]>([]);

  const cname = useMemo(() => new Map(clientList.map((c) => [c.id, c.name])), [clientList]);
  const rows = useMemo<SR[]>(() => seatRows({ contracts: cons, reqs, placements: plc, workers: ws, settings }).map((r) => ({ ...r, id: r.contract.id })), [cons, reqs, plc, ws, settings]);
  const totalContracted = rows.reduce((a, r) => a + r.contracted, 0);
  const totalFilled = rows.reduce((a, r) => a + Math.min(r.filled, r.contracted), 0);
  const overall = totalContracted ? (totalFilled / totalContracted) * 100 : 0;
  const below = rows.filter((r) => r.state === "below_minimum");
  const lastEsc = (cid: string) => esc.filter((e) => e.kind === "seat_floor" && e.refId === cid).sort((a, b) => b.date.localeCompare(a.date))[0];

  const cols: Column<SR>[] = [
    { key: "contract", header: "Contract", value: (r) => `${r.contract.contractNo} ${cname.get(r.contract.clientId) ?? ""}`, cell: (r) => <div><div className="font-medium">{r.contract.contractNo}</div><div className="text-xs text-muted-foreground">{cname.get(r.contract.clientId)}</div></div> },
    { key: "model", header: "Model", value: (r) => r.contract.pricingModel.replace(/_/g, " ") },
    { key: "contracted", header: "Contracted", align: "end", value: (r) => r.contracted },
    { key: "filled", header: "Filled today", align: "end", value: (r) => r.filled },
    { key: "gap", header: "Gap", align: "end", value: (r) => r.gap },
    { key: "pct", header: "Fill %", align: "end", value: (r) => Number(r.pct.toFixed(1)), cell: (r) => `${r.pct.toFixed(1)}%` },
    { key: "floor", header: "Client minimum", align: "end", value: (r) => r.floor },
    { key: "state", header: "Status", value: (r) => STATE[r.state].label, cell: (r) => <StatusBadge tone={STATE[r.state].tone}>{STATE[r.state].label}</StatusBadge> },
    { key: "esc", header: "Escalated", value: (r) => lastEsc(r.contract.id)?.date ?? "", cell: (r) => (r.state === "below_minimum" ? (lastEsc(r.contract.id) ? fmtDate(lastEsc(r.contract.id)!.date) : <span className="text-red-600">Not yet</span>) : "—") },
  ];

  const openNew = () => { setErrs([]); setDraft({ contractId: rows[0]?.contract.id ?? cons[0]?.id ?? "", from: TODAY, to: addDays(TODAY, 180), heads: "", floor: "", note: "" }); };
  const openEdit = (r: SeatRequirement) => { setErrs([]); setDraft({ id: r.id, contractId: r.contractId, from: r.from, to: r.to, heads: String(r.heads), floor: String(r.volumeFloor), note: r.note ?? "" }); };

  const save = async () => {
    if (!draft) return;
    const e: string[] = [];
    const heads = Number(draft.heads), floor = Number(draft.floor);
    if (!draft.contractId) e.push("Choose a contract");
    if (!Number.isInteger(heads) || heads < 1) e.push("Heads contracted must be a whole number of at least 1");
    if (!Number.isInteger(floor) || floor < 0) e.push("Client minimum must be a whole number, 0 or more");
    if (Number.isInteger(heads) && Number.isInteger(floor) && floor > heads) e.push("Client minimum cannot exceed heads contracted");
    if (!draft.from || !draft.to || draft.to < draft.from) e.push("End date must be on or after the start date");
    if (draft.from && draft.to && draft.to >= draft.from) {
      const clash = reqs.find((r) => r.id !== draft.id && r.contractId === draft.contractId && overlaps(r.from, r.to, draft.from, draft.to));
      if (clash) e.push(`Overlaps the period ${fmtDate(clash.from)} to ${fmtDate(clash.to)} for this contract`);
    }
    setErrs(e);
    if (e.length) return;
    await seatRequirements.save({ id: draft.id ?? seatRequirements.nextId("seat"), contractId: draft.contractId, from: draft.from, to: draft.to, heads, volumeFloor: floor, note: draft.note || undefined });
    setDraft(null);
  };

  const escalate = async (r: SR) => {
    await escalations.save({
      id: escalations.nextId("esc"), kind: "seat_floor", refId: r.contract.id, date: TODAY, by: actor,
      note: `${cname.get(r.contract.clientId)} below client minimum (${r.filled} of ${r.floor})`,
    });
  };

  const history = useMemo(() => {
    if (!sel) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(TODAY, i - 13);
      const req = reqs.find((q) => q.contractId === sel.contract.id && q.from <= d && q.to >= d);
      const filled = filledIds({ contract: sel.contract, placements: plc, workers: ws, date: d }).length;
      return { d, filled, heads: req?.heads ?? sel.contracted, floor: req?.volumeFloor ?? sel.floor };
    });
  }, [sel, reqs, plc, ws]);

  return (
    <div className="space-y-6">
      <PageHeader title="Seat-Fill" description="Contracted seats against seats filled today, with the client minimum." actions={!readOnly && <Button onClick={openNew}>Add seat requirement</Button>} />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <KpiGrid>
        <KpiCard label="Overall seat-fill" value={`${overall.toFixed(1)}%`} hint={`Target ${settings.seatTargetPct}% or above`} tone={overall >= settings.seatTargetPct ? "good" : "warn"} />
        <KpiCard label="Contracts below minimum" value={below.length} tone={below.length ? "bad" : "good"} hint="Escalation required" />
        <KpiCard label="Open seats" value={rows.reduce((a, r) => a + r.gap, 0)} />
        <KpiCard label="Seats filled / contracted" value={`${totalFilled} / ${totalContracted}`} />
      </KpiGrid>

      {below.length > 0 && (
        <Section title="Escalations: under client minimum">
          <div className="space-y-2">
            {below.map((r) => (
              <div key={r.contract.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm dark:bg-red-950">
                <span><b>{cname.get(r.contract.clientId)}</b> ({r.contract.contractNo}): {r.filled} filled against a client minimum of {r.floor}. Short by {r.floor - r.filled}.
                  {lastEsc(r.contract.id) && <> Last escalated {fmtDate(lastEsc(r.contract.id)!.date)}.</>}</span>
                {!readOnly && <Button size="sm" variant="outline" onClick={() => escalate(r)}>Record escalation</Button>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <DataTable rows={rows} columns={cols} onRowClick={(r) => setSel(r)} exportName="seat-fill" searchPlaceholder="Search contracts…" />

      <FormSheet open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={sel ? `${sel.contract.contractNo} seat-fill` : ""} description={sel ? cname.get(sel.contract.clientId) : undefined} hideSubmit wide>
        {sel && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Contracted" value={sel.contracted} />
              <KpiCard label="Filled today" value={sel.filled} tone={sel.state === "ok" ? "good" : sel.state === "below_target" ? "warn" : "bad"} />
              <KpiCard label="Minimum" value={sel.floor} />
            </div>
            <Link href="/client/placements" className="text-sm underline">Open placements</Link>
            <div>
              <h3 className="mb-1 font-medium">Daily comparison, last 14 days</h3>
              <table className="w-full text-xs">
                <thead><tr className="text-start text-muted-foreground"><th className="text-start">Date</th><th className="text-end">Heads</th><th className="text-end">Filled</th><th className="text-end">Minimum</th><th className="text-end">Gap</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.d} className="border-t">
                      <td>{fmtDate(h.d)}</td><td className="text-end">{h.heads}</td>
                      <td className={`text-end ${h.filled < h.floor ? "font-medium text-red-600" : ""}`}>{h.filled}</td>
                      <td className="text-end">{h.floor}</td><td className="text-end">{Math.max(0, h.heads - h.filled)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="mb-1 font-medium">Seat requirement periods</h3>
              <table className="w-full text-xs">
                <thead><tr className="text-muted-foreground"><th className="text-start">Period</th><th className="text-end">Heads</th><th className="text-end">Minimum</th><th className="text-start ps-3">Note</th><th /></tr></thead>
                <tbody>
                  {reqs.filter((q) => q.contractId === sel.contract.id).sort((a, b) => a.from.localeCompare(b.from)).map((q) => (
                    <tr key={q.id} className="border-t">
                      <td>{fmtDate(q.from)} to {fmtDate(q.to)}</td><td className="text-end">{q.heads}</td><td className="text-end">{q.volumeFloor}</td><td className="ps-3">{q.note}</td>
                      <td className="text-end">{!readOnly && <Button size="xs" variant="outline" onClick={() => { setSel(null); openEdit(q); }}>Edit</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </FormSheet>

      <FormSheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title={draft?.id ? "Edit seat requirement" : "Add seat requirement"} description="Heads contracted for a period, with the client minimum (volume floor)." onSubmit={save}>
        {draft && (
          <>
            <Errors list={errs} />
            <Field label="Contract">
              <Select value={draft.contractId} disabled={!!draft.id} onChange={(e) => setDraft({ ...draft, contractId: e.target.value })}>
                {cons.filter((c) => c.status === "active" || c.status === "draft").map((c) => <option key={c.id} value={c.id}>{c.contractNo} v{c.version}, {cname.get(c.clientId)}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><Input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></Field>
              <Field label="To (inclusive)"><Input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></Field>
              <Field label="Heads contracted"><Input inputMode="numeric" value={draft.heads} onChange={(e) => setDraft({ ...draft, heads: e.target.value })} /></Field>
              <Field label="Client minimum (floor)"><Input inputMode="numeric" value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })} /></Field>
            </div>
            <Field label="Note"><Textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
          </>
        )}
      </FormSheet>
    </div>
  );
}
