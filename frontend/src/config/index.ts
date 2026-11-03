import type { Role } from "./types";
import { admin } from "./roles/admin";
import { ceo } from "./roles/ceo";
import { client } from "./roles/client";
import { supervisor, worker } from "./roles/field";
import { finance } from "./roles/finance";
import { fleet } from "./roles/fleet";
import { handover } from "./roles/handover";
import { housing } from "./roles/housing";
import { hr } from "./roles/hr";
import { operations } from "./roles/operations";
import { payroll } from "./roles/payroll";
import { platform } from "./roles/platform";

export * from "./types";

export const roles: Role[] = [
  ceo,
  admin,
  operations,
  finance,
  payroll,
  fleet,
  hr,
  client,
  housing,
  supervisor,
  handover,
  worker,
  platform,
];

export const getRole = (slug: string) => roles.find((x) => x.slug === slug);

export const getPage = (roleSlug: string, pageSlug: string) =>
  getRole(roleSlug)?.pages.find((p) => p.slug === pageSlug);
