"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/app/data-table";
import { Input } from "@/components/app/fields";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { contracts } from "@/data/core";
import { addDays, fmtDate, TODAY } from "@/lib/dates";
import { orders } from "@/data/ops/store";
import type { Order } from "@/data/ops/types";
import type { ScreenProps } from "../types";
import { OrderGrid } from "./OrderGrid";
import { Notice, useNames } from "./shared";

export default function OrdersScreen({ readOnly, editedBy }: ScreenProps) {
  const names = useNames();
  const cons = contracts.useAll();
  const all = orders.useAll();
  const sheets = useMemo(
    (): { id: string; name: string; kind: "store" | "marketplace" }[] => names.clients.flatMap((c) => {
      const con = cons.filter((x) => x.clientId === c.id && x.status === "active")[0];
      return con?.pricingModel === "order_based" ? [{ id: c.id, name: c.name, kind: "store" as const }] : con?.pricingModel === "marketplace_batched" ? [{ id: c.id, name: c.name, kind: "marketplace" as const }] : [] as { id: string; name: string; kind: "store" | "marketplace" }[];
    }),
    [names.clients, cons],
  );
  const [clientId, setClientId] = useState("cli-americana");
  const [date, setDate] = useState(TODAY);
  const sheet = sheets.find((s) => s.id === clientId) ?? sheets[0];

  const cols: Column<Order>[] = [
    { key: "date", header: "Date", cell: (o) => fmtDate(o.date) },
    { key: "worker", header: "Driver", value: (o) => names.worker(o.workerId) },
    { key: "place", header: sheet?.kind === "marketplace" ? "Zone" : "Store" },
    sheet?.kind === "marketplace"
      ? { key: "pickups", header: "Pickups", align: "end", value: (o) => (o.kind === "marketplace" ? o.pickups : null) }
      : { key: "orders", header: "Orders", align: "end", value: (o) => (o.kind === "store" ? o.orders : null) },
    ...(sheet?.kind === "marketplace" ? [{ key: "dropoffs", header: "Dropoffs", align: "end" as const, value: (o: Order) => (o.kind === "marketplace" ? o.dropoffs : null) }, { key: "batch", header: "Batch at order time", value: (o: Order) => (o.kind === "marketplace" ? o.batch : "") }] : []),
    { key: "version", header: "Version", align: "end" },
  ];
  const rows = useMemo(() => all.filter((o) => o.clientId === sheet?.id).sort((a, b) => b.date.localeCompare(a.date)), [all, sheet]);

  return (
    <div className="space-y-5">
      <PageHeader title="Order Entry" description="Per-client sheets. Store-based clients carry an order count; marketplace-batched clients carry separate pickups and dropoffs." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      <div className="flex flex-wrap items-center gap-2">
        {sheets.map((s) => (
          <Button key={s.id} variant={s.id === sheet?.id ? "default" : "outline"} size="sm" onClick={() => setClientId(s.id)}>{s.name}</Button>
        ))}
        <span className="ms-auto flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft /></Button>
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
          <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight /></Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(TODAY)}>Today</Button>
        </span>
      </div>
      <Notice tone="info">
        Intake mechanism: manual grid (this sheet) and spreadsheet paste/import are available; API intake from client platforms is not built and the choice is still a pending decision.
      </Notice>
      {sheet && <OrderGrid key={`${sheet.id}|${date}`} clientId={sheet.id} kind={sheet.kind} date={date} readOnly={readOnly} />}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Entered orders: {sheet?.name}</h2>
        <DataTable rows={rows} columns={cols} exportName={`orders-${sheet?.id ?? "all"}`} searchPlaceholder="Search driver, store…" pageSize={15} />
      </div>
    </div>
  );
}
