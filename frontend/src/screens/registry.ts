import { createElement } from "react";
import { adminScreens } from "./admin";
import { commercialScreens } from "./commercial";
import { fleetScreens } from "./fleet";
import { opsScreens } from "./ops";
import { peopleScreens } from "./people";
import type { ScreenMap, ScreenProps } from "./types";

const all: ScreenMap = { ...opsScreens, ...fleetScreens, ...peopleScreens, ...commercialScreens, ...adminScreens };

/** Role-specific screen first ("ceo/home"), then the shared source screen ("operations/orders"). */
export function findScreen(roleSlug: string, pageSlug: string, source?: string) {
  return all[`${roleSlug}/${pageSlug}`] ?? (source ? all[source] : undefined);
}

/** Element for a page's screen, or null when none is registered. */
export function renderScreen(roleSlug: string, pageSlug: string, source: string | undefined, props: Omit<ScreenProps, "role" | "page">) {
  const Screen = findScreen(roleSlug, pageSlug, source);
  return Screen ? createElement(Screen, { role: roleSlug, page: pageSlug, ...props }) : null;
}
