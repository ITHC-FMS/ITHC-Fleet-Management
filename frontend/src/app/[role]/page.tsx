import Link from "next/link";
import { notFound } from "next/navigation";
import { PhaseBadge } from "@/components/phase-badge";
import { getRole } from "@/config";

export default async function RoleHome({ params }: PageProps<"/[role]">) {
  const { role: slug } = await params;
  const role = getRole(slug);
  if (!role) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{role.title}</h1>
        <p className="mt-1 text-muted-foreground">{role.use}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {role.count} · Primary device: {role.layout}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {role.pages.map((p) => (
          <Link key={p.slug} href={`/${role.slug}/${p.slug}`} className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium">{p.title}</h2>
              <PhaseBadge phase={p.phase} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{p.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {p.requirements.length} requirements · {p.ref}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
