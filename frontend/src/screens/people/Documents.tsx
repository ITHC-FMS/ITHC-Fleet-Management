"use client";

import type { ScreenProps } from "@/screens/types";
import DocumentControl from "./DocumentControl";

export function HrDocuments(p: ScreenProps) {
  return <DocumentControl {...p} kinds={["worker"]} title="Worker Documents" description="Storage plus dates. Upload against a worker, renew without losing history." />;
}

/** Shared document control (admin and any role reusing the source page). Lease documents are managed on the Leases page. */
export default function DocumentsAll(p: ScreenProps) {
  return <DocumentControl {...p} kinds={["worker", "vehicle", "contract"]} title="Document Control" description="Documents against workers, vehicles and contracts, with issue and expiry dates and retained versions." />;
}
