import Link from "next/link";
import type { CreatorSubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CreatorsNav, Pill } from "@/components/admin/creators/creators-nav";
import { SUBMISSION_STATUS_LABELS, parsePhotos } from "@/lib/creators/submissions";
import { formatAgeRange, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Modération des idées" };
export const dynamic = "force-dynamic";

const TABS: Array<[string, string, CreatorSubmissionStatus[] | null]> = [
  ["a-moderer", "À modérer", ["SUBMITTED"]],
  ["a-modifier", "En modification", ["CHANGES_REQUESTED"]],
  ["fabrication", "En fabrication", ["ACCEPTED", "IN_PRODUCTION", "PREVIEW_READY"]],
  ["valides", "Aperçu validé", ["APPROVED"]],
  ["en-vente", "En vente", ["PUBLISHED"]],
  ["refuses", "Refusées", ["REJECTED"]],
  ["tous", "Toutes", null],
];

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ file?: string }> }) {
  await requirePermission("creators:read");
  const { file } = await searchParams;
  const tab = TABS.find((t) => t[0] === file) ?? TABS[0];
  const [subs, counts] = await Promise.all([
    prisma.creatorSubmission.findMany({
      where: tab[2] ? { status: { in: tab[2] } } : { status: { not: "DRAFT" } },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: 200,
      include: { creator: { select: { name: true, publicName: true } }, product: { select: { id: true, name: true, status: true } } },
    }),
    prisma.creatorSubmission.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (statuses: CreatorSubmissionStatus[] | null) => counts.filter((c) => (statuses ? statuses.includes(c.status) : c.status !== "DRAFT")).reduce((s, c) => s + c._count, 0);

  return (
    <div>
      <AdminPageHeader title="Modération des idées" description="Originalité, sécurité pour les enfants (verre, colle chaude, petites pièces…), qualité des photos, pas de visage d'enfant reconnaissable. Chaque décision est envoyée par e-mail à la créatrice." />
      <CreatorsNav current="/admin/createurs/moderation" badges={{ "/admin/createurs/moderation": count(["SUBMITTED"]) }} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Files">
        {TABS.map(([key, label, statuses]) => (
          <Link key={key} href={`/admin/createurs/moderation?file=${key}`} className={`rounded-full px-3 py-1 text-xs font-bold ${tab[0] === key ? "bg-coral text-white" : "border border-line bg-white hover:bg-ink/5"}`}>{label} ({count(statuses)})</Link>
        ))}
      </nav>
      {subs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center text-sm text-ink-soft">Aucune proposition dans cette file.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {subs.map((s) => {
            const photos = parsePhotos(s.photos);
            return (
              <li key={s.id}>
                <Link href={`/admin/createurs/moderation/${s.id}`} className="flex gap-3 rounded-2xl border border-line bg-white p-3 hover:border-ink/30">
                  <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-ink/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photos.length > 0 && <img src={`/api/admin/createurs/soumissions/${s.id}/photos/0`} alt="" className="size-full object-cover" loading="lazy" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-tight">{s.title}</p>
                    <p className="mt-1 text-xs text-ink-muted">{s.creator.publicName ?? s.creator.name} · {s.submittedAt ? formatDateTime(s.submittedAt) : "non envoyée"}</p>
                    <p className="mt-1 text-xs text-ink-muted">{formatAgeRange(s.ageMin, s.ageMax) || "âge non précisé"} · {photos.length} photo(s) · {s.contribution === "FULL_TUTORIAL" ? "tutoriel complet" : "idée"}{s.exclusive ? " · exclusivité" : ""}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-2"><Pill status={s.status} label={SUBMISSION_STATUS_LABELS[s.status]} />{s.product && <span className="text-xs text-ink-muted">→ {s.product.name}</span>}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
