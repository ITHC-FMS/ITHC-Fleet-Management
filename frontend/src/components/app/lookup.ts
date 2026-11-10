"use client";

import { useMemo } from "react";

/** id -> record map from a list, for quick joins in tables. */
export function useById<T extends { id: string }>(rows: T[]) {
  return useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
}
