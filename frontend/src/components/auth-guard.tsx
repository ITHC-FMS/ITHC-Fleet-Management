"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { canOpenRole, useSession } from "@/lib/auth";

/** Redirects to /login when signed out, and to the user's own role when they open one they may not. */
export function AuthGuard({ roleSlug, children }: { roleSlug: string; children: React.ReactNode }) {
  const user = useSession();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace("/login");
    else if (user && !canOpenRole(user, roleSlug)) router.replace(`/${user.roleSlug}`);
  }, [user, roleSlug, router]);

  if (!user || !canOpenRole(user, roleSlug)) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  return <>{children}</>;
}
