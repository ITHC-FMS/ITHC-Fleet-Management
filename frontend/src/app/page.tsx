"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth";

export default function Home() {
  const user = useSession();
  const router = useRouter();
  useEffect(() => {
    if (user === undefined) return;
    router.replace(user ? `/${user.roleSlug}` : "/login");
  }, [user, router]);
  return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
}
