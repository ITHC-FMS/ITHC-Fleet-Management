import { Button } from "@/components/ui/button";
import type { PageShell } from "@/config";

/** Static outline of the screen. No data, no behaviour. */
export function ShellPreview({ shell }: { shell: PageShell }) {
  const { kpis, columns, actions } = shell;
  if (!kpis && !columns && !actions) return null;

  return (
    <section className="space-y-4">
      {actions && (
        <div className="flex flex-wrap gap-2">
          {actions.map((label) => (
            <Button key={label} variant="outline" size="sm" disabled>
              {label}
            </Button>
          ))}
        </div>
      )}
      {kpis && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((label) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-muted-foreground/50">—</p>
            </div>
          ))}
        </div>
      )}
      {columns && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-4 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  No data. Layout placeholder only.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
