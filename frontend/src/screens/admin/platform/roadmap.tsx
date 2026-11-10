"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Section } from "../shared";

interface Item { name: string; why: string; now: string; link?: string }
const P2: Item[] = [
  { name: "Attendance dashboards", why: "Phase 1 records attendance; dashboards are analysis on top", now: "Monthly attendance summary per site", link: "/supervisor/summary" },
  { name: "Keeta VDA suite", why: "Keeta contract is still a draft", now: "Draft bulk-delivery contract only" },
  { name: "Heatmaps", why: "Needs order location data", now: "None" },
  { name: "Full driver mobile application", why: "Drivers get a minimal read-only view in Phase 1", now: "My Shift, My Vehicle, Acknowledge", link: "/worker/shift" },
  { name: "GPS, idle detection and live tracking", why: "Needs hardware and platform feeds", now: "None" },
  { name: "Shift management", why: "Intake mechanism still to be decided", now: "Read-only shift view" },
  { name: "Hourly platform APIs", why: "Marketplaces supply data by file today", now: "Data import and export" },
  { name: "Assets beyond vehicles (SIMs, lockers, devices)", why: "Vehicles are the only asset in scope", now: "None" },
  { name: "Multi-supervisor views", why: "One supervisor per site", now: "One site per supervisor" },
  { name: "AI-assisted import and schedule extraction", why: "Manual and spreadsheet import first", now: "Go-live import with mapping", link: "/admin/go-live-import" },
  { name: "Recruitment analytics", why: "Needs recruitment history", now: "None" },
];
const MOVED = ["Notification centre moved from P2 to Phase 1: expiry alerts in the app and by email"];
const EXCLUDED = ["Payroll disbursement", "WPS and PIFSS submission", "Indemnity calculation", "General ledger and financial statements"];
const PENDING = ["Shift intake mechanism (manual entry, client spreadsheet, or AI extraction)", "Arabic and RTL: phase to be confirmed", "Data residency and retention rules"];

export default function RoadmapScreen() {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const items = P2.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <PageHeader title="Phase Roadmap & Exclusions" description="What is recorded but not built, and what is excluded permanently." />
      <Section title="Recorded for P2, not built" hint={`${P2.length} items`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="h-9 w-56 rounded-md border bg-background px-2 text-sm" aria-label="Filter roadmap" />
        <ul className="divide-y">
          {items.map((i) => (
            <li key={i.name} className="py-2">
              <div className="flex items-center justify-between gap-2"><button type="button" onClick={() => setOpen(open === i.name ? null : i.name)} className="text-start text-sm font-medium">{i.name}</button><StatusBadge tone="neutral">P2, not built</StatusBadge></div>
              {open === i.name && <div className="mt-2 space-y-1 text-sm text-muted-foreground"><p>Why deferred: {i.why}</p><p>Available now: {i.now}</p>{i.link && <Link href={i.link} className="underline">Open</Link>}</div>}
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>Collapse all</Button>
      </Section>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Moved into Phase 1"><ul className="list-disc space-y-1 ps-5 text-sm">{MOVED.map((m) => <li key={m}>{m}</li>)}</ul></Section>
        <Section title="Excluded permanently"><ul className="list-disc space-y-1 ps-5 text-sm">{EXCLUDED.map((m) => <li key={m}>{m}</li>)}</ul></Section>
        <Section title="Decisions still pending"><ul className="list-disc space-y-1 ps-5 text-sm">{PENDING.map((m) => <li key={m}>{m}</li>)}</ul></Section>
      </div>
    </div>
  );
}
