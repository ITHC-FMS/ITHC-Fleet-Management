"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/app/form-sheet";
import { Field, Input } from "@/components/app/fields";
import { PageHeader, ReadOnlyBanner } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { logAudit, payConfig } from "@/data/ops/store";
import type { PayConfigItem } from "@/data/ops/types";
import { formatKD, parseKD } from "@/lib/money";
import type { ScreenProps } from "../types";
import { Notice, useActor } from "./shared";

const GROUPS: { id: PayConfigItem["group"]; title: string; hint: string }[] = [
  { id: "deduction", title: "Deduction types", hint: "Available when adding deductions and plans" },
  { id: "bonus", title: "Bonus types", hint: "Default rates in fils" },
  { id: "allowance", title: "Allowance defaults", hint: "Used as defaults for new workers (KD)" },
];

function ItemForm({ group, initial, onClose }: { group: PayConfigItem["group"]; initial: PayConfigItem | null; onClose: () => void }) {
  const actor = useActor();
  const all = payConfig.useAll();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [def, setDef] = useState(initial?.defaultFils === undefined ? "" : group === "bonus" ? String(initial.defaultFils) : String(initial.defaultFils / 1000));
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!label.trim()) return setErr("Name is required.");
    const key = initial?.key ?? label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (!initial && all.some((c) => c.group === group && c.key === key)) return setErr("That name already exists.");
    let defaultFils: number | undefined;
    if (def.trim() !== "") { defaultFils = group === "bonus" ? Number(def) : parseKD(def); if (!Number.isFinite(defaultFils) || defaultFils < 0) return setErr("Default must be a non-negative number."); }
    const rec: PayConfigItem = { id: initial?.id ?? payConfig.nextId("pcf"), group, key, label: label.trim(), defaultFils, active: initial?.active ?? true, system: initial?.system ?? false };
    await payConfig.save(rec);
    await logAudit({ actor, entity: "payroll_config", entityId: rec.id, action: initial ? "update" : "create", detail: `${group}: ${rec.label}` });
    onClose();
  };
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={`${initial ? "Edit" : "Add"} ${group}`} onSubmit={submit}>
      <Field label="Name"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      {group !== "deduction" && <Field label={group === "bonus" ? "Default rate (fils)" : "Default amount (KD)"}><Input value={def} inputMode="decimal" onChange={(e) => setDef(e.target.value)} /></Field>}
      {err && <Notice tone="bad">{err}</Notice>}
    </FormSheet>
  );
}

export default function PayrollConfigScreen({ readOnly, editedBy }: ScreenProps) {
  const actor = useActor();
  const all = payConfig.useAll();
  const [form, setForm] = useState<{ g: PayConfigItem["group"]; i: PayConfigItem | null } | null>(null);
  return (
    <div className="space-y-6">
      <PageHeader title="Payroll Configuration" description="Deduction types, bonus types and allowance defaults. New categories need no code change." />
      {readOnly && <ReadOnlyBanner editedBy={editedBy} />}
      {GROUPS.map((g) => (
        <section key={g.id} className="space-y-2">
          <div className="flex items-center gap-2"><h2 className="font-semibold">{g.title}</h2><span className="text-xs text-muted-foreground">{g.hint}</span>{!readOnly && <Button size="sm" variant="outline" className="ms-auto" onClick={() => setForm({ g: g.id, i: null })}><Plus /> Add</Button>}</div>
          <div className="divide-y rounded-lg border bg-card">
            {all.filter((c) => c.group === g.id).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 font-medium">{c.label}</span>
                {c.defaultFils !== undefined && <span className="tabular-nums">{g.id === "bonus" ? `${c.defaultFils} fils` : `${formatKD(c.defaultFils)}`}</span>}
                {c.system && <StatusBadge>built in</StatusBadge>}
                {!c.active && <StatusBadge tone="bad">inactive</StatusBadge>}
                {!readOnly && <Button size="xs" variant="ghost" onClick={() => setForm({ g: g.id, i: c })}>Edit</Button>}
                {!readOnly && g.id !== "allowance" && <Button size="xs" variant="ghost" onClick={async () => { await payConfig.save({ ...c, active: !c.active }); await logAudit({ actor, entity: "payroll_config", entityId: c.id, action: c.active ? "deactivate" : "activate", detail: c.label }); }}>{c.active ? "Deactivate" : "Activate"}</Button>}
              </div>
            ))}
          </div>
        </section>
      ))}
      {form && !readOnly && <ItemForm key={form.i?.id ?? "new"} group={form.g} initial={form.i} onClose={() => setForm(null)} />}
    </div>
  );
}
