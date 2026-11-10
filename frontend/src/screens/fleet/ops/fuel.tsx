"use client";

import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { vehicles as vehiclesCol, workers as workersCol } from "@/data/core";
import { BASE_L100, consumptionL100, fuelAnomalies, fuelTxns, handoverEvents, logAudit, type FuelTransaction } from "@/data/fleet";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input, Select, Textarea } from "@/components/app/fields";
import { KpiCard, KpiGrid } from "@/components/app/kpi-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/app/tabs";
import { fmtDate, TODAY } from "@/lib/dates";
import { formatKD, parseKD } from "@/lib/money";
import type { ScreenProps } from "@/screens/types";
import { useActor } from "../_shared/hooks";

export default function FuelScreen(_: ScreenProps) {
  void _;
  const actor = useActor();
  const txns = fuelTxns.useAll();
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const [onlyFlag, setOnlyFlag] = useState(false);
  const [add, setAdd] = useState(false);
  const [imp, setImp] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const anomalies = useMemo(() => fuelAnomalies(txns, vehicles), [txns, vehicles]);
  const v = (id: string) => vehicles.find((x) => x.id === id);
  const unreviewed = [...anomalies.keys()].filter((id) => !txns.find((t) => t.id === id)?.reviewNote);
  const rows = txns.filter((t) => !onlyFlag || anomalies.has(t.id)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const cur = txns.find((t) => t.id === sel);

  const perVehicle = vehicles.filter((x) => txns.some((t) => t.vehicleId === x.id)).map((x) => {
    const t = txns.filter((y) => y.vehicleId === x.id);
    return { id: x.id, plate: x.plate, type: x.type, fills: t.length, litres: t.reduce((s, y) => s + y.litres, 0), cost: t.reduce((s, y) => s + y.costFils, 0), l100: consumptionL100(txns, x.id), flags: t.filter((y) => anomalies.has(y.id)).length };
  });

  const cols: Column<FuelTransaction>[] = [
    { key: "date", header: "Date", value: (t) => t.date, cell: (t) => fmtDate(t.date) },
    { key: "veh", header: "Vehicle", value: (t) => v(t.vehicleId)?.plate },
    { key: "drv", header: "Driver", value: (t) => workers.find((w) => w.id === t.driverId)?.name ?? "" , cell: (t) => workers.find((w) => w.id === t.driverId)?.name ?? "—" },
    { key: "l", header: "Litres", align: "end", value: (t) => t.litres, cell: (t) => t.litres.toFixed(1) },
    { key: "c", header: "Cost (KD)", align: "end", value: (t) => t.costFils, cell: (t) => formatKD(t.costFils, { symbol: false }) },
    { key: "odo", header: "Odometer", align: "end", value: (t) => t.odometerKm ?? 0, cell: (t) => t.odometerKm?.toLocaleString("en-US") ?? "—" },
    { key: "ev", header: "Handover event", value: (t) => t.handoverId ?? "", cell: (t) => t.handoverId ?? <span className="text-muted-foreground">not linked</span> },
    { key: "flag", header: "Anomaly", value: (t) => (anomalies.get(t.id) ?? []).join("; "), cell: (t) => (anomalies.has(t.id) ? <span title={anomalies.get(t.id)!.join("\n")}><StatusBadge tone={t.reviewNote ? "neutral" : "bad"}>{t.reviewNote ? "Reviewed" : `${anomalies.get(t.id)!.length} flag${anomalies.get(t.id)!.length > 1 ? "s" : ""}`}</StatusBadge></span> : "—") },
  ];

  const review = async () => {
    if (!cur || !note.trim()) return;
    await fuelTxns.save({ ...cur, reviewNote: note.trim() });
    await logAudit(actor.name, "Fuel", cur.id, "Anomaly reviewed", (anomalies.get(cur.id) ?? []).join("; "), note.trim());
    setNote("");
    setSel(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Fuel" description="Fuel purchases linked to a vehicle and, where possible, the handover event." actions={<><Button variant="outline" onClick={() => setImp(true)}><Upload /> Import</Button><Button onClick={() => setAdd(true)}><Plus /> Add transaction</Button></>} />
      <KpiGrid>
        <KpiCard label="Transactions" value={txns.length} />
        <KpiCard label="Fuel cost" value={formatKD(txns.reduce((s, t) => s + t.costFils, 0))} hint="Attributed to vehicles" />
        <KpiCard label="Anomalies to review" value={unreviewed.length} tone={unreviewed.length ? "bad" : "good"} />
        <KpiCard label="Unlinked to a handover" value={txns.filter((t) => !t.handoverId).length} hint="Bikes and manual entries" />
      </KpiGrid>
      <Tabs tabs={[
        { id: "t", label: "Transactions", content: <DataTable rows={rows} columns={cols} exportName="fuel" onRowClick={(t) => { setSel(t.id); setNote(t.reviewNote ?? ""); }} filters={<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyFlag} onChange={(e) => setOnlyFlag(e.target.checked)} /> Anomalies only</label>} /> },
        { id: "v", label: "Consumption per vehicle", content: (
          <DataTable rows={perVehicle} columns={[
            { key: "plate", header: "Vehicle", value: (r) => r.plate }, { key: "type", header: "Type", value: (r) => r.type },
            { key: "fills", header: "Fills", align: "end", value: (r) => r.fills }, { key: "lit", header: "Litres", align: "end", value: (r) => r.litres, cell: (r) => r.litres.toFixed(1) },
            { key: "cost", header: "Cost (KD)", align: "end", value: (r) => r.cost, cell: (r) => formatKD(r.cost, { symbol: false }) },
            { key: "l100", header: "L/100 km", align: "end", value: (r) => r.l100 ?? 0, cell: (r) => (r.l100 ? <span className={r.l100 > BASE_L100[r.type] * 1.3 ? "font-medium text-red-700" : ""}>{r.l100.toFixed(1)}</span> : "—") },
            { key: "flags", header: "Flags", align: "end", value: (r) => r.flags, cell: (r) => (r.flags ? <StatusBadge tone="bad">{r.flags}</StatusBadge> : "—") },
          ]} exportName="fuel-per-vehicle" />
        ) },
      ]} />
      {cur && (
        <FormSheet open onOpenChange={(o) => !o && setSel(null)} title={`Fuel ${cur.id}`} description={`${v(cur.vehicleId)?.plate} · ${fmtDate(cur.date)} · ${cur.station}`} onSubmit={review} submitLabel="Save review" hideSubmit={!anomalies.has(cur.id)}>
          <p className="text-sm">{cur.litres.toFixed(1)} L · {formatKD(cur.costFils)} · event {cur.handoverId ?? "not linked"} · source {cur.source}</p>
          {anomalies.get(cur.id)?.map((m) => <p key={m} className="rounded-md bg-red-100 p-2 text-sm text-red-800">{m}</p>)}
          {anomalies.has(cur.id) && <Field label="Review note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>}
        </FormSheet>
      )}
      {add && <AddFuel onClose={() => setAdd(false)} actor={actor.name} />}
      {imp && <ImportFuel onClose={() => setImp(false)} actor={actor.name} />}
    </div>
  );
}

function AddFuel({ onClose, actor }: { onClose: () => void; actor: string }) {
  const vehicles = vehiclesCol.useAll();
  const workers = workersCol.useAll();
  const events = handoverEvents.useAll();
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState(TODAY);
  const [litres, setLitres] = useState("");
  const [cost, setCost] = useState("");
  const [odo, setOdo] = useState("");
  const [station, setStation] = useState("");
  const [err, setErr] = useState("");
  const link = events.filter((e) => e.vehicleId === vehicleId && e.at.slice(0, 10) === date && e.sync !== "held").sort((a, b) => (a.at < b.at ? 1 : -1))[0];

  const save = async () => {
    const l = Number(litres), c = parseKD(cost);
    if (!vehicleId) return setErr("Choose a vehicle.");
    if (!(l > 0)) return setErr("Litres must be above zero.");
    if (!(c > 0)) return setErr("Cost must be a valid KD amount.");
    if (date > TODAY) return setErr("Date cannot be in the future.");
    const id = fuelTxns.nextId("fu");
    await fuelTxns.save({ id, date, vehicleId, driverId: link?.driverId, handoverId: link?.id, litres: l, costFils: c, odometerKm: odo ? Number(odo) : undefined, station: station.trim() || "Manual entry", source: "manual" });
    await logAudit(actor, "Fuel", id, "Created", `${l} L, ${formatKD(c)}${link ? `, linked to ${link.id}` : ""}`);
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Add fuel transaction" description="Linked to a handover event automatically when one exists that day." onSubmit={save}>
      <Field label="Vehicle"><Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}><option value="">Choose…</option>{vehicles.map((x) => <option key={x.id} value={x.id}>{x.plate} · {x.make} {x.model}</option>)}</Select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Odometer (km)"><Input value={odo} onChange={(e) => setOdo(e.target.value)} /></Field>
        <Field label="Litres"><Input value={litres} onChange={(e) => setLitres(e.target.value)} /></Field>
        <Field label="Cost (KD)"><Input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.000" /></Field>
      </div>
      <Field label="Station"><Input value={station} onChange={(e) => setStation(e.target.value)} /></Field>
      <p className="text-sm text-muted-foreground">{link ? `Will link to ${link.id} (${link.direction}, driver ${workers.find((w) => w.id === link.driverId)?.name}).` : "No handover event found that day for this vehicle; the transaction stays unlinked."}</p>
      {err && <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">{err}</p>}
    </FormSheet>
  );
}

function ImportFuel({ onClose, actor }: { onClose: () => void; actor: string }) {
  const vehicles = vehiclesCol.useAll();
  const events = handoverEvents.useAll();
  const [text, setText] = useState("date,plate,litres,cost_kd,odometer_km,station\n");
  const [done, setDone] = useState("");
  const parsed = useMemo(() => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.toLowerCase().startsWith("date")).map((line, i) => {
    const [date, plate, litres, cost, odo, station] = line.split(",").map((x) => x.trim());
    const veh = vehicles.find((x) => x.plate.toUpperCase() === (plate ?? "").toUpperCase());
    const errs: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) errs.push("date (YYYY-MM-DD)");
    if (!veh) errs.push("unknown plate");
    if (!(Number(litres) > 0)) errs.push("litres");
    if (!(parseKD(cost ?? "") > 0)) errs.push("cost");
    const ev = veh && events.filter((e) => e.vehicleId === veh.id && e.at.slice(0, 10) === date && e.sync !== "held").pop();
    return { i: i + 1, date, veh, litres: Number(litres), fils: parseKD(cost ?? ""), odo: odo ? Number(odo) : undefined, station: station || "Imported", ev, errs };
  }), [text, vehicles, events]);
  const ok = parsed.filter((p) => p.errs.length === 0);
  const run = async () => {
    for (const p of ok) await fuelTxns.save({ id: fuelTxns.nextId("fu"), date: p.date, vehicleId: p.veh!.id, driverId: p.ev?.driverId, handoverId: p.ev?.id, litres: p.litres, costFils: p.fils, odometerKm: p.odo, station: p.station, source: "import" });
    await logAudit(actor, "Fuel", "import", "Imported", `${ok.length} fuel transactions imported`);
    setDone(`${ok.length} transactions imported (${ok.filter((p) => p.ev).length} linked to handover events).`);
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Import fuel from spreadsheet" description="Paste CSV rows. Each valid row is linked to that day's handover event when there is one." onSubmit={run} submitLabel={`Import ${ok.length} rows`} hideSubmit={!!done} wide>
      <Textarea rows={8} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="space-y-1 text-sm">{parsed.map((p) => <p key={p.i} className={p.errs.length ? "text-red-700" : "text-emerald-700"}>Row {p.i}: {p.errs.length ? `invalid (${p.errs.join(", ")})` : `ready${p.ev ? `, linked ${p.ev.id}` : ""}`}</p>)}</div>
      {done && <p className="rounded-md bg-emerald-100 p-2 text-sm text-emerald-800">{done}</p>}
    </FormSheet>
  );
}
