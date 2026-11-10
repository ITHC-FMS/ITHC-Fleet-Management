import { addDays, TODAY } from "@/lib/dates";
import { DEMO_USERS } from "@/lib/auth";
import { seedVehicles, seedWorkers } from "@/data/seed/core";
import { OWNER_ROLE, TIER_DAYS, DOC_LABEL } from "./tiers";
import type { AlertDocType, AppNotification, OutboxEmail } from "./types";

type Rec = { type: AlertDocType; kind: AppNotification["recordKind"]; id: string; label: string; days: number };

export const LINKS: Record<string, Partial<Record<AppNotification["recordKind"], string>>> = {
  hr: { worker: "/hr/documents" },
  fleet: { vehicle: "/fleet/documents", lessor: "/fleet/lessors" },
  finance: { contract: "/finance/contracts" },
  housing: { building: "/housing/leases", stay: "/housing/stays" },
};
export const linkFor = (role: string, kind: AppNotification["recordKind"]) => LINKS[role]?.[kind] ?? "/admin/watchlist";

function records(): Rec[] {
  const w = new Map(seedWorkers().map((x) => [x.id, x.name]));
  const v = new Map(seedVehicles().map((x) => [x.id, x.plate]));
  const wr = (type: AlertDocType, id: string, days: number): Rec => ({ type, kind: "worker", id, label: `${w.get(id)} (${id})`, days });
  const vr = (type: AlertDocType, id: string, days: number): Rec => ({ type, kind: "vehicle", id, label: `Plate ${v.get(id)} (${id})`, days });
  return [
    wr("civil_id", "wrk-0003", 12), wr("licence", "wrk-0007", 25), wr("passport", "wrk-0011", 44), wr("visa", "wrk-0015", 58),
    wr("health_card", "wrk-0019", -3), wr("civil_id", "wrk-0021", 28), wr("licence", "wrk-0026", 9), wr("passport", "wrk-0030", 51),
    wr("visa", "wrk-0034", 33), wr("health_card", "wrk-0040", 57), wr("civil_id", "wrk-0046", 4), wr("licence", "wrk-0001", 29),
    vr("vehicle_insurance", "veh-0004", 14), vr("vehicle_registration", "veh-0009", 27), vr("vehicle_insurance", "veh-0012", -5), vr("vehicle_registration", "veh-0018", 21),
    { type: "lessor_contract", kind: "lessor", id: "cmp-maxdash", label: "Max Dash lease schedule (cmp-maxdash)", days: 47 },
    { type: "lessor_contract", kind: "lessor", id: "cmp-swiftlink", label: "Swift Link lease schedule (cmp-swiftlink)", days: 58 },
    { type: "client_contract", kind: "contract", id: "con-0001", label: "CT-AMER-01 v2 renewal (con-0001)", days: 52 },
    { type: "client_contract", kind: "contract", id: "con-0005", label: "CT-BEAN-01 volume addendum (con-0005)", days: 38 },
    { type: "client_contract", kind: "contract", id: "con-0004", label: "CT-ALSH-01 bank guarantee (con-0004)", days: 17 },
    { type: "building_contract", kind: "building", id: "loc-h1", label: "Khaitan Block A lease (loc-h1)", days: 41 },
    { type: "building_contract", kind: "building", id: "loc-h2", label: "Jleeb Al-Shuyoukh lease (loc-h2)", days: 55 },
    { type: "building_contract", kind: "building", id: "loc-h3", label: "Mahboula 2 lease (loc-h3)", days: 19 },
    { type: "stay_contract", kind: "stay", id: "wrk-0005", label: `Stay contract, ${w.get("wrk-0005")} (wrk-0005)`, days: 11 },
    { type: "stay_contract", kind: "stay", id: "wrk-0013", label: `Stay contract, ${w.get("wrk-0013")} (wrk-0013)`, days: 26 },
    { type: "stay_contract", kind: "stay", id: "wrk-0029", label: `Stay contract, ${w.get("wrk-0029")} (wrk-0029)`, days: -2 },
  ];
}

export function seedNotificationsAndEmails(): { notifications: AppNotification[]; emails: OutboxEmail[] } {
  const notifications: AppNotification[] = [];
  const emails: OutboxEmail[] = [];
  let n = 0;
  records().forEach((rec, i) => {
    const expiresOn = addDays(TODAY, rec.days);
    const raisedOn = addDays(expiresOn, -TIER_DAYS[rec.type]);
    // Recipients: the owner, and Admin who sees every expiring record.
    for (const role of new Set([OWNER_ROLE[rec.type], "admin"])) {
      n++;
      const emailId = `eml-a${String(n).padStart(4, "0")}`;
      const days = rec.days;
      emails.push({
        id: emailId, to: DEMO_USERS[role].email, recipientRole: role, kind: "alert", status: "simulated_sent",
        sentAt: `${raisedOn > TODAY ? TODAY : raisedOn} 06:00`,
        subject: days < 0 ? `EXPIRED: ${DOC_LABEL[rec.type]} for ${rec.label}` : `${DOC_LABEL[rec.type]} expires in ${days} days: ${rec.label}`,
        body: `${DOC_LABEL[rec.type]} for ${rec.label} ${days < 0 ? "expired" : "expires"} on ${expiresOn}.\nThis alert is for information only. Take any action (renew, block, terminate, reassign) on the module page.`,
      });
      notifications.push({
        id: `ntf-${String(n).padStart(4, "0")}`, recipientRole: role, docType: rec.type, recordKind: rec.kind, recordId: rec.id,
        recordLabel: rec.label, expiresOn, raisedOn, read: i % 4 === 0 || rec.days > 50, emailId,
        link: role === "admin" ? "/admin/watchlist" : linkFor(role, rec.kind),
      });
    }
  });
  return { notifications, emails };
}

export const seedCredentialEmails = (): OutboxEmail[] => [
  { id: "eml-c0001", to: "noor.alqattan@ithc.example", recipientRole: "hr", kind: "credentials", status: "simulated_sent", sentAt: "2026-11-08 10:12", subject: "Your ITHC Fleet Platform account", body: "Hello Noor,\nYour account has been created.\nUsername: noor.alqattan-0101\nTemporary password: (sent in this email in the live system)\nYou must change it at first login. It expires on 2026-11-11 and works once." },
  { id: "eml-c0002", to: "hessa.alotaibi@ithc.example", recipientRole: "finance", kind: "credentials", status: "simulated_sent", sentAt: "2026-10-30 14:40", subject: "Your ITHC Fleet Platform account", body: "Hello Hessa,\nYour account has been created.\nUsername: hessa.alotaibi-0102\nTemporary password: (sent in this email in the live system)\nYou must change it at first login. It expired on 2026-11-02 unused." },
];
