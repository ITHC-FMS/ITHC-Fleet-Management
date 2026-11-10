"use client";

import { PageHeader } from "@/components/app/page-header";

/** The route appends the directory of every role's pages below this header. */
export default function AllModules() {
  return (
    <div className="space-y-2">
      <PageHeader title="All Modules" description="Open any role's pages to monitor the business. Everything reached from here is read-only; your only approval action is on Contract Approvals." />
    </div>
  );
}
