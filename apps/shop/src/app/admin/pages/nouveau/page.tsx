import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StaticPageForm } from "@/components/admin/ops-page-form";

export const metadata = { title: "Nouvelle page" };

export default async function NewStaticPage() {
  await requirePermission("pages:write");
  return (
    <div>
      <AdminPageHeader title="Nouvelle page" breadcrumbs={[{ label: "Pages", href: "/admin/pages" }, { label: "Nouvelle" }]} />
      <StaticPageForm />
    </div>
  );
}
