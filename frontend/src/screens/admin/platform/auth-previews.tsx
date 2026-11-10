"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, Input } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { getRole, roles } from "@/config";
import { cn } from "@/lib/utils";
import { Section } from "../shared";

function Unavailable({ title, flow }: { title: string; flow: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-semibold">{title}: not available in demo mode</p>
      <p className="mt-1 text-sm">Accounts are not created or reset here. {flow}</p>
      <Link href="/login" className="mt-3 inline-flex h-9 items-center rounded-lg bg-foreground px-3 text-sm font-medium text-background">Go to /login to continue as a role</Link>
    </div>
  );
}

const rules = (pw: string, confirm: string) => [
  ["At least 10 characters", pw.length >= 10], ["A letter and a number", /[A-Za-z]/.test(pw) && /\d/.test(pw)],
  ["Different from the temporary password", pw.length > 0 && pw !== "temporary"], ["Both entries match", pw.length > 0 && pw === confirm],
] as const;

export function SignInScreen() {
  const landing = roles.filter((r) => r.slug !== "platform").map((r) => ({ role: r.title, slug: r.slug, page: r.pages[0] }));
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Sign-in" description="One sign-in page; each person lands on the pages of their own role." />
      <Unavailable title="Sign-in with username and password" flow="The live system would check the username and password, reject deactivated accounts, send a temporary-password user to First Login, and open the person's role pages." />
      <Section title="Preview of the live form (non-functional)">
        <div className="space-y-3 opacity-70">
          <Field label="Username"><Input disabled placeholder="ahmed.ali-0042" /></Field>
          <Field label="Password"><Input disabled type="password" placeholder="Password" /></Field>
          <div className="flex items-center gap-4"><Button disabled>Sign in</Button><span className="text-sm underline">Forgot password</span></div>
        </div>
        <p className="text-xs text-muted-foreground">There is no sign-up link: only accounts created through the onboarding workflow can sign in. In the live system a link to Forgot Password sits here; see <Link href="/platform/forgot-password" className="underline">the Forgot Password preview</Link>.</p>
      </Section>
      <Section title="Where each role lands after sign-in">
        <table className="w-full text-sm"><tbody>{landing.map((l) => <tr key={l.slug} className="border-t first:border-0"><td className="py-1.5 pe-3 font-medium">{l.role}</td><td className="text-muted-foreground">{getRole(l.slug)?.slug === "worker" ? "My Shift (workers have no home page)" : l.page.title}</td><td className="text-end"><Link className="text-xs underline" href={`/${l.slug}/${l.page.slug}`}>Open</Link></td></tr>)}</tbody></table>
      </Section>
    </div>
  );
}

export function ForgotPasswordScreen() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Forgot Password" description="The only password recovery route, done by the user." />
      <Unavailable title="Password recovery" flow="The live system would email a verification link to the address on the profile, then let the person choose a new password. No staff member can reset it for them." />
      <Section title="What the flow does (preview, non-functional)">
        <ol className="list-decimal space-y-1 ps-5 text-sm">
          <li>The person enters their username or email.</li>
          <li>A verification email goes to the address on their profile.</li>
          <li>They open the link and choose a new password.</li>
          <li>Every attempt is written to the audit log.</li>
        </ol>
        <div className="space-y-3 opacity-70"><Field label="Username or email"><Input disabled /></Field><Button disabled>Send verification</Button></div>
        <p className="text-xs text-muted-foreground">A worker with no email on file cannot use this route; HR supplies new credentials manually (to be confirmed).</p>
      </Section>
    </div>
  );
}

export function FirstLoginScreen() {
  const [pw, setPw] = useState("");
  const [c, setC] = useState("");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="First Login" description="Forced password change after signing in with a temporary password." />
      <Unavailable title="First login" flow="The live system would show this screen before anything else after a temporary-password sign-in. The temporary password expires and works once, then the person lands on their role's pages." />
      <Section title="Preview: the checks the new password must pass (nothing is saved)">
        <div className="space-y-3">
          <Field label="New password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" /></Field>
          <Field label="Confirm password"><Input type="password" value={c} onChange={(e) => setC(e.target.value)} autoComplete="off" /></Field>
          <ul className="text-sm">{rules(pw, c).map(([t, ok]) => <li key={t} className={cn(ok ? "text-emerald-700" : "text-muted-foreground")}>{ok ? "Done" : "To do"}: {t}</li>)}</ul>
          <Button disabled>Set password</Button>
        </div>
      </Section>
    </div>
  );
}
