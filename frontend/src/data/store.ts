"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny typed collection persisted in localStorage. This is the demo's stand-in for the
 * real backend: swapping it for real API calls later means replacing this file and the
 * thin `services` wrappers, not the screens.
 *
 * Usage:
 *   export const workers = defineCollection<Worker>("workers", seedWorkers);
 *   const all = workers.useAll();          // in a component
 *   await workers.save({ ...w, status });  // upsert
 */
const PREFIX = "ithc.demo.v1.";
const listeners = new Map<string, Set<() => void>>();
const memory = new Map<string, unknown[]>(); // cache so useSyncExternalStore snapshots are stable
const EMPTY: never[] = [];

type WithId = { id: string };

export interface Collection<T extends WithId> {
  name: string;
  useAll(): T[];
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  getSync(id: string): T | undefined;
  save(item: T): Promise<T>;
  saveMany(items: T[]): Promise<void>;
  remove(id: string): Promise<void>;
  reset(): void;
  nextId(prefix?: string): string;
}

const registry: { name: string; reset: () => void }[] = [];

/** Clears every demo collection back to its seed data. */
export function resetAllDemoData() {
  registry.forEach((c) => c.reset());
}

export function defineCollection<T extends WithId>(name: string, seed: () => T[]): Collection<T> {
  const key = PREFIX + name;
  let seedCache: T[] | null = null;
  const getSeed = () => (seedCache ??= seed());

  const read = (): T[] => {
    if (typeof window === "undefined") return getSeed();
    const cached = memory.get(key) as T[] | undefined;
    if (cached) return cached;
    let data: T[];
    try {
      const raw = window.localStorage.getItem(key);
      data = raw ? (JSON.parse(raw) as T[]) : getSeed();
    } catch {
      data = getSeed();
    }
    memory.set(key, data);
    return data;
  };

  const write = (data: T[]) => {
    memory.set(key, data);
    try {
      window.localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
    listeners.get(key)?.forEach((fn) => fn());
  };

  const subscribe = (fn: () => void) => {
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  };

  const col: Collection<T> = {
    name,
    useAll: () => useSyncExternalStore(subscribe, read, () => getSeed() ?? (EMPTY as T[])),
    list: async () => read(),
    get: async (id) => read().find((x) => x.id === id),
    getSync: (id) => read().find((x) => x.id === id),
    save: async (item) => {
      const cur = read();
      const i = cur.findIndex((x) => x.id === item.id);
      write(i >= 0 ? cur.map((x, j) => (j === i ? item : x)) : [...cur, item]);
      return item;
    },
    saveMany: async (items) => {
      let cur = read();
      for (const item of items) {
        const i = cur.findIndex((x) => x.id === item.id);
        cur = i >= 0 ? cur.map((x, j) => (j === i ? item : x)) : [...cur, item];
      }
      write(cur);
    },
    remove: async (id) => write(read().filter((x) => x.id !== id)),
    reset: () => {
      memory.delete(key);
      try {
        window.localStorage.removeItem(key);
      } catch {}
      listeners.get(key)?.forEach((fn) => fn());
    },
    nextId: (prefix = name.slice(0, 3)) => {
      const nums = read()
        .map((x) => Number(x.id.split("-").pop()))
        .filter(Number.isFinite);
      return `${prefix}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0")}`;
    },
  };
  registry.push(col);
  return col;
}
