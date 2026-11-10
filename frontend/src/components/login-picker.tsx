"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useRouter } from "next/navigation";
import { DEMO_USERS, signIn } from "@/lib/auth";

const ICON = { desktop: Monitor, tablet: Tablet, mobile: Smartphone } as const;

interface RoleCard { slug: string; title: string; use: string; layout: "desktop" | "tablet" | "mobile"; count: string }

/** Demo-only sign-in: no passwords and no sign-up, just continue as a role. */
export function LoginPicker({ roles }: { roles: RoleCard[] }) {
  const router = useRouter();
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-6 md:p-10">
      <header className="space-y-2">
        <p className="inline-block rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">Demo mode</p>
        <h1 className="text-3xl font-semibold">ITHC Fleet Operations Platform</h1>
        <p className="text-muted-foreground">Continue as… Pick a role to see the app as that user sees it. No account or password is needed in demo mode.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => {
          const user = DEMO_USERS[role.slug];
          const Icon = ICON[role.layout];
          return (
            <button
              key={role.slug}
              type="button"
              onClick={() => { signIn(role.slug); router.push(`/${role.slug}`); }}
              className="rounded-lg border bg-card p-5 text-start transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-medium">{role.title}</h2>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{role.use}</p>
              <p className="mt-3 text-xs text-muted-foreground">Continue as {user?.name} · {role.count}</p>
            </button>
          );
        })}
      </div>
    </main>
  );
}
