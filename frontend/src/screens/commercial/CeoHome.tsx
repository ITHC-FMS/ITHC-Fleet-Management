"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { approvals, contactLog, signedOpps } from "@/data/commercial";
import { latestVersion, sum } from "@/data/commercial/engine";
import { monthlyPnl } from "@/data/commercial/margin";
import { fmtMultiple, multipleOf } from "@/data/commercial";
import { daysBetween, fmtDate, TODAY } from "@/lib/dates";
import { formatKD } from "@/lib/money";
import type { ScreenProps } from "../types";
import { useInputs, useMarginModel } from "./model";
import { useThresholds } from "./ApprovalsScreen";
import { Bars, Card2, Money, Section } from "./ui";

const MONTH = "2026-10";

export default function CeoHome({ role }: ScreenProps) {
  const inp = useInputs();
  const m = useMarginModel(MONTH);
  const log = contactLog.useAll(), apr = approvals.useAll(), sig = signedOpps.useAll();
  const th = useThresholds();
  const pnl = useMemo(() => ["2026-08", "2026-09", "2026-10"].map((x) => monthlyPnl(inp, x)), [inp]);
  const clientName = (id: string) => inp.clients.find((c) => c.id === id)?.name ?? id;

  const nos = [...new Set(inp.contracts.map((c) => c.contractNo))];
  const noContact = nos.map((no) => {
    const v = latestVersion(inp.contracts, no)!;
    const last = log.filter((e) => e.contractNo === no).map((e) => e.date).sort().pop();
    return { no, client: v.clientId, days: last ? daysBetween(last, TODAY) : null, live: v.validFrom <= TODAY && (!v.validTo || v.validTo >= TODAY) };
  }).filter((x) => x.live && (x.days === null || x.days > 30));

  const seatFill = nos.map((no) => {
    const v = latestVersion(inp.contracts, no)!;
    const placed = inp.workers.filter((w) => w.currentClientId === v.clientId && ["active", "probation", "training"].includes(w.status)).length;
    return { no, client: v.clientId, placed, floor: v.volumeFloor, seats: v.seatsContracted, live: v.validFrom <= TODAY && (!v.validTo || v.validTo >= TODAY) };
  }).filter((x) => x.seats && x.floor && x.live && x.placed < x.floor);

  const pending = apr.filter((a) => a.status === "pending");
  const pipelineSeats = sum(pending.map((a) => a.heads)) + sum(sig.filter((s) => s.status === "awaiting_contract" && !pending.some((a) => a.id === s.approvalId)).map((s) => s.heads));

  const inService = inp.vehicles.filter((v) => v.status === "in_service" && v.type !== "transport");
  const used = inService.filter((v) => [...m.driverVehicle.entries()].some(([wid, vid]) => vid === v.id && inp.workers.find((w) => w.id === wid)?.status === "active"));
  const util = inService.length ? Math.round((used.length * 100) / inService.length) : 0;
  const margin = sum(m.clients.map((c) => c.margin));
  const topVeh = [...m.vehicles].sort((a, b) => a.margin - b.margin);

  return (
    <div className="space-y-4">
      <PageHeader title="Group Dashboard" description={`Read-only view of the whole business. Figures for October 2026; vehicle utilisation is current. All amounts in KD.`} />
      <KpiGrid>
        <KpiCard label="Margin, Oct 2026" value={formatKD(margin)} tone={margin < 0 ? "bad" : "good"} hint={`Revenue ${formatKD(sum(m.clients.map((c) => c.revenue)))}`} />
        <KpiCard label="Vehicle utilisation" value={`${util}%`} hint={`${used.length} of ${inService.length} vehicles with an active driver`} tone={util < 70 ? "warn" : "good"} />
        <KpiCard label="Seat-fill escalations" value={seatFill.length} tone={seatFill.length ? "bad" : "good"} hint="Contracts below client minimum" />
        <KpiCard label="Waiting for your approval" value={pending.length} tone={pending.length ? "warn" : "good"} hint={`Pipeline: ${pipelineSeats} seats`} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card2><Section title="Margin per client"><Bars rows={m.clients.map((c) => ({ label: c.label, value: c.margin }))} /></Section></Card2>
        <Card2><Section title="Group P&L, last three months"><Bars rows={pnl.map((p) => ({ label: p.key, value: p.margin }))} />
          <p className="mt-2 text-xs text-muted-foreground">Daily and monthly detail on Group P&amp;L; vehicle TCO on its own page.</p></Section></Card2>
        <Card2><Section title="Vehicles with the lowest margin"><Bars rows={topVeh.slice(0, 5).map((v) => ({ label: v.label, value: v.margin }))} />
          <p className="mt-2 text-xs text-muted-foreground">Best: {[...m.vehicles].sort((a, b) => b.margin - a.margin).slice(0, 2).map((v) => `${v.label} ${formatKD(v.margin)}`).join("; ")}</p></Section></Card2>
        <Card2><Section title="Workers with the lowest margin"><Bars rows={[...m.workers].sort((a, b) => a.margin - b.margin).slice(0, 5).map((w) => ({ label: w.label, value: w.margin }))} /></Section></Card2>
        <Card2>
          <Section title="No logged contact in 30 days">
            {noContact.length === 0 ? <p className="text-sm text-muted-foreground">All live contracts have recent contact.</p> : (
              <ul className="space-y-1 text-sm">{noContact.map((x) => <li key={x.no}><AlertTriangle className="me-1 inline size-4 text-red-600" />{x.no} ({clientName(x.client)}): {x.days === null ? "never" : `${x.days} days`}</li>)}</ul>
            )}
          </Section>
        </Card2>
        <Card2>
          <Section title="Seat-fill escalations">
            {seatFill.length === 0 ? <p className="text-sm text-muted-foreground">All contracts at or above their minimum.</p> : (
              <ul className="space-y-1 text-sm">{seatFill.map((x) => <li key={x.no} className="flex justify-between"><span>{x.no} ({clientName(x.client)})</span><span className="tabular-nums">{x.placed} placed / minimum {x.floor} / {x.seats} contracted</span></li>)}</ul>
            )}
          </Section>
        </Card2>
      </div>
      <Card2>
        <Section title="Opportunities waiting for written approval" actions={<Link className="text-sm text-primary underline" href={`/${role}/approvals`}>Open Contract Approvals</Link>}>
          {pending.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waiting.</p> : (
            <table className="w-full text-sm"><tbody>{pending.map((a) => (
              <tr key={a.id} className="border-t"><td className="py-1.5">{a.opportunity}</td><td>{clientName(a.clientId)}</td><td className="text-end tabular-nums">{a.heads} seats</td>
                <td className="text-end"><StatusBadge tone={multipleOf(a.revenuePerHead, a.breakEvenPerHead) < th.escalateMultiple ? "bad" : "warn"}>{fmtMultiple(multipleOf(a.revenuePerHead, a.breakEvenPerHead))}</StatusBadge></td><td className="ps-3 text-xs text-muted-foreground">{fmtDate(a.requestedAt)}</td></tr>
            ))}</tbody></table>
          )}
        </Section>
      </Card2>
      <p className="text-xs text-muted-foreground">Net contribution of placed and bench heads this month: <Money v={margin} />. The CEO can approve or decline only on Contract Approvals; everything else here is read-only.</p>
    </div>
  );
}
