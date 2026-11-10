"use client";

import { useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import { fmtStamp, handoverEvents, type HandoverEvent } from "@/data/fleet";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { StatusBadge } from "@/components/app/status-badge";
import type { ScreenProps } from "@/screens/types";
import { cn } from "@/lib/utils";
import { useDesk } from "../_shared/hooks";
import { uiStore } from "../_shared/store";
import { BigButton, DeskSwitcher, Section } from "../_shared/ui";
import { syncQueue } from "./sync";

const TONE = { queued: "warn", syncing: "info", failed: "bad", held: "bad", synced: "good" } as const;

export default function OfflineScreen(_: ScreenProps) {
  void _;
  const { desks, deskId, setDeskId } = useDesk();
  const ui = uiStore.use();
  const events = handoverEvents.useAll();
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const mine = events.filter((e) => e.deskId === deskId);
  const pending = mine.filter((e) => e.sync === "queued" || e.sync === "failed" || e.sync === "syncing");
  const held = mine.filter((e) => e.sync === "held");
  const recent = mine.filter((e) => e.sync === "synced" && e.syncedAt && e.queuedAt).sort((a, b) => (a.syncedAt! < b.syncedAt! ? 1 : -1)).slice(0, 5);
  const plate = (id: string) => vehicles.find((v) => v.id === id)?.plate ?? id;
  const driver = (id: string) => workers.find((w) => w.id === id)?.name ?? id;

  const sync = async () => {
    if (ui.offline) return setMsg("No connection. Switch back online to sync.");
    setBusy(true);
    const r = await syncQueue(deskId, ui.failNextSync);
    uiStore.set({ failNextSync: false });
    setBusy(false);
    setMsg(`Sync finished: ${r.synced} synced, ${r.held} held for customer support, ${r.failed} failed.`);
  };

  const simulateRemote = async () => {
    const target = pending[0];
    const v = target && vehiclesCol.getSync(target.vehicleId);
    if (!v) return setMsg("Queue an event first (go offline and record a handover).");
    await vehiclesCol.save({ ...v, version: v.version + 1 });
    setMsg(`Another user changed ${v.plate} on the server (now v${v.version + 1}). The queued event for it will conflict on sync.`);
  };

  const row = (e: HandoverEvent) => (
    <li key={e.id} className="space-y-1 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-semibold">{e.direction === "issue" ? "Issue" : "Return"} · {plate(e.vehicleId)} · {driver(e.driverId)}</span>
        <StatusBadge tone={TONE[e.sync]}>{e.sync}</StatusBadge>
      </div>
      <p className="text-sm text-muted-foreground">{e.id} · queued {fmtStamp(e.queuedAt ?? e.at)}{e.inspectionResult === "fail" ? " · damage event" : ""}</p>
      {e.conflict && <p className="text-sm text-red-700">{e.conflict}</p>}
    </li>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Offline queue</h1>
      <DeskSwitcher desks={desks} deskId={deskId} onChange={setDeskId} />
      <button
        type="button"
        onClick={() => uiStore.set({ offline: !ui.offline })}
        className={cn("flex min-h-20 w-full items-center justify-center gap-3 rounded-xl border-2 text-2xl font-bold", ui.offline ? "border-amber-500 bg-amber-100 text-amber-900" : "border-emerald-600 bg-emerald-50 text-emerald-800")}
      >
        {ui.offline ? <WifiOff className="size-8" /> : <Wifi className="size-8" />}
        {ui.offline ? "OFFLINE (simulated): tap to reconnect" : "ONLINE: tap to simulate connection loss"}
      </button>
      <KpiGrid>
        <KpiCard label="Queued on tablet" value={pending.filter((e) => e.sync === "queued").length} tone={pending.length ? "warn" : "default"} />
        <KpiCard label="Syncing" value={pending.filter((e) => e.sync === "syncing").length} />
        <KpiCard label="Failed (retry)" value={pending.filter((e) => e.sync === "failed").length} tone={pending.some((e) => e.sync === "failed") ? "bad" : "default"} />
        <KpiCard label="Held for support" value={held.length} tone={held.length ? "bad" : "default"} />
      </KpiGrid>
      <div className="grid grid-cols-2 gap-2">
        <BigButton tone="primary" disabled={busy || pending.length === 0} onClick={sync}>{pending.some((e) => e.sync === "failed") ? "Retry sync" : "Sync now"} ({pending.length})</BigButton>
        <BigButton onClick={() => uiStore.set({ offline: !ui.offline })}>{ui.offline ? "Go online" : "Go offline"}</BigButton>
      </div>
      {msg && <p className="rounded-xl border bg-muted/40 p-3 text-base">{msg}</p>}

      <Section title="Waiting to sync">
        {pending.length ? <ul className="space-y-2">{pending.map(row)}</ul> : <p className="text-muted-foreground">Queue is empty. Go offline and record a handover to see it queue here.</p>}
      </Section>
      <Section title="Sync conflicts held for customer support">
        <p className="text-sm text-muted-foreground">Conflicts are never merged automatically. Apart from damage events, they wait for customer support.</p>
        {held.length ? <ul className="space-y-2">{held.map(row)}</ul> : <p className="text-muted-foreground">None.</p>}
      </Section>
      {recent.length > 0 && <Section title="Recently synced">{<ul className="space-y-2">{recent.map(row)}</ul>}</Section>}
      <Section title="Demo tools">
        <div className="grid gap-2 md:grid-cols-2">
          <BigButton onClick={simulateRemote} className="min-h-14 text-base">Simulate a remote edit on a queued vehicle (forces a conflict)</BigButton>
          <BigButton selected={ui.failNextSync} onClick={() => uiStore.set({ failNextSync: !ui.failNextSync })} className="min-h-14 text-base">Next sync fails once: {ui.failNextSync ? "ON" : "off"}</BigButton>
        </div>
      </Section>
    </div>
  );
}
