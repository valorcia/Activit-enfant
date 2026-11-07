import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { BlogPostForm } from "@/components/admin/ops-blog-form";

export const metadata = { title: "Nouvel article" };

export default async function NewPostPage() {
  await requirePermission("blog:write");
  const products = await prisma.product.findMany({ where: { status: { in: ["PUBLISHED", "SCHEDULED", "DRAFT"] } }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
  return (
    <div>
      <AdminPageHeader title="Nouvel article" breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "Nouveau" }]} />
      <BlogPostForm products={products} />
    </div>
  );
}
