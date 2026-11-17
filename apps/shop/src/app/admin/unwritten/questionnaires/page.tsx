import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";
import { adminPersonalizedSites } from "@/lib/unwritten/admin";
import { lintDefinition } from "@/lib/unwritten/questionnaire/engine";
import { parseDefinition } from "@/lib/unwritten/questionnaire/schema";

export const metadata = { title: "Questionnaires" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { ACTIVE: "Publiée", DRAFT: "Brouillon", ARCHIVED: "Archivée" };

export default async function QuestionnairesPage() {
  await requirePermission("products:read");
  const sites = await adminPersonalizedSites();
  const products = await prisma.product.findMany({
    where: { siteId: { in: sites.map((s) => s.id) }, personalization: { isNot: null } },
    include: { questionnaires: { orderBy: { version: "desc" }, take: 5 } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div>
      <AdminPageHeader title="Questionnaires" description="Définitions versionnées (JSON validé) : étapes, questions, conditions d'affichage, champs obligatoires et sensibles, textes EN/FR." />
      {!products.length ? <EmptyState title="Aucun produit personnalisé" /> : (
        <div className="grid gap-4">
          {products.map((p) => {
            const active = p.questionnaires.find((q) => q.status === "ACTIVE");
            const parsed = active ? parseDefinition(active.definition) : null;
            const lint = parsed?.ok ? lintDefinition(parsed.definition) : null;
            return (
              <AdminCard key={p.id} title={p.name} actions={<Link href={`/admin/unwritten/questionnaires/${p.id}`} className="text-sm font-bold underline">Modifier</Link>}>
                <p className="text-sm">{active ? <>Version publiée : <strong>v{active.version}</strong>{lint ? ` · ${lint.min} à ${lint.max} questions visibles` : ""}</> : <strong className="text-red-700">Aucune version publiée : le produit ne peut pas être personnalisé</strong>}</p>
                {lint?.warnings.map((w) => <p key={w} className="mt-1 text-xs text-amber-800">{w}</p>)}
                <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                  {p.questionnaires.map((q) => <li key={q.id} className="rounded-full border border-line bg-white px-2.5 py-1">v{q.version} · {STATUS[q.status]} · {formatDateTime(q.createdAt)}</li>)}
                </ul>
              </AdminCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
