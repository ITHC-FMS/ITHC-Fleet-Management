"use client";

import type { ReactNode } from "react";
import { renderScreen } from "@/screens/registry";

/**
 * Renders a page's screen. Lives in a client module because screens (and their wrappers) are
 * client code; the server page passes only serialisable props.
 */
export function ScreenHost({ role, page, source, readOnly, editedBy, fallback }: {
  role: string;
  page: string;
  source?: string;
  readOnly: boolean;
  editedBy?: string;
  fallback: ReactNode;
}) {
  return renderScreen(role, page, source, { readOnly, editedBy }) ?? <>{fallback}</>;
}
