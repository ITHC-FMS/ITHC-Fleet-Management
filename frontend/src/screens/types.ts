import type { ComponentType } from "react";

export interface ScreenProps {
  /** Role whose page is being rendered, e.g. "ceo". */
  role: string;
  /** Page slug, e.g. "reports". */
  page: string;
  /** True when this role only views the page (editing belongs to another role). */
  readOnly: boolean;
  /** Role that does the editing when readOnly, e.g. "HR / Workforce Manager". */
  editedBy?: string;
}
export type ScreenMap = Record<string, ComponentType<ScreenProps>>;
