import { LoginPicker } from "@/components/login-picker";
import { RequirementsSlideOver } from "@/components/requirements-slide-over";
import { getPage, roles } from "@/config";
import { requirementViews } from "@/config/status";

export default function LoginPage() {
  const page = getPage("platform", "sign-in")!;
  return (
    <>
      <LoginPicker roles={roles.filter((r) => r.slug !== "platform").map(({ slug, title, use, layout, count }) => ({ slug, title, use, layout, count }))} />
      <RequirementsSlideOver id="platform/sign-in" title={page.title} requirements={requirementViews("platform", page)} future={page.future} />
    </>
  );
}
