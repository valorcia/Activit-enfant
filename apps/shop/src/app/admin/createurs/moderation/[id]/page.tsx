import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { CreatorsNav, Pill } from "@/components/admin/creators/creators-nav";
import { LinkProductForm, ModerationForm } from "@/components/admin/ops-creators";
import { SUBMISSION_STATUS_LABELS, parsePhotos } from "@/lib/creators/submissions";
import { formatRate, getCreatorSettings, rateForSubmission } from "@/lib/creators/settings";
import { formatAgeRange, formatDateTime, formatDuration } from "@/lib/utils";
import { studioUrl } from "@/lib/studio-link";

export const metadata = { title: "Proposition" };
export const dynamic = "force-dynamic";

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("creators:read");
  const { id } = await params;
  const s = await prisma.creatorSubmission.findUnique({
    where: { id },
    include: { creator: true, product: { select: { id: true, name: true, slug: true, status: true } }, moderatedBy: { select: { email: true } } },
  });
  if (!s || s.status === "DRAFT") notFound();
  const settings = await getCreatorSettings();
  const suggested = s.rateBp ?? s.creator.defaultRateBp ?? rateForSubmission(s, settings);
  const photos = parsePhotos(s.photos);
  const canWrite = roleCan(user.role, "creators:write");
  const studio = studioUrl();

  return (
    <div>
      <AdminPageHeader title={s.title} breadcrumbs={[{ label: "Créatrices", href: "/admin/createurs" }, { label: "Modération", href: "/admin/createurs/moderation" }, { label: s.title }]} />
      <CreatorsNav current="/admin/createurs/moderation" />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <AdminCard title="Photos" description={`${photos.length} photo(s) — vérifiez qu'aucun visage d'enfant n'est reconnaissable.`}>
            {photos.length === 0 ? <p className="text-sm text-ink-soft">Aucune photo.</p> : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((_, i) => (
                  <li key={i}>
                    <a href={`/api/admin/createurs/soumissions/${s.id}/photos/${i}`} target="_blank" rel="noopener" className="block aspect-square overflow-hidden rounded-xl bg-ink/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/admin/createurs/soumissions/${s.id}/photos/${i}`} alt={`Photo ${i + 1}`} className="size-full object-cover" loading="lazy" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
          <AdminCard title="L'idée">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt className="text-xs font-bold text-ink-muted">Âge</dt><dd>{formatAgeRange(s.ageMin, s.ageMax) || "—"}</dd></div>
              <div><dt className="text-xs font-bold text-ink-muted">Durée</dt><dd>{s.durationMinutes ? formatDuration(s.durationMinutes) : "—"}</dd></div>
              <div><dt className="text-xs font-bold text-ink-muted">Apport</dt><dd>{s.contribution === "FULL_TUTORIAL" ? "Tutoriel complet" : "Idée + photos"}{s.exclusive ? " · exclusivité" : ""}</dd></div>
            </dl>
            <h3 className="mt-5 text-sm font-bold">Matériel</h3>
            <ul className="mt-1 list-disc pl-5 text-sm">{s.materials.map((m, i) => <li key={i}>{m}</li>)}</ul>
            <h3 className="mt-5 text-sm font-bold">Étapes</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{s.steps.map((m, i) => <li key={i} className="whitespace-pre-line">{m}</li>)}</ol>
            {s.tips && <><h3 className="mt-5 text-sm font-bold">Astuces</h3><p className="mt-1 whitespace-pre-line text-sm">{s.tips}</p></>}
            <h3 className="mt-5 text-sm font-bold">Consignes de sécurité</h3>
            <p className="mt-1 whitespace-pre-line text-sm">{s.safetyNotes || "Aucune indiquée — vérifiez si une étape demande un adulte."}</p>
          </AdminCard>
        </div>
        <div className="space-y-5">
          <AdminCard title="Statut">
            <p className="flex flex-wrap items-center gap-2"><Pill status={s.status} label={SUBMISSION_STATUS_LABELS[s.status]} /></p>
            <p className="mt-2 text-xs text-ink-muted">Par {s.creator.publicName ?? s.creator.name} ({s.creator.name}) · envoyée le {formatDateTime(s.submittedAt)}</p>
            {s.moderatedAt && <p className="mt-1 text-xs text-ink-muted">Décision du {formatDateTime(s.moderatedAt)}{s.moderatedBy ? ` par ${s.moderatedBy.email}` : ""}</p>}
            {s.moderationComment && <p className="mt-3 whitespace-pre-line rounded-xl bg-cream px-3 py-2 text-sm">{s.moderationComment}</p>}
            {s.rateBp != null && <p className="mt-3 text-sm">Taux retenu : <strong>{formatRate(s.rateBp)}</strong></p>}
            {s.previewUrl && <p className="mt-3 text-sm"><a href={s.previewUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-bold text-coral-dark hover:underline">Aperçu envoyé <ExternalLink className="size-3.5" /></a>{s.approvedAt ? ` · validé le ${formatDateTime(s.approvedAt)}` : ""}</p>}
            {s.product && <p className="mt-3 text-sm">Produit : <Link href={`/admin/produits/${s.product.id}`} className="font-bold hover:underline">{s.product.name}</Link> ({s.product.status === "PUBLISHED" ? "en vente" : s.product.status.toLowerCase()}){s.status === "APPROVED" && s.product.status !== "PUBLISHED" ? " — la créatrice a validé : vous pouvez le publier." : ""}</p>}
            {s.studioBookId && studio && <p className="mt-2 text-sm"><a href={`${studio}/books/${s.studioBookId}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold hover:underline">Livre dans le studio <ExternalLink className="size-3.5" /></a></p>}
          </AdminCard>
          {canWrite && ["SUBMITTED", "CHANGES_REQUESTED", "ACCEPTED"].includes(s.status) && (
            <AdminCard title="Décision"><ModerationForm id={s.id} status={s.status} suggestedRateBp={suggested} /></AdminCard>
          )}
          {canWrite && !s.product && ["ACCEPTED", "IN_PRODUCTION", "PREVIEW_READY", "APPROVED"].includes(s.status) && (
            <AdminCard title="Lier à un produit" description="Le studio le fait automatiquement à la publication ; à utiliser pour un produit créé à la main.">
              <LinkProductForm id={s.id} />
            </AdminCard>
          )}
        </div>
      </div>
    </div>
  );
}
