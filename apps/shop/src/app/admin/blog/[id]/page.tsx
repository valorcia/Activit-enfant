import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { BlogPostForm } from "@/components/admin/ops-blog-form";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("blog:write");
  const { id } = await params;
  const [post, products] = await Promise.all([
    prisma.blogPost.findUnique({ where: { id } }),
    prisma.product.findMany({ where: { status: { in: ["PUBLISHED", "SCHEDULED", "DRAFT"] } }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } }),
  ]);
  if (!post) notFound();
  return (
    <div>
      <AdminPageHeader title={post.title} breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: post.title }]} />
      <BlogPostForm products={products} post={{ ...post, scheduledAt: post.scheduledAt?.toISOString() ?? null }} />
    </div>
  );
}
