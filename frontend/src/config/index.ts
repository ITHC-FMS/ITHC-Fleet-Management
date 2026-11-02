import { client } from "./roles/client";
import { fleet } from "./roles/fleet";
import { supervisor, worker } from "./roles/field";
import { handover } from "./roles/handover";
import { housing } from "./roles/housing";
import { operations } from "./roles/operations";
import { platform } from "./roles/platform";
import { principal } from "./roles/principal";
import type { Role } from "./types";

export * from "./types";

export const roles: Role[] = [
  principal,
  operations,
  handover,
  fleet,
  housing,
  client,
  supervisor,
  worker,
  platform,
];

export const getRole = (slug: string) => roles.find((x) => x.slug === slug);

export const getPage = (roleSlug: string, pageSlug: string) =>
  getRole(roleSlug)?.pages.find((p) => p.slug === pageSlug);
