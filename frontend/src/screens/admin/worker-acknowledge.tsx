"use client";

import { Check, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { handoverAcks, stamp, type HandoverAck } from "@/data/admin";
import { vehicles } from "@/data/core";
import { Notice } from "./shared";
import { useMyWorker } from "./worker-common";

export default function WorkerAcknowledgeScreen() {
  const { me, picker, fallback } = useMyWorker();
  const vs = vehicles.useAll();
  const acks = handoverAcks.useAll().filter((a) => a.workerId === me?.id).sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
  const pending = acks.filter((a) => !a.acknowledgedAt);
  const done = acks.filter((a) => a.acknowledgedAt);
  const ack = (a: HandoverAck) => handoverAcks.save({ ...a, acknowledgedAt: stamp() });

  const card = (a: HandoverAck) => (
    <li key={a.id} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{a.kind === "handover" ? "Vehicle handover" : "Inspection result"}</p>
        {a.result === "damage_noted" ? <StatusBadge tone="warn">Damage noted</StatusBadge> : a.kind === "inspection" ? <StatusBadge tone="good">Passed</StatusBadge> : null}
      </div>
      <p className="text-sm">{a.summary}</p>
      <p className="text-xs text-muted-foreground">Vehicle {vs.find((v) => v.id === a.vehicleId)?.plate}. Recorded against handover event {a.eventId}.</p>
      {a.acknowledgedAt ? (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><Check className="size-4" />Acknowledged {a.acknowledgedAt}</p>
      ) : (
        <Button className="h-14 w-full text-base" onClick={() => ack(a)}>{a.kind === "handover" ? "I acknowledge this handover" : "I acknowledge this inspection"}</Button>
      )}
    </li>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Acknowledge Handover" description={me?.name} />
      {picker}
      {fallback && <Notice tone="warn">Demo: no worker record matches the demo user, so {me?.name} is shown.</Notice>}
      {pending.length === 0 && <Notice tone="good"><span className="inline-flex items-center gap-2"><ShieldAlert className="size-4" />Nothing waiting for you to acknowledge.</span></Notice>}
      <ul className="space-y-3">{pending.map(card)}</ul>
      {done.length > 0 && <section className="space-y-2"><h2 className="font-semibold">Acknowledged</h2><ul className="space-y-3">{done.map(card)}</ul></section>}
    </div>
  );
}
