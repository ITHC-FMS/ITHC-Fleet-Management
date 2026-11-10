import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { PageNav } from "@/components/role-nav";
import { UserMenu } from "@/components/user-menu";
import { getRole, roles } from "@/config";

export function generateStaticParams() {
  return roles.map((x) => ({ role: x.slug }));
}

export default async function RoleLayout({ children, params }: LayoutProps<"/[role]">) {
  const { role: slug } = await params;
  const role = getRole(slug);
  if (!role) notFound();

  return (
    <AuthGuard roleSlug={role.slug}>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <Link href={`/${role.slug}`} className="font-semibold">ITHC Fleet Platform</Link>
          <UserMenu roleTitle={role.title} />
        </header>
        <div className="flex flex-1 flex-col md:flex-row">
          <aside className="border-b p-3 md:w-60 md:shrink-0 md:border-b-0 md:border-e">
            <Link href={`/${role.slug}`} className="mb-2 block px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {role.title}
            </Link>
            <PageNav role={{ slug: role.slug, pages: role.pages }} />
          </aside>
          <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
