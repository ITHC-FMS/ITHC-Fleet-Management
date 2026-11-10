"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import { handoverEvents, hoursBetween, incidents, lastEventByVehicle, leaseLinks, lessorContracts, transportRoutes, dateOf } from "@/data/fleet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { StatusBadge } from "@/components/app/status-badge";
import type { ScreenProps } from "@/screens/types";
import { TODAY } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useClock, useDesk } from "../_shared/hooks";
import { intentStore, uiStore } from "../_shared/store";
import { BigButton, DeskSwitcher, Section } from "../_shared/ui";
import { deskVehicles, vehicleState } from "./availability";

export default function DeskHome(_: ScreenProps) {
  void _;
  const router = useRouter();
  const { desks, deskId, setDeskId, operator, desk } = useDesk();
  const now = useClock();
  const ui = uiStore.use();
  const all = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const events = handoverEvents.useAll();
  const links = leaseLinks.useAll();
  const contracts = lessorContracts.useAll();
  const routes = transportRoutes.useAll();
  const incs = incidents.useAll();
  const last = useMemo(() => lastEventByVehicle(events), [events]);
  const name = (id: string) => workers.find((w) => w.id === id)?.name ?? id;

  const mine = deskVehicles(all, deskId);
  const rows = mine.map((v) => ({ v, st: vehicleState(v, last.get(v.id), links, contracts, routes) }));
  const out = rows.filter((r) => r.st.kind === "out");
  const pending = out.filter((r) => r.v.mode === "pooled" && (dateOf(r.st.event!.at) < TODAY || hoursBetween(r.st.event!.at, now) >= 10));
  const flagged = rows.filter((r) => r.st.kind === "blocked" || incs.some((i) => i.vehicleId === r.v.id && i.status !== "closed"));
  const today = events.filter((e) => e.deskId === deskId && dateOf(e.at) === TODAY && e.sync !== "held").length;

  const go = (vehicleId: string, direction: "issue" | "return") => {
    intentStore.set({ vehicleId, direction });
    router.push("/handover/handover");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{desk?.name ?? "Handover desk"}</h1>
          <p className="text-muted-foreground">{operator ? `Signed in: ${operator.name}` : "No operator"} · {now.slice(11, 16)}</p>
        </div>
        {ui.offline && <StatusBadge tone="warn" className="text-base">Offline mode</StatusBadge>}
      </div>
      <DeskSwitcher desks={desks} deskId={deskId} onChange={setDeskId} />
      <div className="grid grid-cols-2 gap-3">
        <BigButton tone="primary" className="min-h-24 text-2xl" onClick={() => { intentStore.set({ vehicleId: "", direction: "issue" }); router.push("/handover/handover"); }}>Issue vehicle</BigButton>
        <BigButton className="min-h-24 text-2xl" onClick={() => { intentStore.set({ vehicleId: "", direction: "return" }); router.push("/handover/handover"); }}>Return vehicle</BigButton>
      </div>
      <KpiGrid>
        <KpiCard label="Vehicles at this desk" value={mine.length} />
        <KpiCard label="Out now" value={out.length} hint={`${today} handovers today`} />
        <KpiCard label="Pending returns" value={pending.length} tone={pending.length ? "warn" : "default"} hint="Pooled, out 10 h+ or from a past day" />
        <KpiCard label="Flagged for service" value={flagged.length} tone={flagged.length ? "bad" : "default"} />
      </KpiGrid>

      <Section title="Who has what out">
        {out.length === 0 ? <p className="text-muted-foreground">Nothing is out.</p> : (
          <div className="grid gap-2 md:grid-cols-2">
            {out.map(({ v, st }) => {
              const late = pending.some((p) => p.v.id === v.id);
              return (
                <button key={v.id} type="button" onClick={() => go(v.id, "return")} className={cn("flex min-h-20 items-center justify-between rounded-xl border-2 p-3 text-start", late && "border-amber-500")}>
                  <span><span className="block text-xl font-bold">{v.plate}</span><span className="text-muted-foreground">{name(st.holderId!)} · {v.mode}</span></span>
                  <span className="text-end text-sm">{late ? <StatusBadge tone="warn">return due</StatusBadge> : <StatusBadge tone="info">out</StatusBadge>}<br />since {fmtSince(st.event!.at)}</span>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Available at this desk">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {rows.filter((r) => r.st.kind === "available").map(({ v }) => (
            <button key={v.id} type="button" onClick={() => go(v.id, "issue")} className="min-h-20 rounded-xl border-2 p-3 text-start hover:border-primary">
              <span className="block text-xl font-bold">{v.plate}</span><span className="text-sm text-muted-foreground">{v.make} {v.model} · {v.mode}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Flagged for service">
        {flagged.length === 0 ? <p className="text-muted-foreground">None.</p> : (
          <ul className="space-y-2">
            {flagged.map(({ v, st }) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                <span className="text-lg font-semibold">{v.plate} <span className="font-normal text-muted-foreground">{v.make} {v.model}</span></span>
                <StatusBadge tone="bad">{st.kind === "blocked" ? st.reason : "incident open"}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

const fmtSince = (at: string) => (at.slice(0, 10) === TODAY ? at.slice(11, 16) : `${at.slice(5, 10)} ${at.slice(11, 16)}`);
