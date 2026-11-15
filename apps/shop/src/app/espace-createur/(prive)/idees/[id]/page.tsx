import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCreatorWithContract } from "@/lib/creators/session";
import { getCreatorSettings, formatPoints, formatRate } from "@/lib/creators/settings";
import { EDITABLE_STATUSES, MAX_PHOTOS, MIN_PHOTOS, parsePhotos } from "@/lib/creators/submissions";
import { SubmissionForm } from "@/components/creator/submission-form";
import { ApprovePreviewButton, DeleteDraftButton } from "@/components/creator/submission-actions";
import { SubmissionStatusBadge } from "@/components/creator/status-badge";
import { Alert } from "@/components/ui/misc";
import { formatAgeRange, formatDateTime, formatDuration } from "@/lib/utils";
import { siteAbsoluteUrl } from "@/lib/sites";

export const metadata = { title: "Mon idée" };

const NEXT_STEP: Record<string, string> = {
  SUBMITTED: "Notre équipe examine votre idée (originalité, sécurité, photos). Vous recevrez un e-mail dès la décision.",
  ACCEPTED: "Votre idée est acceptée ! Le studio va la transformer en tutoriel illustré. Vous recevrez l'aperçu à valider.",
  IN_PRODUCTION: "Le tutoriel est en fabrication dans notre studio. Vous recevrez l'aperçu à valider par e-mail.",
  APPROVED: "Merci pour votre validation ! Le tutoriel sera mis en vente très prochainement.",
  PUBLISHED: "Votre tutoriel est en vente. Chaque vente crée une commission dans votre tableau de bord.",
  REJECTED: "Cette idée n'a pas été retenue. N'hésitez pas à en proposer une autre !",
};

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const creator = await requireCreatorWithContract();
  const { id } = await params;
  const s = await prisma.creatorSubmission.findFirst({ where: { id, creatorId: creator.id }, include: { product: { select: { slug: true, status: true, site: { select: { primaryDomain: true, domains: true } } } } } });
  if (!s) notFound();
  const settings = await getCreatorSettings();
  const photos = parsePhotos(s.photos);
  const editable = EDITABLE_STATUSES.includes(s.status) && creator.status === "ACTIVE";
  const photoUrl = (i: number) => `/api/createur/soumissions/${s.id}/photos/${i}`;

  return (
    <div className="max-w-3xl">
      <Link href="/espace-createur/idees" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Mes idées</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl font-bold">{s.title}</h1>
        <SubmissionStatusBadge status={s.status} />
      </div>
      {s.status === "CHANGES_REQUESTED" && <Alert variant="warning" title="Modification demandée" className="mt-4"><span className="whitespace-pre-line">{s.moderationComment}</span><br />Modifiez votre proposition ci-dessous puis renvoyez-la.</Alert>}
      {s.status === "REJECTED" && s.moderationComment && <Alert variant="info" title="Message de l'équipe" className="mt-4"><span className="whitespace-pre-line">{s.moderationComment}</span></Alert>}
      {s.status === "ACCEPTED" && s.moderationComment && <Alert variant="success" title="Message de l'équipe" className="mt-4"><span className="whitespace-pre-line">{s.moderationComment}</span></Alert>}
      {NEXT_STEP[s.status] && <p className="mt-4 text-ink-soft">{NEXT_STEP[s.status]}</p>}
      {s.rateBp != null && ["ACCEPTED", "IN_PRODUCTION", "PREVIEW_READY", "APPROVED", "PUBLISHED"].includes(s.status) && <p className="mt-2 text-sm">Taux de redevance : <strong>{formatRate(s.rateBp)}</strong> du montant encaissé.</p>}

      {s.status === "PREVIEW_READY" && s.previewUrl && (
        <section className="card-soft mt-6 space-y-4 border-2 border-coral p-5 sm:p-6">
          <h2 className="font-heading text-xl font-bold">L&apos;aperçu de votre tutoriel est prêt</h2>
          <p className="text-ink-soft">Feuilletez-le. S&apos;il vous convient, validez-le pour qu&apos;il soit mis en vente. Une remarque ? Répondez à l&apos;e-mail reçu ou écrivez-nous.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={s.previewUrl} target="_blank" rel="noopener" className="inline-flex h-14 items-center justify-center gap-2 rounded-[var(--radius-button)] border-2 border-ink/15 bg-white px-8 font-heading text-lg font-semibold">Voir l&apos;aperçu <ExternalLink className="size-5" /></a>
            <ApprovePreviewButton id={s.id} />
          </div>
        </section>
      )}
      {s.product?.status === "PUBLISHED" && <p className="mt-4"><Link href={siteAbsoluteUrl(s.product.site, `/aventures/${s.product.slug}`)} target="_blank" className="inline-flex items-center gap-1 font-bold text-coral-dark hover:underline">Voir la fiche en vente <ExternalLink className="size-4" /></Link></p>}

      {editable ? (
        <div className="mt-6">
          <SubmissionForm
            id={s.id}
            minPhotos={MIN_PHOTOS}
            maxPhotos={MAX_PHOTOS}
            rates={{ idea: formatRate(settings.ideaRateBp), full: formatRate(settings.fullTutorialRateBp), bonus: formatPoints(settings.exclusivityBonusBp) }}
            initial={{
              title: s.title, ageMin: s.ageMin?.toString() ?? "", ageMax: s.ageMax?.toString() ?? "", durationMinutes: s.durationMinutes?.toString() ?? "",
              materials: s.materials.join("\n"), steps: s.steps.length ? s.steps : [""], tips: s.tips ?? "", safetyNotes: s.safetyNotes ?? "",
              contribution: s.contribution, exclusive: s.exclusive, photos: photos.map((p, i) => ({ ...p, preview: photoUrl(i) })),
            }}
          />
          {s.status === "DRAFT" && <div className="mt-4"><DeleteDraftButton id={s.id} /></div>}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {photos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {photos.map((_, i) => (
                <li key={i} className="aspect-square overflow-hidden rounded-xl bg-ink/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl(i)} alt={`Photo ${i + 1}`} className="size-full object-cover" loading="lazy" />
                </li>
              ))}
            </ul>
          )}
          <section className="card-soft p-5 text-sm sm:p-6">
            <p className="text-ink-soft">{formatAgeRange(s.ageMin, s.ageMax) || "Âge non précisé"}{s.durationMinutes ? ` · ${formatDuration(s.durationMinutes)}` : ""} · {s.contribution === "FULL_TUTORIAL" ? "tutoriel complet" : "idée + photos"}{s.exclusive ? " · exclusivité" : ""}</p>
            <h2 className="mt-4 font-bold">Matériel</h2>
            <ul className="mt-1 list-disc pl-5">{s.materials.map((m, i) => <li key={i}>{m}</li>)}</ul>
            <h2 className="mt-4 font-bold">Étapes</h2>
            <ol className="mt-1 list-decimal space-y-1 pl-5">{s.steps.map((m, i) => <li key={i} className="whitespace-pre-line">{m}</li>)}</ol>
            {s.tips && <><h2 className="mt-4 font-bold">Astuces</h2><p className="mt-1 whitespace-pre-line">{s.tips}</p></>}
            {s.safetyNotes && <><h2 className="mt-4 font-bold">Sécurité</h2><p className="mt-1 whitespace-pre-line">{s.safetyNotes}</p></>}
            <p className="mt-4 text-xs text-ink-muted">Envoyée le {formatDateTime(s.submittedAt)}</p>
          </section>
        </div>
      )}
    </div>
  );
}
