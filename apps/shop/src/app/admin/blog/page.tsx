import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

export default async function BlogAdminPage() {
  await requirePermission("blog:write");
  const posts = await prisma.blogPost.findMany({ orderBy: { updatedAt: "desc" }, include: { author: { select: { name: true, email: true } } } });
  return (
    <div>
      <AdminPageHeader title="Blog" description={`${posts.length} article${posts.length > 1 ? "s" : ""}`} actions={<Button asChild variant="admin" size="sm"><Link href="/admin/blog/nouveau"><Plus className="size-4" /> Nouvel article</Link></Button>} />
      <DataTable
        rows={posts} rowKey={(p) => p.id} empty="Aucun article. Rédigez votre premier article pour nourrir le référencement."
        columns={[
          { key: "title", header: "Titre", render: (p) => <Link href={`/admin/blog/${p.id}`} className="font-bold hover:underline">{p.title}</Link> },
          { key: "status", header: "Statut", render: (p) => <StatusPill status={p.status} /> },
          { key: "author", header: "Auteur", render: (p) => p.author?.name ?? p.author?.email ?? "—" },
          { key: "date", header: "Publication", render: (p) => <span className="text-xs text-ink-soft">{p.status === "SCHEDULED" ? `programmé ${formatDateTime(p.scheduledAt)}` : formatDateTime(p.publishedAt ?? p.updatedAt)}</span> },
          { key: "link", header: "", render: (p) => p.status === "PUBLISHED" ? <Link href={`/blog/${p.slug}`} target="_blank" className="text-xs font-bold text-coral-dark hover:underline">Voir</Link> : null },
        ]}
      />
    </div>
  );
}
