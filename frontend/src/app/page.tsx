import Link from "next/link";
import { roles } from "@/config";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-6 md:p-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">ITHC Fleet Operations Platform</h1>
        <p className="text-muted-foreground">
          Frontend base. Choose a user role to see its pages. Each page lists the requirements its module needs to be complete.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Link key={role.slug} href={`/${role.slug}`} className="rounded-lg border bg-card p-5 transition-colors hover:bg-muted/50">
            <h2 className="text-lg font-medium">{role.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{role.use}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {role.pages.length} pages · {role.layout} · {role.count}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
