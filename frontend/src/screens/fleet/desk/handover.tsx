"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Timer, WifiOff } from "lucide-react";
import { vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import type { Vehicle } from "@/data/entities";
import {
  blankChecklist, canDrive, handoverEvents, lastEventByVehicle, leaseLinks, lessorContracts, onDuty, resultOf, transportRoutes,
  type ChecklistItem, type HandoverEvent, type Photo,
} from "@/data/fleet";
import type { ScreenProps } from "@/screens/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/app/status-badge";
import { useDesk } from "../_shared/hooks";
import { intentStore, uiStore } from "../_shared/store";
import { BigButton, DeskSwitcher, fuelLabel, NumberStepper, PhotoCapture } from "../_shared/ui";
import { vehicleState, deskVehicles } from "./availability";
import { Checklist } from "./checklist";
import { recordHandover } from "./commit";
import { IncidentForm } from "./incident-form";

type Step = "vehicle" | "driver" | "reading" | "inspect" | "photos" | "confirm" | "done";
const STEPS: { id: Step; label: string }[] = [
  { id: "vehicle", label: "Vehicle" }, { id: "driver", label: "Driver" }, { id: "reading", label: "Odometer and fuel" },
  { id: "inspect", label: "Inspection" }, { id: "photos", label: "Photos" }, { id: "confirm", label: "Confirm" },
];
const FUEL = [0, 2, 4, 6, 8];
const TARGET_SEC = 60;

export default function HandoverScreen(_: ScreenProps) {
  void _;
  const { desks, deskId, setDeskId, operator } = useDesk();
  const intent = intentStore.use();
  const ui = uiStore.use();
  const allVehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const events = handoverEvents.useAll();
  const links = leaseLinks.useAll();
  const contracts = lessorContracts.useAll();
  const routes = transportRoutes.useAll();
  const last = useMemo(() => lastEventByVehicle(events), [events]);

  const [direction, setDirection] = useState<"issue" | "return">(intent.direction);
  const [step, setStep] = useState<Step>("vehicle");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [q, setQ] = useState("");
  const [driverPage, setDriverPage] = useState(0);
  const [odo, setOdo] = useState(0);
  const [fuel, setFuel] = useState(6);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState<HandoverEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [finalSec, setFinalSec] = useState(0);

  const vehicle = allVehicles.find((v) => v.id === vehicleId);

  const pickVehicle = (v: Vehicle, dir: "issue" | "return") => {
    setDirection(dir);
    setVehicleId(v.id);
    const l = last.get(v.id);
    setOdo(dir === "return" ? l?.odometerKm ?? v.odometerKm : v.odometerKm);
    setFuel(dir === "return" ? 4 : 6);
    setItems(blankChecklist(v.type));
    setPhotos([]);
    setNotes("");
    setDriverId(dir === "return" ? l?.driverId ?? "" : "");
    setStartedAt((s) => s ?? Date.now());
    setStep(dir === "return" ? "reading" : "driver");
  };

  // arrive from the desk home screen with a vehicle already chosen
  const consumed = useRef(false);
  useEffect(() => {
    if (consumed.current || !intent.vehicleId || allVehicles.length === 0) return;
    const v = allVehicles.find((x) => x.id === intent.vehicleId);
    consumed.current = true;
    intentStore.set({ vehicleId: "" });
    if (!v) return;
    const st = vehicleState(v, last.get(v.id), links, contracts, routes);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (st.kind === "out") pickVehicle(v, "return");
    else if (st.kind === "available") pickVehicle(v, "issue");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVehicles, intent.vehicleId]);

  useEffect(() => {
    if (startedAt === null || step === "done") return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [startedAt, step]);

  const reset = () => {
    setStep("vehicle"); setVehicleId(""); setDriverId(""); setStartedAt(null); setElapsed(0); setSaved(null); setErr(""); setQ(""); setDriverPage(0);
  };

  const holdingBy = useMemo(() => {
    const m = new Map<string, string>();
    for (const [vid, e] of last) if (e.direction === "issue") m.set(e.driverId, vid);
    return m;
  }, [last]);

  const drivers = useMemo(() => {
    if (!vehicle) return [];
    const needle = q.trim().toLowerCase();
    return workers
      .filter((w) => canDrive(w) && (!w.vehicleTypes || w.vehicleTypes.includes(vehicle.type as "car" | "bike")))
      .filter((w) => !needle || w.name.toLowerCase().includes(needle) || w.id.includes(needle))
      .sort((a, b) => Number(onDuty(b)) - Number(onDuty(a)) || a.name.localeCompare(b.name));
  }, [workers, vehicle, q]);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const sec = step === "done" ? finalSec : elapsed;
  const result = resultOf(items);
  const needPhoto = result !== "pass";

  const next = (s: Step) => { setErr(""); setStep(s); };

  const confirm = async () => {
    if (!vehicle || !operator || !driverId) return setErr(!operator ? "No operator is signed in at this desk." : "Choose a driver.");
    setBusy(true);
    const secs = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    setFinalSec(secs);
    const ev = await recordHandover({ vehicle, driverId, direction, odometerKm: odo, fuelEighths: fuel, items, photos, notes, deskId, operator, durationSec: secs, offline: ui.offline });
    setBusy(false);
    setSaved(ev);
    setStep("done");
  };

  const driverName = (id: string) => workers.find((w) => w.id === id)?.name ?? id;
  const myVehicles = deskVehicles(allVehicles, deskId);
  const lower = vehicle ? (direction === "issue" ? vehicle.odometerKm : (last.get(vehicle.id)?.odometerKm ?? 0)) : 0;

  return (
    <div className="space-y-4 text-base">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Vehicle handover</h1>
          <p className="text-muted-foreground">{operator ? `Operator: ${operator.name}` : "No operator at this desk"}</p>
        </div>
        <div className={cn("flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-3xl font-bold tabular-nums", startedAt === null ? "text-muted-foreground" : sec <= TARGET_SEC ? "border-emerald-600 text-emerald-700" : "border-red-600 text-red-700")}>
          <Timer className="size-7" />
          {String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}
          <span className="text-sm font-normal text-muted-foreground">/ 01:00 target</span>
        </div>
      </div>

      {ui.offline && (
        <div className="flex items-center gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-lg dark:bg-amber-950"><WifiOff className="size-6" /> Offline: this handover will be queued on the tablet and synced later.</div>
      )}
      <DeskSwitcher desks={desks} deskId={deskId} onChange={(id) => { setDeskId(id); reset(); }} />

      {step !== "done" && (
        <ol className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s.id} className={cn("rounded-full px-3 py-1 text-sm", i === stepIdx ? "bg-primary text-primary-foreground" : i < stepIdx ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground", direction === "return" && s.id === "driver" && "opacity-40")}>{i + 1}. {s.label}</li>
          ))}
        </ol>
      )}

      {step === "vehicle" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <BigButton selected={direction === "issue"} onClick={() => setDirection("issue")}>Issue vehicle</BigButton>
            <BigButton selected={direction === "return"} onClick={() => setDirection("return")}>Return vehicle</BigButton>
          </div>
          <p className="text-muted-foreground">Vehicles homed at this desk only. Tap one to start.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {myVehicles.map((v) => {
              const st = vehicleState(v, last.get(v.id), links, contracts, routes);
              let note = "";
              let enabled = false;
              if (st.kind === "route") note = st.reason ?? "";
              else if (st.kind === "blocked") note = st.reason ?? "Unavailable";
              else if (direction === "issue") {
                if (st.kind === "out") note = v.mode === "dedicated" ? `Issued to ${driverName(st.holderId!)}. No daily handover for dedicated bikes.` : `Already out with ${driverName(st.holderId!)}`;
                else { enabled = true; note = v.mode === "dedicated" ? "Available. Issued once, stays with rider." : "Available (one handover per shift)"; }
              } else if (st.kind === "out") { enabled = true; note = `${driverName(st.holderId!)} · since ${st.event!.at.slice(11, 16)}`; }
              else note = "Not out";
              return (
                <button key={v.id} type="button" disabled={!enabled} onClick={() => pickVehicle(v, direction)}
                  className={cn("min-h-28 rounded-xl border-2 bg-card p-3 text-start transition active:scale-[0.98]", enabled ? "hover:border-primary" : "opacity-45")}>
                  <span className="block text-2xl font-bold">{v.plate}</span>
                  <span className="block text-muted-foreground">{v.make} {v.model} · {v.type}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1"><StatusBadge tone={v.mode === "pooled" ? "info" : v.mode === "dedicated" ? "good" : "neutral"}>{v.mode}</StatusBadge></span>
                  <span className="mt-1 block text-sm">{note}</span>
                </button>
              );
            })}
            {myVehicles.length === 0 && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-muted-foreground">No vehicles are homed at this desk.</p>}
          </div>
        </div>
      )}

      {step === "driver" && vehicle && (
        <div className="space-y-4">
          <p className="text-xl">Who is taking <b>{vehicle.plate}</b>?</p>
          <input value={q} onChange={(e) => { setQ(e.target.value); setDriverPage(0); }} placeholder="Search driver name" className="h-16 w-full rounded-xl border-2 bg-background px-4 text-xl" />
          <div className="grid grid-cols-2 gap-3">
            {drivers.slice(driverPage * 8, driverPage * 8 + 8).map((w) => {
              const held = holdingBy.get(w.id);
              const off = !onDuty(w);
              const disabled = off || !!held;
              return (
                <button key={w.id} type="button" disabled={disabled} onClick={() => { setDriverId(w.id); next("reading"); }}
                  className={cn("min-h-20 rounded-xl border-2 bg-card p-3 text-start", disabled ? "opacity-40" : "hover:border-primary", driverId === w.id && "border-primary")}>
                  <span className="block text-xl font-semibold">{w.name}</span>
                  <span className="text-sm text-muted-foreground">{w.id} · {off ? w.status.replace("_", " ") : held ? "already holds a vehicle" : w.vehicleTypes?.join("/")}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <BigButton disabled={driverPage === 0} onClick={() => setDriverPage((p) => p - 1)}>Previous</BigButton>
            <BigButton onClick={() => reset()}>Cancel</BigButton>
            <BigButton disabled={(driverPage + 1) * 8 >= drivers.length} onClick={() => setDriverPage((p) => p + 1)}>More drivers</BigButton>
          </div>
        </div>
      )}

      {step === "reading" && vehicle && (
        <div className="space-y-5">
          <p className="text-xl"><b>{vehicle.plate}</b> · {direction === "issue" ? "issue to" : "returned by"} <b>{driverName(driverId)}</b></p>
          <div><p className="mb-2 text-lg font-semibold">Odometer</p><NumberStepper value={odo} onChange={setOdo} unit="km" min={lower} steps={[1, 10, 100]} /></div>
          <div>
            <p className="mb-2 text-lg font-semibold">Fuel level</p>
            <div className="grid grid-cols-5 gap-2">
              {FUEL.map((f) => <BigButton key={f} selected={fuel === f} onClick={() => setFuel(f)}>{fuelLabel(f)}</BigButton>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <BigButton onClick={() => (direction === "issue" ? next("driver") : reset())}>Back</BigButton>
            <BigButton tone="primary" onClick={() => next("inspect")}>Next: inspection</BigButton>
          </div>
        </div>
      )}

      {step === "inspect" && (
        <div className="space-y-4">
          <BigButton tone="good" className="w-full" onClick={() => { setItems((it) => it.map((i) => ({ ...i, grade: "ok", note: undefined }))); next("photos"); }}>All OK, continue</BigButton>
          <Checklist items={items} onChange={setItems} />
          <div className="grid grid-cols-2 gap-2">
            <BigButton onClick={() => next("reading")}>Back</BigButton>
            <BigButton tone="primary" onClick={() => next("photos")}>Next: photos</BigButton>
          </div>
        </div>
      )}

      {step === "photos" && (
        <div className="space-y-4">
          <p className="text-lg">{needPhoto ? "Photos are required: the inspection found a problem." : "Photos are optional when everything is OK."}</p>
          <PhotoCapture photos={photos} onChange={setPhotos} />
          <div className="grid grid-cols-2 gap-2">
            <BigButton onClick={() => next("inspect")}>Back</BigButton>
            <BigButton tone="primary" disabled={needPhoto && photos.length === 0} onClick={() => next("confirm")}>{photos.length || needPhoto ? "Next: confirm" : "Skip, no damage"}</BigButton>
          </div>
        </div>
      )}

      {step === "confirm" && vehicle && (
        <div className="space-y-4">
          <div className="space-y-1 rounded-xl border-2 bg-card p-4 text-lg">
            <p className="text-2xl font-bold">{direction === "issue" ? "Issue" : "Return"} {vehicle.plate}</p>
            <p>Driver: <b>{driverName(driverId)}</b></p>
            <p>Odometer: <b>{odo.toLocaleString("en-US")} km</b> · Fuel: <b>{fuelLabel(fuel)}</b></p>
            <p>Inspection: <StatusBadge tone={result === "pass" ? "good" : result === "minor" ? "warn" : "bad"}>{result === "pass" ? "All OK" : result === "minor" ? "Minor issues" : "Damage found"}</StatusBadge> · {photos.length} photo{photos.length === 1 ? "" : "s"}</p>
            {result === "fail" && <p className="text-red-700">Damage will raise an incident and a replacement vehicle will be offered next.</p>}
          </div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="h-14 w-full rounded-xl border-2 bg-background px-4 text-lg" />
          {err && <p className="rounded-lg bg-red-100 p-3 text-red-800">{err}</p>}
          <div className="grid grid-cols-2 gap-2">
            <BigButton onClick={() => next("photos")}>Back</BigButton>
            <BigButton tone="good" disabled={busy} onClick={confirm} className="min-h-20 text-2xl">Confirm</BigButton>
          </div>
        </div>
      )}

      {step === "done" && saved && vehicle && (
        <div className="space-y-4">
          <div className={cn("space-y-1 rounded-xl border-2 p-5", saved.sync === "queued" ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : "border-emerald-600 bg-emerald-50 dark:bg-emerald-950")}>
            <p className="flex items-center gap-2 text-2xl font-bold"><CheckCircle2 className="size-7" /> {saved.sync === "queued" ? "Saved on tablet, queued for sync" : "Handover recorded"}</p>
            <p className="text-lg">{saved.direction === "issue" ? "Issued" : "Returned"} {vehicle.plate} · {driverName(saved.driverId)} · {saved.id}</p>
            <p className="text-lg">Completed in <b>{finalSec} s</b> {finalSec <= TARGET_SEC ? <StatusBadge tone="good">within 60 s target</StatusBadge> : <StatusBadge tone="bad">over 60 s target</StatusBadge>}</p>
            {vehicle.mode === "dedicated" && saved.direction === "issue" && <p>Dedicated bike: no daily handover is needed until it is returned.</p>}
          </div>
          {saved.inspectionResult === "fail" && operator && (
            <div className="space-y-2 rounded-xl border-2 border-red-600 p-4">
              <p className="text-xl font-semibold text-red-700">Failed inspection: raise an incident</p>
              <IncidentForm vehicleId={vehicle.id} handoverId={saved.id} deskId={deskId} operator={operator} initialDescription={items.filter((i) => i.grade === "major").map((i) => `${i.label}${i.note ? ": " + i.note : ""}`).join("; ")} initialPhotos={photos} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <BigButton tone="primary" onClick={reset}>Next handover</BigButton>
            <Link href="/handover/home" className="flex min-h-16 items-center justify-center rounded-xl border-2 text-lg font-semibold">Desk home</Link>
          </div>
        </div>
      )}
    </div>
  );
}
