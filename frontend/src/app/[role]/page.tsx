import { notFound, redirect } from "next/navigation";
import { getRole } from "@/config";

/** A role lands on its home page (or its first page when it has no "home"). */
export default async function RoleIndex({ params }: PageProps<"/[role]">) {
  const { role: slug } = await params;
  const role = getRole(slug);
  if (!role) notFound();
  const landing = role.pages.find((p) => p.slug === "home") ?? role.pages[0];
  redirect(`/${role.slug}/${landing.slug}`);
}
