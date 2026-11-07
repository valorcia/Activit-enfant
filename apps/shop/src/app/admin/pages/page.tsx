import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

export default async function PagesAdminPage() {
  await requirePermission("pages:write");
  const pages = await prisma.staticPage.findMany({ orderBy: { position: "asc" } });
  const legalDrafts = pages.filter((p) => p.status !== "PUBLISHED" && ["mentions-legales", "cgv", "confidentialite", "cookies", "retractation"].includes(p.slug));
  return (
    <div>
      <AdminPageHeader title="Pages" description="Pages éditoriales et juridiques (mentions légales, CGV, confidentialité, cookies, rétractation, FAQ, contact)." actions={<Button asChild variant="admin" size="sm"><Link href="/admin/pages/nouveau"><Plus className="size-4" /> Nouvelle page</Link></Button>} />
      <Alert variant="warning" title="Textes juridiques à valider avant mise en production" className="mb-4">
        Les textes juridiques fournis par défaut sont des emplacements. Faites-les rédiger ou valider par un professionnel, puis publiez-les.{legalDrafts.length > 0 ? ` ${legalDrafts.length} page(s) juridique(s) encore non publiée(s) : ${legalDrafts.map((p) => p.title).join(", ")}.` : ""}
      </Alert>
      <DataTable
        rows={pages} rowKey={(p) => p.id} empty="Aucune page."
        columns={[
          { key: "title", header: "Titre", render: (p) => <Link href={`/admin/pages/${p.id}`} className="font-bold hover:underline">{p.title}</Link> },
          { key: "slug", header: "URL", render: (p) => <code className="text-xs">/pages/{p.slug}</code> },
          { key: "status", header: "Statut", render: (p) => <StatusPill status={p.status} /> },
          { key: "footer", header: "Pied de page", render: (p) => (p.showInFooter ? "Oui" : "Non") },
          { key: "updated", header: "Modifiée", render: (p) => <span className="text-xs text-ink-soft">{formatDateTime(p.updatedAt)}</span> },
        ]}
      />
    </div>
  );
}
