"use client";

import { useMemo, useRef, useState } from "react";
import { ClipboardPaste, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/status-badge";
import { overlaps } from "@/lib/dates";
import { assignments, orders, versionConflict } from "@/data/ops/store";
import { STORES } from "@/data/ops/seed";
import { isBlockedOn } from "@/data/ops/statuses";
import { segments } from "@/data/ops/store";
import type { MarketplaceOrder, Order, StoreOrder } from "@/data/ops/types";
import { Notice, parseDelimited, useActor, useNames } from "./shared";

interface Cell { place?: string; a?: string; b?: string }

const isInt = (s: string) => /^\d+$/.test(s.trim());

export function OrderGrid({ clientId, kind, date, readOnly }: { clientId: string; kind: "store" | "marketplace"; date: string; readOnly: boolean }) {
  const names = useNames();
  const allOrders = orders.useAll();
  const asg = assignments.useAll();
  const segs = segments.useAll();
  const actor = useActor();
  const places = STORES[clientId] ?? [];
  const marketplace = kind === "marketplace";

  const existing = useMemo(() => new Map(allOrders.filter((o) => o.clientId === clientId && o.date === date).map((o) => [o.workerId, o])), [allOrders, clientId, date]);
  const [opened] = useState(() => new Map([...existing].map(([k, o]) => [k, o.version])));
  const [edits, setEdits] = useState<Record<string, Cell>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState("");
  const [paste, setPaste] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const grid = useRef<HTMLDivElement>(null);

  const roster = useMemo(() => {
    const ids = new Set<string>(extras);
    const placeOf = new Map<string, string>();
    for (const a of asg) if (a.clientId === clientId && overlaps(a.from, a.to, date, date)) { ids.add(a.workerId); if (a.place) placeOf.set(a.workerId, a.place); }
    for (const k of existing.keys()) ids.add(k);
    return { rows: [...ids].map((id) => names.wById.get(id)).filter((w): w is NonNullable<typeof w> => !!w).sort((x, y) => x.name.localeCompare(y.name)), placeOf };
  }, [asg, clientId, date, existing, extras, names.wById]);

  const val = (id: string): Required<Cell> => {
    const o = existing.get(id);
    const e = edits[id] ?? {};
    const baseA = o ? String(o.kind === "store" ? o.orders : (o as MarketplaceOrder).pickups) : "";
    const baseB = o && o.kind === "marketplace" ? String(o.dropoffs) : "";
    return { place: e.place ?? o?.place ?? roster.placeOf.get(id) ?? places[0] ?? "", a: e.a ?? baseA, b: e.b ?? baseB };
  };
  const set = (id: string, patch: Cell) => setEdits((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const focus = (r: number, c: number) => {
    const el = grid.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
    el?.focus();
    if (el instanceof HTMLInputElement) el.select();
  };
  const onKey = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); focus(r + 1, c); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focus(r - 1, c); }
    else if (e.key === "ArrowRight" && (e.target as HTMLInputElement).type !== "text") { e.preventDefault(); focus(r, c + 1); }
    else if (e.key === "ArrowLeft" && (e.target as HTMLInputElement).type !== "text") { e.preventDefault(); focus(r, c - 1); }
  };

  const dirtyIds = Object.keys(edits);
  const total = roster.rows.reduce((acc, w) => { const v = val(w.id); return { a: acc.a + (isInt(v.a) ? +v.a : 0), b: acc.b + (isInt(v.b) ? +v.b : 0) }; }, { a: 0, b: 0 });

  const save = async () => {
    const errs: Record<string, string> = {};
    const writes: (() => Promise<unknown>)[] = [];
    for (const id of dirtyIds) {
      const w = names.wById.get(id);
      const v = val(id);
      const cur = orders.getSync(existing.get(id)?.id ?? "");
      if (cur && versionConflict(opened.get(id) ?? cur.version, cur)) { errs[id] = `Changed by someone else since you opened it (now v${cur.version}). Reload the sheet.`; continue; }
      const blank = v.a.trim() === "" && v.b.trim() === "";
      if (blank) { if (cur) writes.push(() => orders.remove(cur.id)); continue; }
      if (!isInt(v.a) || (marketplace && !isInt(v.b))) { errs[id] = marketplace ? "Pickups and dropoffs must both be whole numbers" : "Orders must be a whole number"; continue; }
      if (!v.place) { errs[id] = "Choose a store / zone"; continue; }
      if (w && isBlockedOn(segs, w, date)) { errs[id] = "Worker is blocked and cannot take work"; continue; }
      const base = { id: cur?.id ?? orders.nextId("ord"), date, workerId: id, clientId, place: v.place, version: (cur?.version ?? 0) + 1, enteredBy: actor };
      const rec: Order = marketplace
        ? ({ ...base, kind: "marketplace", pickups: +v.a, dropoffs: +v.b, batch: (cur as MarketplaceOrder | undefined)?.batch ?? w?.batch ?? "Batch 3" } satisfies MarketplaceOrder)
        : ({ ...base, kind: "store", orders: +v.a } satisfies StoreOrder);
      writes.push(() => orders.save(rec));
    }
    setErrors(errs);
    if (Object.keys(errs).length) return setFlash("");
    for (const w of writes) await w();
    setEdits({});
    setFlash(`Saved ${writes.length} row${writes.length === 1 ? "" : "s"}.`);
  };

  const applyPaste = () => {
    const rows = parseDelimited(paste ?? "");
    const next: Record<string, Cell> = { ...edits };
    const addIds: string[] = [];
    const unknown: string[] = [];
    for (const r of rows) {
      const key = r[0].toLowerCase();
      const w = names.workers.find((x) => x.name.toLowerCase() === key || x.username.toLowerCase() === key || x.riderId?.toLowerCase() === key);
      if (!w) { unknown.push(r[0]); continue; }
      const nums = r.slice(1);
      const hasPlace = nums.length > (marketplace ? 2 : 1);
      const place = hasPlace ? nums[0] : undefined;
      const rest = hasPlace ? nums.slice(1) : nums;
      next[w.id] = { ...(place ? { place: places.find((p) => p.toLowerCase() === place.toLowerCase()) ?? place } : {}), a: rest[0] ?? "", ...(marketplace ? { b: rest[1] ?? "" } : {}) };
      if (!roster.rows.some((x) => x.id === w.id)) addIds.push(w.id);
    }
    setExtras((p) => [...new Set([...p, ...addIds])]);
    setEdits(next);
    setPaste(null);
    setFlash(unknown.length ? `Pasted. Unmatched names skipped: ${unknown.join(", ")}` : `Pasted ${rows.length} rows into the grid. Review and save.`);
  };

  const addable = names.workers.filter((w) => w.roles.includes("driver") && !roster.rows.some((x) => x.id === w.id) && !isBlockedOn(segs, w, date));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge tone={marketplace ? "info" : "neutral"}>{marketplace ? "Marketplace-batched sheet: pickups and dropoffs" : "Store-based sheet: order count"}</StatusBadge>
        <span className="text-muted-foreground">Enter/Up/Down move between rows, Tab between cells. {dirtyIds.length} unsaved row{dirtyIds.length === 1 ? "" : "s"}.</span>
        {!readOnly && (
          <span className="ms-auto flex flex-wrap items-center gap-2">
            <Select value={adding} onChange={(e) => { if (e.target.value) { setExtras((p) => [...p, e.target.value]); setAdding(""); } }} className="w-52">
              <option value="">Add driver row…</option>
              {addable.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
            <Button variant="outline" size="sm" onClick={() => setPaste(paste === null ? "" : null)}><ClipboardPaste /> Paste from Excel</Button>
            <Button size="sm" onClick={save} disabled={!dirtyIds.length}><Save /> Save sheet</Button>
          </span>
        )}
      </div>
      {paste !== null && (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            Paste rows copied from Excel. Columns: driver name (or username{marketplace ? " / rider ID" : ""}), {marketplace ? "[zone,] pickups, dropoffs" : "[store,] orders"}.
          </p>
          <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} className="font-mono text-xs" rows={5} />
          <Button size="sm" onClick={applyPaste}>Apply to grid</Button>
        </div>
      )}
      {flash && <Notice tone="good">{flash}</Notice>}
      <div ref={grid} className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-start">
            <tr>
              <th className="px-2 py-1.5 text-start font-medium">#</th>
              <th className="px-2 py-1.5 text-start font-medium">Driver</th>
              {marketplace && <th className="px-2 py-1.5 text-start font-medium">Batch (snapshot)</th>}
              <th className="px-2 py-1.5 text-start font-medium">{marketplace ? "Zone" : "Store"}</th>
              <th className="px-2 py-1.5 text-end font-medium">{marketplace ? "Pickups" : "Orders"}</th>
              {marketplace && <th className="px-2 py-1.5 text-end font-medium">Dropoffs</th>}
              <th className="px-2 py-1.5 text-start font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {roster.rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No drivers are assigned to this client on this date. Add a driver row or check Assignments.</td></tr>}
            {roster.rows.map((w, r) => {
              const v = val(w.id);
              const ex = existing.get(w.id);
              const dirty = !!edits[w.id];
              return (
                <tr key={w.id} className={`border-t ${dirty ? "bg-amber-50/60" : ""}`}>
                  <td className="px-2 py-1 text-muted-foreground">{r + 1}</td>
                  <td className="px-2 py-1 font-medium">{w.name}<span className="ms-2 text-xs text-muted-foreground">{w.riderId ?? w.username}</span></td>
                  {marketplace && <td className="px-2 py-1 text-xs">{(ex as MarketplaceOrder | undefined)?.batch ?? w.batch ?? "—"}</td>}
                  <td className="px-1 py-0.5">
                    <Select data-r={r} data-c={0} disabled={readOnly} value={v.place} onChange={(e) => set(w.id, { place: e.target.value })} onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") onKey(e, r, 0); }} className="h-8 min-w-40">
                      {[...new Set([v.place, ...places])].filter(Boolean).map((p) => <option key={p}>{p}</option>)}
                    </Select>
                  </td>
                  <td className="px-1 py-0.5"><Input data-r={r} data-c={1} disabled={readOnly} inputMode="numeric" value={v.a} onFocus={(e) => e.target.select()} onChange={(e) => set(w.id, { a: e.target.value })} onKeyDown={(e) => onKey(e, r, 1)} className="h-8 w-24 text-end tabular-nums" /></td>
                  {marketplace && <td className="px-1 py-0.5"><Input data-r={r} data-c={2} disabled={readOnly} inputMode="numeric" value={v.b} onFocus={(e) => e.target.select()} onChange={(e) => set(w.id, { b: e.target.value })} onKeyDown={(e) => onKey(e, r, 2)} className="h-8 w-24 text-end tabular-nums" /></td>}
                  <td className="px-2 py-1 text-xs">
                    {errors[w.id] ? <span className="text-red-600">{errors[w.id]}</span> : dirty ? <span className="text-amber-700">Unsaved</span> : ex ? <span className="text-muted-foreground">Saved v{ex.version}</span> : <span className="text-muted-foreground">Not entered</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/30 font-medium">
            <tr>
              <td colSpan={marketplace ? 4 : 3} className="px-2 py-1.5 text-end">Sheet total</td>
              <td className="px-2 py-1.5 text-end tabular-nums">{total.a}</td>
              {marketplace && <td className="px-2 py-1.5 text-end tabular-nums">{total.b}</td>}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
