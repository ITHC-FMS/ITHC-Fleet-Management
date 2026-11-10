"use client";

import { PageHeader } from "@/components/app/page-header";
import { Field, Input } from "@/components/app/fields";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/data/admin";
import { companies } from "@/data/core";
import { useSession } from "@/lib/auth";
import { Notice, Section } from "../shared";

const OWNER: Record<string, string> = {
  ceo: "the dev team", admin: "the dev team", operations: "Company Admin", finance: "Company Admin", payroll: "Company Admin", fleet: "Company Admin",
  hr: "Company Admin", client: "Company Admin", housing: "Company Admin", supervisor: "the Housing Manager", handover: "the Fleet Manager", worker: "HR",
};

export default function AccountScreen() {
  const s = useSession();
  const cos = companies.useAll();
  if (!s) return <Notice>Not signed in. Use /login to continue as a role.</Notice>;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="My Account" description="Your profile, as created at onboarding." />
      <Section title="Profile">
        <Field label="Name"><Input readOnly value={s.name} /></Field>
        <Field label="Username" hint="Fixed at creation; it never changes."><Input readOnly value={s.username} className="font-mono" /></Field>
        <Field label="Role" hint={`Role changes are made by ${OWNER[s.roleSlug] ?? "the owning role"}.`}><Input readOnly value={ROLE_LABEL[s.roleSlug] ?? s.roleSlug} /></Field>
        <Field label="Email"><Input readOnly value={s.email} /></Field>
        <Field label="Company access"><Input readOnly value={s.companyIds.map((id) => cos.find((c) => c.id === id)?.name ?? id).join(", ")} /></Field>
      </Section>
      <Section title="Password">
        <Notice>Demo mode: there is no password to change. Accounts here are role pickers, so this form is shown disabled.</Notice>
        <div className="space-y-3 opacity-70">
          <Field label="Current password"><Input disabled type="password" /></Field>
          <Field label="New password"><Input disabled type="password" /></Field>
          <Button disabled>Change password</Button>
        </div>
      </Section>
      <Section title="Account status">
        <p className="text-sm text-muted-foreground">Your account is active. You cannot deactivate or delete your own account: it is closed only when {OWNER[s.roleSlug] ?? "the owning role"} offboards you.</p>
      </Section>
    </div>
  );
}
