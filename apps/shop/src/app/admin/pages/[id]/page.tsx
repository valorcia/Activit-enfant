import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StaticPageForm } from "@/components/admin/ops-page-form";

export const dynamic = "force-dynamic";

export default async function EditStaticPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("pages:write");
  const { id } = await params;
  const page = await prisma.staticPage.findUnique({ where: { id } });
  if (!page) notFound();
  return (
    <div>
      <AdminPageHeader title={page.title} breadcrumbs={[{ label: "Pages", href: "/admin/pages" }, { label: page.title }]} />
      <StaticPageForm page={page} />
    </div>
  );
}
