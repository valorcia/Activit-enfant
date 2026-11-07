import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { Stars } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";
import { ReviewModeration } from "@/components/admin/ops-review-moderation";

export const metadata = { title: "Avis clients" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await requirePermission("reviews:moderate");
  const { statut } = await searchParams;
  const status = statut === "APPROVED" || statut === "REJECTED" ? statut : statut === "ALL" ? undefined : "PENDING";
  const [reviews, counts] = await Promise.all([
    prisma.review.findMany({ where: status ? { status } : {}, orderBy: [{ createdAt: "desc" }], take: 100, include: { product: { select: { name: true, slug: true } }, moderatedBy: { select: { email: true } } } }),
    prisma.review.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const tabs = [["PENDING", "À modérer"], ["APPROVED", "Publiés"], ["REJECTED", "Rejetés"], ["ALL", "Tous"]] as const;
  return (
    <div>
      <AdminPageHeader title="Avis clients" description="Les avis sont soumis par les clients et publiés uniquement après modération. L'administration ne crée jamais d'avis." />
      <nav className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([s, label]) => <Link key={s} href={`/admin/avis?statut=${s}`} className={`rounded-full px-4 py-1.5 text-sm font-bold ${(statut ?? "PENDING") === s ? "bg-ink text-white" : "bg-white border border-line hover:bg-ink/5"}`}>{label}{s !== "ALL" ? ` (${count(s)})` : ""}</Link>)}
      </nav>
      {reviews.length === 0 ? <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center text-sm text-ink-soft">Aucun avis dans cette file.</p> : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2"><Stars rating={r.rating} size="sm" /> <span className="font-bold">{r.title ?? "Sans titre"}</span> <StatusPill status={r.status} />{r.isVerifiedPurchase && <span className="rounded-full bg-sage-light px-2 py-0.5 text-xs font-bold text-sage-dark">Achat vérifié</span>}</p>
                  <p className="mt-1 text-xs text-ink-muted">{r.authorName} · {r.email} · {formatDateTime(r.createdAt)} · <Link href={`/aventures/${r.product.slug}`} target="_blank" className="hover:underline">{r.product.name}</Link></p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{r.body}</p>
              {r.moderatedBy && <p className="mt-2 text-xs text-ink-muted">Modéré par {r.moderatedBy.email}{r.moderationNote ? ` — ${r.moderationNote}` : ""}</p>}
              <ReviewModeration reviewId={r.id} status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
