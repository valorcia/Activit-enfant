import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, AdminCard } from "@/components/admin/page-header";
import { MarketingNav } from "@/components/admin/ops-marketing-nav";
import { CampaignForm } from "@/components/admin/ops-campaign-form";
import { campaignToForm } from "@/lib/admin/campaign-form-data";
import { CampaignSpend } from "@/components/admin/ops-campaign-spend";
import { CopyField } from "@/components/admin/ops-copy-field";
import { DeleteCampaignButton } from "@/components/admin/ops-campaign-delete";
import { Button } from "@/components/ui/button";
import { campaignRoi, periodFromKey } from "@/lib/social/roi";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("marketing:write");
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id }, include: { spends: { orderBy: { date: "desc" } }, posts: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, provider: true, format: true, variantLabel: true, hook: true, scheduledAt: true } } } });
  if (!campaign) notFound();
  const [products, adAccounts, roi] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.socialAccount.findMany({ where: { kind: "AD_ACCOUNT", isActive: true }, select: { id: true, name: true, provider: true } }),
    campaignRoi(periodFromKey("tout"), undefined, id),
  ]);
  const r = roi[0];
  return (
    <div>
      <AdminPageHeader title={campaign.name} breadcrumbs={[{ label: "Marketing social", href: "/admin/marketing" }, { label: "Campagnes", href: "/admin/marketing/campagnes" }, { label: campaign.name }]}
        actions={<><Button asChild size="sm" variant="outline"><Link href={`/admin/marketing/posts?campagne=${campaign.id}${campaign.productId ? `&produit=${campaign.productId}` : ""}`}>Générer des posts</Link></Button><DeleteCampaignButton id={campaign.id} /></>} />
      <MarketingNav />
      {r && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[["Commandes", String(r.orders)], ["Revenus HT", formatPrice(r.revenueHtCents)], ["Dépenses", formatPrice(r.adSpendCents)], ["ROAS", r.roas == null ? "—" : `×${r.roas.toFixed(2)}`], ["Coût / commande", r.costPerOrderCents != null ? formatPrice(r.costPerOrderCents) : "—"]].map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{l}</p><p className="mt-1 font-heading text-2xl font-bold">{v}</p></div>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <AdminCard title="Lien tracé" description="À utiliser dans toutes les publications et publicités de cette campagne. Les ventes qui en découlent sont attribuées à la campagne.">
            <CopyField value={campaign.landingUrl} />
          </AdminCard>
          <AdminCard title="Dépenses publicitaires">
            <CampaignSpend campaignId={campaign.id} canSync={Boolean(campaign.adAccountId && campaign.externalCampaignId)} rows={campaign.spends.map((s) => ({ id: s.id, date: s.date.toISOString(), spendCents: s.spendCents, impressions: s.impressions, clicks: s.clicks, source: s.source }))} />
          </AdminCard>
          <AdminCard title="Posts rattachés" actions={<Button asChild size="sm" variant="outline"><Link href={`/admin/marketing/posts?campagne=${campaign.id}`}>Voir</Link></Button>}>
            {campaign.posts.length === 0 ? <p className="text-sm text-ink-soft">Aucun post. Générez des variantes depuis l'onglet Posts & publicités.</p> : (
              <ul className="divide-y divide-line text-sm">{campaign.posts.map((p) => <li key={p.id} className="flex items-center justify-between py-2"><span className="truncate"><span className="font-semibold">{p.provider} · {p.variantLabel ?? p.format}</span> <span className="text-ink-soft">{p.hook}</span></span><span className="shrink-0 text-xs text-ink-muted">{p.status}</span></li>)}</ul>
            )}
          </AdminCard>
        </div>
        <AdminCard title="Paramètres">
          <CampaignForm initial={campaignToForm(campaign)} products={products} adAccounts={adAccounts} />
        </AdminCard>
      </div>
    </div>
  );
}
