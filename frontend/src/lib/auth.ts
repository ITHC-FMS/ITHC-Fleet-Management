"use client";

import { useSyncExternalStore } from "react";

/** Demo-only auth. No passwords, no accounts created: pick a role and continue. */
export interface DemoUser {
  roleSlug: string;
  name: string;
  username: string;
  email: string;
  companyIds: string[];
}

const KEY = "ithc.demo.session";

export const DEMO_USERS: Record<string, DemoUser> = {
  ceo: { roleSlug: "ceo", name: "Khalid Al-Mutairi", username: "khalid.almutairi-0001", email: "ceo@demo.ithc", companyIds: ["cmp-ithc"] },
  admin: { roleSlug: "admin", name: "Mariam Al-Hajri", username: "mariam.alhajri-0002", email: "admin@demo.ithc", companyIds: ["cmp-ithc"] },
  operations: { roleSlug: "operations", name: "Faisal Al-Dosari", username: "faisal.aldosari-0003", email: "ops@demo.ithc", companyIds: ["cmp-ithc"] },
  finance: { roleSlug: "finance", name: "Layla Hamdan", username: "layla.hamdan-0004", email: "finance@demo.ithc", companyIds: ["cmp-ithc"] },
  payroll: { roleSlug: "payroll", name: "Reem Al-Failakawi", username: "reem.alfailakawi-0005", email: "payroll@demo.ithc", companyIds: ["cmp-ithc"] },
  fleet: { roleSlug: "fleet", name: "Jassim Behbehani", username: "jassim.behbehani-0006", email: "fleet@demo.ithc", companyIds: ["cmp-ithc"] },
  hr: { roleSlug: "hr", name: "Dalal Al-Ajmi", username: "dalal.alajmi-0007", email: "hr@demo.ithc", companyIds: ["cmp-ithc"] },
  client: { roleSlug: "client", name: "Hamad Al-Rashidi", username: "hamad.alrashidi-0008", email: "client@demo.ithc", companyIds: ["cmp-ithc"] },
  housing: { roleSlug: "housing", name: "Abdullah Al-Kandari", username: "abdullah.alkandari-0009", email: "housing@demo.ithc", companyIds: ["cmp-ithc"] },
  supervisor: { roleSlug: "supervisor", name: "Peter Mwangi", username: "peter.mwangi-0010", email: "supervisor@demo.ithc", companyIds: ["cmp-ithc"] },
  handover: { roleSlug: "handover", name: "Sunil Thapa", username: "sunil.thapa-0011", email: "desk@demo.ithc", companyIds: ["cmp-ithc"] },
  worker: { roleSlug: "worker", name: "Rajesh Sharma", username: "rajesh.sharma-0012", email: "worker@demo.ithc", companyIds: ["cmp-ithc"] },
};

/** Roles that may open other roles' pages for monitoring (see all-modules / directory pages). */
export const MONITOR_ROLES = ["ceo", "admin"];

const listeners = new Set<() => void>();
let cached: { raw: string | null; user: DemoUser | null } = { raw: null, user: null };

function read(): DemoUser | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {}
  if (raw === cached.raw) return cached.user;
  let user: DemoUser | null = null;
  try {
    user = raw ? (JSON.parse(raw) as DemoUser) : null;
  } catch {}
  cached = { raw, user };
  return user;
}

export function signIn(roleSlug: string): DemoUser | null {
  const user = DEMO_USERS[roleSlug];
  if (!user) return null;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(user));
  } catch {}
  listeners.forEach((fn) => fn());
  return user;
}

export function signOut() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};

/** undefined = not yet known on the client (first render), null = signed out. */
export function useSession(): DemoUser | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

export const canOpenRole = (user: DemoUser, roleSlug: string) =>
  roleSlug === user.roleSlug || roleSlug === "platform" || MONITOR_ROLES.includes(user.roleSlug);
