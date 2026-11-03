import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanySelector, PageNav, RoleSwitcher } from "@/components/role-nav";
import { getRole, roles } from "@/config";

export function generateStaticParams() {
  return roles.map((x) => ({ role: x.slug }));
}

export default async function RoleLayout({ children, params }: LayoutProps<"/[role]">) {
  const { role: slug } = await params;
  const role = getRole(slug);
  if (!role) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <Link href="/" className="font-semibold">
          ITHC Fleet Platform
        </Link>
        <div className="flex items-center gap-2">
          {role.companySelector && <CompanySelector />}
          <RoleSwitcher
            roles={roles.map(({ slug, title }) => ({ slug, title }))}
            current={role.slug}
          />
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b p-3 md:w-60 md:shrink-0 md:border-b-0 md:border-r">
          <Link href={`/${role.slug}`} className="mb-2 block px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {role.title}
          </Link>
          <PageNav role={{ slug: role.slug, pages: role.pages }} />
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
