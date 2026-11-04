import Link from "next/link";
import { notFound } from "next/navigation";
import { PhaseBadge } from "@/components/phase-badge";
import { RequirementsPanel } from "@/components/requirements-panel";
import { ShellPreview } from "@/components/shell-preview";
import { getPage, getRole, roles, type Layout } from "@/config";
import { cn } from "@/lib/utils";

const WIDTH: Record<Layout, string> = {
  desktop: "max-w-6xl",
  tablet: "max-w-3xl",
  mobile: "max-w-sm",
};

export function generateStaticParams() {
  return roles.flatMap((x) => x.pages.map((p) => ({ role: x.slug, page: p.slug })));
}

export default async function ModulePage({ params }: PageProps<"/[role]/[page]">) {
  const { role: roleSlug, page: pageSlug } = await params;
  const role = getRole(roleSlug);
  const page = getPage(roleSlug, pageSlug);
  if (!role || !page) notFound();

  return (
    <div className={cn("mx-auto space-y-6", WIDTH[role.layout])}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{page.title}</h1>
          <PhaseBadge phase={page.phase} />
          {page.draft && (
            <span className="rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
              Draft: not in spec or roles doc
            </span>
          )}
        </div>
        <p className="text-muted-foreground">{page.summary}</p>
        <p className="text-xs text-muted-foreground">
          {role.title} · Spec {page.ref}
        </p>
      </header>

      <RequirementsPanel requirements={page.requirements} />

      <ShellPreview shell={page.shell} />

      {page.directory && (
        <div className="space-y-4">
          {roles
            .filter((x) => x.slug !== role.slug)
            .map((x) => (
              <section key={x.slug} className="rounded-lg border bg-card p-4">
                <h2 className="font-semibold">{x.title}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {x.pages.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/${x.slug}/${p.slug}`}
                      className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted"
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      <section className="rounded-lg border border-dashed bg-card p-4">
        <h2 className="font-semibold">Planned for the future</h2>
        {page.future.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {page.future.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Nothing is deferred for this page.</p>
        )}
      </section>
    </div>
  );
}
