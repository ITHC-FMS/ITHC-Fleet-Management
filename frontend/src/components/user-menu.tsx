"use client";

import { LogOut, RefreshCw, Repeat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetAllDemoData } from "@/data/store";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth";

export function UserMenu({ roleTitle }: { roleTitle: string }) {
  const user = useSession();
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-end leading-tight sm:block">
        <p className="text-sm font-medium">{user?.name ?? "…"}</p>
        <p className="text-xs text-muted-foreground">{roleTitle} · Demo</p>
      </div>
      <Link href="/platform/rules" className="hidden text-xs text-muted-foreground hover:underline md:block">Platform rules</Link>
      <Button variant="ghost" size="icon" title="Reset demo data" onClick={() => { if (confirm("Reset all demo data to its starting state?")) { resetAllDemoData(); router.refresh(); } }}>
        <RefreshCw />
      </Button>
      <Button variant="outline" size="sm" onClick={() => router.push("/login")}>
        <Repeat /> Switch role
      </Button>
      <Button variant="ghost" size="icon" title="Sign out" onClick={() => { signOut(); router.replace("/login"); }}>
        <LogOut />
      </Button>
    </div>
  );
}
