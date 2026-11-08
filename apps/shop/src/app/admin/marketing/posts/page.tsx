import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MarketingNav } from "@/components/admin/ops-marketing-nav";
import { PostGenerator } from "@/components/admin/ops-post-generator";
import { PostCard, type PostView } from "@/components/admin/ops-post-card";
import { isClaudeConfigured } from "@/lib/social/copywriter-claude";
import { parseVideoAlt } from "@/lib/api/video";
import { adminSiteWhere } from "@/lib/sites";

export const metadata = { title: "Posts & publicités" };
export const dynamic = "force-dynamic";

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ produit?: string; campagne?: string; statut?: string }> }) {
  await requirePermission("marketing:write");
  const sp = await searchParams;
  const siteWhere = await adminSiteWhere();
  const [products, campaigns, accounts, posts] = await Promise.all([
    prisma.product.findMany({ where: { ...siteWhere, status: { in: ["PUBLISHED", "SCHEDULED", "DRAFT"] } }, select: { id: true, name: true, images: { select: { url: true, alt: true, role: true }, orderBy: { position: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.campaign.findMany({ where: siteWhere, select: { id: true, name: true, productId: true, channel: true }, orderBy: { createdAt: "desc" } }),
    prisma.socialAccount.findMany({ where: { isActive: true, kind: { in: ["PAGE", "INSTAGRAM", "TIKTOK"] } }, select: { id: true, name: true, provider: true, kind: true, needsReconnect: true } }),
    prisma.socialPost.findMany({
      where: { ...(siteWhere.siteId ? { OR: [{ product: { siteId: siteWhere.siteId } }, { campaign: { siteId: siteWhere.siteId } }] } : {}), ...(sp.produit ? { productId: sp.produit } : {}), ...(sp.campagne ? { campaignId: sp.campagne } : {}), ...(sp.statut ? { status: sp.statut as "DRAFT" } : {}) },
      orderBy: { createdAt: "desc" }, take: 60,
      include: { product: { select: { name: true, slug: true } }, account: { select: { name: true, kind: true } }, campaign: { select: { name: true } } },
    }),
  ]);
  const views: PostView[] = posts.map((p) => ({
    id: p.id, provider: p.provider, format: p.format, status: p.status, hook: p.hook, body: p.body, cta: p.cta, headline: p.headline, hashtags: p.hashtags, imageUrls: p.imageUrls, videoUrl: p.videoUrl, linkUrl: p.linkUrl,
    scheduledAt: p.scheduledAt?.toISOString() ?? null, publishedAt: p.publishedAt?.toISOString() ?? null, externalUrl: p.externalUrl, error: p.error, generatedBy: p.generatedBy, variantLabel: p.variantLabel,
    accountId: p.accountId, campaignId: p.campaignId, productId: p.productId, productName: p.product?.name ?? null, accountName: p.account?.name ?? null, campaignName: p.campaign?.name ?? null,
  }));
  return (
    <div>
      <AdminPageHeader title="Posts & publicités" description="Générez des variantes de publications pour un e-book, retouchez-les, puis publiez (comptes connectés) ou copiez-les dans vos outils." />
      <MarketingNav />
      <PostGenerator products={products.map((p) => ({ id: p.id, name: p.name, videos: p.images.filter((i) => i.role === "VIDEO").map((i) => { const v = parseVideoAlt(i.alt); return { url: i.url, label: `${v.format ? `${v.format} · ` : ""}${v.title}` }; }) }))} campaigns={campaigns} apiAvailable={await isClaudeConfigured()} defaults={{ productId: sp.produit ?? "", campaignId: sp.campagne ?? "" }} />
      <section className="mt-8">
        <h2 className="mb-3 font-heading text-lg font-bold">{views.length} post{views.length > 1 ? "s" : ""}{sp.campagne || sp.produit ? " (filtrés)" : ""}</h2>
        {views.length === 0 ? <p className="rounded-2xl border-2 border-dashed border-line bg-white/60 p-8 text-center text-sm text-ink-soft">Aucun post pour l'instant. Utilisez le générateur ci-dessus.</p> : (
          <div className="grid gap-4 xl:grid-cols-2">
            {views.map((p) => <PostCard key={p.id} post={p} accounts={accounts} campaigns={campaigns} productImages={products.find((x) => x.id === p.productId)?.images.filter((i) => i.role !== "VIDEO").map((i) => i.url) ?? []} productVideos={products.find((x) => x.id === p.productId)?.images.filter((i) => i.role === "VIDEO").map((i) => { const v = parseVideoAlt(i.alt); return { url: i.url, label: `${v.format ? `${v.format} · ` : ""}${v.title}` }; }) ?? []} />)}
          </div>
        )}
      </section>
    </div>
  );
}
