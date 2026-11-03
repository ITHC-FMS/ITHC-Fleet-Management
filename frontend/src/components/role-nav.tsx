"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/config";

export function RoleSwitcher({ roles, current }: { roles: { slug: string; title: string }[]; current: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Switch role"
      value={current}
      onChange={(e) => router.push(`/${e.target.value}`)}
      className="h-9 max-w-[220px] rounded-md border bg-background px-2 text-sm"
    >
      {roles.map((x) => (
        <option key={x.slug} value={x.slug}>
          {x.title}
        </option>
      ))}
    </select>
  );
}

// Max Dash and Swift Link are named in the spec as ITHC's operating companies.
const COMPANIES = ["All companies (combined)", "Max Dash", "Swift Link"];

export function CompanySelector() {
  return (
    <select
      aria-label="Company"
      defaultValue={COMPANIES[0]}
      className="h-9 max-w-[200px] rounded-md border bg-background px-2 text-sm"
    >
      {COMPANIES.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  );
}

export function PageNav({ role }: { role: Pick<Role, "slug" | "pages"> }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {role.pages.map((p) => {
        const href = `/${role.slug}/${p.slug}`;
        const active = pathname === href;
        return (
          <Link
            key={p.slug}
            href={href}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
              active && "bg-muted font-medium",
            )}
          >
            {p.title}
          </Link>
        );
      })}
    </nav>
  );
}
