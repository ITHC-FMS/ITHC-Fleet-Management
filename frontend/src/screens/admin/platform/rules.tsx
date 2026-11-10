"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { companies, contracts, clients, vehicles, workers } from "@/data/core";
import { creationRules, ROLE_LABEL } from "@/data/admin";
import { TODAY, overlaps } from "@/lib/dates";
import { formatFils, formatKD, kdToFils, parseKD } from "@/lib/money";
import { Section } from "../shared";
import { makeUsername } from "../users";

function MoneyRule() {
  const [kd, setKd] = useState("12.5");
  const fils = parseKD(kd);
  return (
    <Section title="Money: KD with three decimals" hint="Stored as integer fils (1 KD = 1,000 fils). Never floats.">
      <Field label="Type an amount in KD"><Input value={kd} onChange={(e) => setKd(e.target.value)} className="max-w-48" /></Field>
      <p className="text-sm">{Number.isNaN(fils) ? "Not a valid amount" : <>Stored as <b>{fils}</b> fils, shown as <b>{formatKD(fils)}</b>. A 250 fils bonus is <b>{formatKD(250)}</b>; {formatKD(kdToFils(0.25), { symbol: false })} KD = {formatFils(250)}.</>}</p>
    </Section>
  );
}

function OverlapRule() {
  const [a, setA] = useState({ s: "2026-11-01", e: "2026-11-15" });
  const [b, setB] = useState({ s: "2026-11-15", e: "" });
  const hit = overlaps(a.s, a.e || null, b.s, b.e || null);
  return (
    <Section title="Assignments: date ranged, inclusive end dates" hint="Two assignments for the same worker or vehicle may not overlap.">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><p className="text-sm font-medium">Assignment A</p><Input type="date" value={a.s} onChange={(e) => setA({ ...a, s: e.target.value })} /><Input type="date" value={a.e} onChange={(e) => setA({ ...a, e: e.target.value })} /></div>
        <div className="space-y-2"><p className="text-sm font-medium">Assignment B (blank end = open)</p><Input type="date" value={b.s} onChange={(e) => setB({ ...b, s: e.target.value })} /><Input type="date" value={b.e} onChange={(e) => setB({ ...b, e: e.target.value })} /></div>
      </div>
      <StatusBadge tone={hit ? "bad" : "good"}>{hit ? "Conflict: the ranges share at least one day (end date counts)" : "No conflict"}</StatusBadge>
    </Section>
  );
}

function ScopeRule() {
  const cos = companies.useAll();
  const cls = clients.useAll();
  const [emp, setEmp] = useState("cmp-ithc");
  const [own, setOwn] = useState("cmp-ithc");
  const [cl, setCl] = useState("");
  const user = { employing: ["cmp-ithc"], owning: ["cmp-ithc"], clients: ["cli-americana", "cli-talabat"] };
  const ok = [user.employing.includes(emp), user.owning.includes(own), !cl || user.clients.includes(cl)];
  return (
    <Section title="Company scoping: three independent checks" hint="Example manager: employing ITHC, contract-owning ITHC, clients Americana and Talabat.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Record's employing company"><Select value={emp} onChange={(e) => setEmp(e.target.value)}>{cos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Record's contract-owning company"><Select value={own} onChange={(e) => setOwn(e.target.value)}>{cos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Record's client"><Select value={cl} onChange={(e) => setCl(e.target.value)}><option value="">No client</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      </div>
      <div className="flex flex-wrap gap-2">{["Employing company", "Contract-owning company", "Client"].map((l, i) => <StatusBadge key={l} tone={ok[i] ? "good" : "bad"}>{l}: {ok[i] ? "allowed" : "denied"}</StatusBadge>)}</div>
      <p className="text-sm">Result: <b>{ok.every(Boolean) ? "access granted" : "access denied"}</b>. Max Dash and Swift Link are external lessors, not operating companies, so they never grant access.</p>
    </Section>
  );
}

function UsernameRule() {
  const [n, setN] = useState("Ahmed Al-Mutairi");
  const [first, ...rest] = n.trim().split(/\s+/);
  return (
    <Section title="Usernames: Latin name plus a unique number" hint="Fixed after creation. Arabic names are written in Latin letters.">
      <Field label="Name"><Input value={n} onChange={(e) => setN(e.target.value)} className="max-w-72" /></Field>
      <p className="text-sm">Generated username: <code className="rounded bg-muted px-1.5 py-0.5">{first ? makeUsername(first, rest.join(" "), []) : "—"}</code></p>
    </Section>
  );
}

export default function RulesScreen() {
  const ws = workers.useAll();
  const vs = vehicles.useAll();
  const cos = companies.useAll();
  const cons = contracts.useAll().filter((c) => c.status === "active");
  const creation = creationRules.useAll();
  return (
    <div className="space-y-4">
      <PageHeader title="Cross-cutting Rules" description="Live checks of the rules every module honours. Try the inputs." />
      <MoneyRule />
      <OverlapRule />
      <ScopeRule />
      <UsernameRule />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Contract rates are configuration, not code" hint="Rate lines per active contract, read from data.">
          <ul className="divide-y text-sm">{cons.map((c) => <li key={c.id} className="py-1.5"><b>{c.contractNo}</b> ({c.pricingModel.replace("_", " ")}): {c.rates.map((r) => `${r.label} ${formatKD(r.amount)}`).join("; ")}</li>)}</ul>
        </Section>
        <Section title="Who creates and offboards accounts">
          <ul className="divide-y text-sm">{creation.map((r) => <li key={r.id} className="py-1.5"><b>{ROLE_LABEL[r.id]}</b>: {r.may.map((x) => ROLE_LABEL[x]).join(", ")}. No one deletes accounts by hand.</li>)}</ul>
        </Section>
        <Section title="Companies">
          <ul className="divide-y text-sm">{cos.map((c) => <li key={c.id} className="flex justify-between py-1.5"><span>{c.name}</span><StatusBadge tone={c.kind === "operating" ? "good" : "info"}>{c.kind === "operating" ? "Operating company" : "External lessor"}</StatusBadge></li>)}</ul>
        </Section>
        <Section title="Time and capacity">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Business date (Asia/Kuwait)</dt><dd className="font-mono">{TODAY}</dd></div>
            <div className="flex justify-between"><dt>Workers on file</dt><dd>{ws.length} of ~260 drivers planned</dd></div>
            <div className="flex justify-between"><dt>Vehicles on file</dt><dd>{vs.length}</dd></div>
            <div className="flex justify-between"><dt>Design load</dt><dd>~10 internal users, 1,500 to 3,000 orders per month</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">Dates are business dates, never UTC timestamps. Edit forms check a record version before saving. English only for now; Arabic and RTL come later.</p>
        </Section>
      </div>
    </div>
  );
}
