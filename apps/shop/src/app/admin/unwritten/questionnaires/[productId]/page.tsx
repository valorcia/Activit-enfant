import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { PublishVersionButton, QuestionnaireEditor } from "@/components/admin/unwritten-admin";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Questionnaire" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { ACTIVE: "Publiée", DRAFT: "Brouillon", ARCHIVED: "Archivée" };

/** Édition JSON validée d'un questionnaire : chaque enregistrement crée une version. */
export default async function QuestionnaireEditPage({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<{ v?: string }> }) {
  await requirePermission("products:write");
  const { productId } = await params;
  const { v } = await searchParams;
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { personalization: true, questionnaires: { orderBy: { version: "desc" } } } });
  if (!product?.personalization) notFound();
  const base = product.questionnaires.find((q) => String(q.version) === v) ?? product.questionnaires.find((q) => q.status === "ACTIVE") ?? product.questionnaires[0];
  const initialJson = base ? JSON.stringify(base.definition, null, 2) : JSON.stringify({ schemaVersion: 1, steps: [] }, null, 2);
  return (
    <div className="space-y-6">
      <AdminPageHeader title={`Questionnaire · ${product.name}`} breadcrumbs={[{ label: "Questionnaires", href: "/admin/unwritten/questionnaires" }, { label: product.name }]} description={base ? `Point de départ : version ${base.version} (${STATUS[base.status]})` : undefined} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <AdminCard title="Définition (JSON)" description="Types : single, multi, text, longtext, date, number, info. Conditions : { q, op: eq|neq|in|nin|includes|answered|empty, value } combinables avec all, any, not. Textes obligatoires en anglais et en français.">
          <QuestionnaireEditor productId={product.id} initialJson={initialJson} />
        </AdminCard>
        <AdminCard title="Versions">
          <ul className="space-y-3 text-sm">
            {product.questionnaires.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-2">
                <a href={`?v=${q.version}`} className="hover:underline"><strong>v{q.version}</strong> · {STATUS[q.status]}<span className="block text-xs text-ink-muted">{formatDateTime(q.createdAt)}{q.createdBy ? ` · ${q.createdBy}` : ""}{q.note ? ` · ${q.note}` : ""}</span></a>
                {q.status !== "ACTIVE" && <PublishVersionButton questionnaireId={q.id} />}
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>
    </div>
  );
}
