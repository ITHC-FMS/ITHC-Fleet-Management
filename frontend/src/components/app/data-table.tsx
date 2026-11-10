"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  /** Rendered cell. Defaults to String(row[key]). */
  cell?: (row: T) => ReactNode;
  /** Value used for sorting, search and CSV export. Defaults to row[key]. */
  value?: (row: T) => string | number | null | undefined;
  align?: "start" | "end";
  sortable?: boolean;
  className?: string;
}

/**
 * Generic table: search, sort, optional filters slot, row click, CSV export (the spec requires
 * a matching export on every list screen).
 */
export function DataTable<T extends { id: string }>({
  rows, columns, onRowClick, filters, searchPlaceholder = "Search…", exportName, empty = "No records.", toolbar, rowClassName, pageSize = 25,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  filters?: ReactNode;
  searchPlaceholder?: string;
  exportName?: string;
  empty?: string;
  toolbar?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
  pageSize?: number;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const val = (c: Column<T>, row: T) => (c.value ? c.value(row) : ((row as Record<string, unknown>)[c.key] as string | number | null | undefined));

  const shown = useMemo(() => {
    let out = rows;
    if (q.trim()) {
      const needle = q.toLowerCase();
      out = out.filter((row) => columns.some((c) => String(val(c, row) ?? "").toLowerCase().includes(needle)));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col)
        out = [...out].sort((a, b) => {
          const x = val(col, a) ?? "", y = val(col, b) ?? "";
          return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
        });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns]);

  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = shown.slice(cur * pageSize, cur * pageSize + pageSize);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [columns.map((c) => esc(c.header)).join(","), ...shown.map((row) => columns.map((c) => esc(val(c, row))).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder={searchPlaceholder}
            className="h-9 w-56 rounded-md border bg-background ps-8 pe-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </div>
        {filters}
        <div className="ms-auto flex items-center gap-2">
          {toolbar}
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download /> Export
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-start">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn("whitespace-nowrap px-3 py-2 font-medium", c.align === "end" ? "text-end" : "text-start", c.sortable !== false && "cursor-pointer select-none")}
                  onClick={() => c.sortable !== false && setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 }))}
                >
                  {c.header}
                  {sort?.key === c.key && <span className="ms-1 text-xs">{sort.dir === 1 ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-muted-foreground">{empty}</td></tr>
            )}
            {slice.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("border-t", onRowClick && "cursor-pointer hover:bg-muted/40", rowClassName?.(row))}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2", c.align === "end" && "text-end tabular-nums", c.className)}>
                    {c.cell ? c.cell(row) : String(val(c, row) ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{shown.length} record{shown.length === 1 ? "" : "s"}</span>
        {pages > 1 && (
          <span className="flex items-center gap-2">
            <Button variant="outline" size="xs" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Prev</Button>
            Page {cur + 1} / {pages}
            <Button variant="outline" size="xs" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button>
          </span>
        )}
      </div>
    </div>
  );
}
