import Link from "next/link";
import { notFound } from "next/navigation";
import { RequirementsSlideOver } from "@/components/requirements-slide-over";
import { ShellPreview } from "@/components/shell-preview";
import { getPage, getRole, roles, type Layout } from "@/config";
import { requirementViews } from "@/config/status";
import { ScreenHost } from "@/components/screen-host";
import { cn } from "@/lib/utils";

const WIDTH: Record<Layout, string> = {
  desktop: "max-w-7xl",
  tablet: "max-w-4xl",
  mobile: "max-w-md",
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
      <ScreenHost
        role={role.slug}
        page={page.slug}
        source={page.source}
        readOnly={!!page.readOnly}
        editedBy={page.editedBy}
        fallback={

        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">{page.title}</h1>
          <p className="text-muted-foreground">{page.summary}</p>
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Screen not built yet. Open Requirements for what it needs.</p>
          <ShellPreview shell={page.shell} />
        </div>
        }
      />

      {page.directory && (
        <div className="space-y-4">
          {roles
            .filter((x) => x.slug !== role.slug)
            .map((x) => (
              <section key={x.slug} className="rounded-lg border bg-card p-4">
                <h2 className="font-semibold">{x.title}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {x.pages.map((p) => (
                    <Link key={p.slug} href={`/${x.slug}/${p.slug}`} className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted">
                      {p.title}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      <RequirementsSlideOver
        id={`${role.slug}/${page.slug}`}
        title={page.title}
        requirements={requirementViews(role.slug, page)}
        future={page.future}
      />
    </div>
  );
}
