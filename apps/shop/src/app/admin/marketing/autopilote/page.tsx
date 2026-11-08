import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { MarketingNav } from "@/components/admin/ops-marketing-nav";
import { AutopilotApprove } from "@/components/admin/ops-autopilot-approve";
import { campaignRoi, periodFromKey } from "@/lib/social/roi";
import { formatDateTime, formatPrice } from "@/lib/utils";

export const metadata = { title: "Autopilote marketing" };
export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = { FEED_IMAGE: "Image (fil)", REEL_COVER: "Reel", STORY: "Story", CAROUSEL: "Carrousel", TIKTOK_PHOTO: "TikTok photo", TIKTOK_VIDEO: "TikTok vidéo", AD_PRIMARY_TEXT: "Publicité Meta" };

export default async function AutopilotPage() {
  await requirePermission("marketing:write");
  const [campaigns, accounts] = await Promise.all([
    prisma.campaign.findMany({
      where: { source: "api" }, orderBy: { createdAt: "desc" }, take: 50,
      include: { product: { select: { name: true, slug: true, status: true } }, posts: { orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }], include: { account: { select: { name: true } } } } },
    }),
    prisma.socialAccount.count({ where: { isActive: true, needsReconnect: false, kind: { in: ["PAGE", "INSTAGRAM", "TIKTOK"] } } }),
  ]);
  const roi = new Map((await campaignRoi(periodFromKey("tout"))).map((r) => [r.campaignId, r]));

  return (
    <div>
      <AdminPageHeader title="Autopilote" description="Campagnes et publications créées automatiquement par le studio à la sortie de chaque e-book. Vérifiez les textes, puis validez pour programmer la publication." />
      <MarketingNav />
      {accounts === 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Aucun compte social connecté : les publications restent en brouillon, prêtes à copier. <Link href="/admin/marketing/connecteurs" className="font-semibold underline">Connecter Meta ou TikTok</Link>
        </div>
      )}
      {campaigns.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink-soft">
          Aucune campagne autopilote pour l&apos;instant. Elles apparaissent ici quand le studio publie un e-book avec l&apos;option « Créer les publicités ».
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => {
            const drafts = c.posts.filter((p) => p.status === "DRAFT").length;
            const stats = roi.get(c.id);
            return (
              <section key={c.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/admin/marketing/campagnes/${c.id}`} className="font-heading text-lg font-bold hover:underline">{c.name}</Link>
                    <p className="text-xs text-ink-muted">{c.product?.name ?? "Boutique"} · utm_campaign={c.slug} · créée le {formatDateTime(c.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <StatusPill status={c.status === "ACTIVE" ? "PUBLISHED" : c.status === "ENDED" ? "ARCHIVED" : c.status === "PAUSED" ? "PENDING" : "DRAFT"} />
                    {stats && <span className="text-ink-soft">{stats.orders} cmd · {formatPrice(stats.revenueHtCents)} HT{stats.roas != null ? ` · ROAS ×${stats.roas.toFixed(2)}` : ""}</span>}
                  </div>
                </header>
                <ul className="mt-4 divide-y divide-line/60 text-sm">
                  {c.posts.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{FORMAT_LABELS[p.format] ?? p.format}</span>
                        {p.variantLabel && <span className="text-ink-muted"> · {p.variantLabel}</span>}
                        <span className="block truncate text-ink-soft">{p.hook ?? p.body}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-ink-muted">
                        {p.videoUrl && <span className="rounded-full bg-lavender-light px-2 py-0.5 font-bold text-lavender-dark">Vidéo</span>}
                        {p.account?.name ?? "Sans compte"}
                        {p.scheduledAt && <span>· {formatDateTime(p.scheduledAt)}</span>}
                        <StatusPill status={p.status === "PUBLISHED" ? "PUBLISHED" : p.status === "SCHEDULED" ? "SCHEDULED" : p.status === "FAILED" ? "FAILED" : "DRAFT"} />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <Link href={`/admin/marketing/posts?campagne=${c.id}`} className="text-sm font-semibold text-ink-soft hover:text-ink">Modifier les textes →</Link>
                  <AutopilotApprove campaignId={c.id} draftCount={drafts} disabledReason={c.product && c.product.status !== "PUBLISHED" ? "Publiez d'abord l'e-book dans la boutique" : accounts === 0 ? "Connectez au moins un compte social pour programmer" : null} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
