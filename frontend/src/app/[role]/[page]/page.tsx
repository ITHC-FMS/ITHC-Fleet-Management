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
        </div>
        <p className="text-muted-foreground">{page.summary}</p>
        <p className="text-xs text-muted-foreground">
          {role.title} · Spec {page.ref}
        </p>
      </header>

      <RequirementsPanel requirements={page.requirements} />

      <ShellPreview shell={page.shell} />

      {page.future.length > 0 && (
        <section className="rounded-lg border border-dashed bg-card p-4">
          <h2 className="font-semibold">Planned for the future</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {page.future.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
