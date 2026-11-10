"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Simple tab strip: <Tabs tabs={[{id,label,content}]} />. */
export function Tabs({ tabs, initial }: { tabs: { id: string; label: string; content: ReactNode }[]; initial?: string }) {
  const [cur, setCur] = useState(initial ?? tabs[0]?.id);
  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setCur(t.id)}
            className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm", cur === t.id ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.id === cur)?.content}
    </div>
  );
}
