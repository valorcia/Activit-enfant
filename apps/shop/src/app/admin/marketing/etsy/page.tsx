import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, AdminCard } from "@/components/admin/page-header";
import { MarketingNav } from "@/components/admin/ops-marketing-nav";
import { SiteTargetNotice } from "@/components/admin/site-target-notice";
import { EtsySettingsForm, EtsySyncButton, etsyStateLabel } from "@/components/admin/ops-etsy";
import { Alert, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { getSetting } from "@/lib/settings";
import { getAdminSite, getDefaultSite } from "@/lib/sites";
import { isEtsyConfigured } from "@/lib/channels/etsy";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata = { title: "Etsy" };
export const dynamic = "force-dynamic";

const STATE_VARIANT: Record<string, "success" | "warning" | "soft" | "outline"> = { active: "success", draft: "outline", inactive: "soft", expired: "warning", removed: "warning", pending: "soft" };

export default async function EtsyPage() {
  await requirePermission("marketing:write");
  const adminSite = await getAdminSite();
  const site = adminSite ?? (await getDefaultSite());
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [settings, accounts, categories, listings, sales, totals, configured] = await Promise.all([
    getSetting("etsy", adminSite?.id ?? null),
    prisma.socialAccount.findMany({ where: { provider: "ETSY", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, needsReconnect: true } }),
    prisma.category.findMany({ where: adminSite ? { siteId: adminSite.id } : {}, orderBy: { position: "asc" }, select: { slug: true, name: true } }),
    prisma.etsyListing.findMany({
      where: adminSite ? { product: { siteId: adminSite.id } } : {},
      orderBy: { updatedAt: "desc" }, take: 200,
      include: { product: { select: { id: true, name: true, priceCents: true } }, account: { select: { name: true } }, _count: { select: { sales: true } } },
    }),
    prisma.externalSale.findMany({
      where: { channel: "ETSY", ...(adminSite ? { siteId: adminSite.id } : {}) },
      orderBy: { soldAt: "desc" }, take: 50,
      include: { product: { select: { id: true, name: true } } },
    }),
    prisma.externalSale.aggregate({
      where: { channel: "ETSY", soldAt: { gte: since }, ...(adminSite ? { siteId: adminSite.id } : {}) },
      _sum: { grossCents: true, feesCents: true, netCents: true, quantity: true }, _count: true,
    }),
    isEtsyConfigured(),
  ]);
  const uniqueCats = [...new Map(categories.map((c) => [c.slug, c])).values()];
  const lastSync = listings.reduce<Date | null>((m, l) => (l.lastSyncedAt && (!m || l.lastSyncedAt > m) ? l.lastSyncedAt : m), null);
  return (
    <div>
      <AdminPageHeader
        title="Etsy"
        description="Publiez vos e-books en téléchargement numérique sur votre boutique Etsy, suivez l'état des fiches et importez les ventes dans la rentabilité. La synchronisation automatique a lieu une fois par jour (tâche planifiée marketing)."
        actions={accounts.length ? <EtsySyncButton /> : undefined}
      />
      <MarketingNav />
      {!configured && <Alert variant="warning" className="mb-4">Clés de l&apos;application Etsy manquantes : renseignez-les dans <Link className="underline" href="/admin/parametres?onglet=integration">Paramètres → Intégrations</Link> (voir docs/ETSY.md).</Alert>}
      {configured && accounts.length === 0 && <Alert variant="info" className="mb-4">Aucune boutique connectée : cliquez sur « Connecter Etsy » dans <Link className="underline" href="/admin/marketing/connecteurs">Connecteurs</Link>.</Alert>}
      {accounts.some((a) => a.needsReconnect) && <Alert variant="danger" className="mb-4">Une boutique Etsy doit être reconnectée (autorisation expirée ou révoquée).</Alert>}

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Ventes Etsy (30 j)", value: String(totals._sum.quantity ?? 0) },
          { label: "Chiffre d'affaires brut", value: formatPrice(totals._sum.grossCents ?? 0) },
          { label: "Frais Etsy estimés", value: formatPrice(totals._sum.feesCents ?? 0) },
          { label: "Net", value: formatPrice(totals._sum.netCents ?? 0) },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-soft">{k.label}</p><p className="mt-1 font-heading text-2xl font-bold">{k.value}</p></div>
        ))}
      </div>

      <AdminCard title="Fiches Etsy" description={lastSync ? `Dernière synchronisation : ${formatDate(lastSync)}` : "Jamais synchronisées."} className="mb-6">
        {listings.length === 0 ? (
          <EmptyState title="Aucune fiche Etsy" description="Ouvrez un produit et utilisez la section Etsy, ou activez l'étape Etsy de l'autopilote du studio." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-soft"><tr><th className="py-2 pr-3">Produit</th><th className="pr-3">État</th><th className="pr-3">Prix Etsy</th><th className="pr-3">Ventes</th><th className="pr-3">Boutique</th><th className="pr-3">Synchro</th><th /></tr></thead>
              <tbody className="divide-y divide-line">
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3"><Link href={`/admin/produits/${l.product.id}`} className="font-semibold hover:underline">{l.product.name}</Link>{l.lastError && <p className="text-xs text-red-700">{l.lastError}</p>}</td>
                    <td className="pr-3"><Badge variant={STATE_VARIANT[l.state] ?? "soft"}>{etsyStateLabel(l.state)}</Badge></td>
                    <td className="pr-3">{l.priceCents != null ? formatPrice(l.priceCents, l.currency) : "—"}</td>
                    <td className="pr-3">{l._count.sales}</td>
                    <td className="pr-3 text-ink-soft">{l.account.name}</td>
                    <td className="pr-3 text-ink-soft">{l.lastSyncedAt ? formatDate(l.lastSyncedAt) : "—"}</td>
                    <td>{l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline">Etsy ↗</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <AdminCard title="Dernières ventes Etsy" description="Importées depuis les reçus Etsy payés ; frais estimés selon les hypothèses ci-dessous." className="mb-6">
        {sales.length === 0 ? <p className="text-sm text-ink-soft">Aucune vente importée.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-soft"><tr><th className="py-2 pr-3">Date</th><th className="pr-3">Produit</th><th className="pr-3">Qté</th><th className="pr-3">Brut</th><th className="pr-3">Frais</th><th className="pr-3">Net</th></tr></thead>
              <tbody className="divide-y divide-line">
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3">{formatDate(s.soldAt)}</td>
                    <td className="pr-3">{s.product ? <Link href={`/admin/produits/${s.product.id}`} className="hover:underline">{s.product.name}</Link> : <span className="text-ink-muted">Fiche non liée ({s.etsyListingId ?? "?"})</span>}</td>
                    <td className="pr-3">{s.quantity}</td>
                    <td className="pr-3">{formatPrice(s.grossCents, s.currency)}</td>
                    <td className="pr-3">{s.feesCents != null ? formatPrice(s.feesCents, s.currency) : "—"}</td>
                    <td className="pr-3 font-semibold">{s.netCents != null ? formatPrice(s.netCents, s.currency) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <AdminCard title="Réglages Etsy de l'univers">
        <SiteTargetNotice site={site} explicit={Boolean(adminSite)} scope="settings" />
        <EtsySettingsForm initial={settings} accounts={accounts} categories={uniqueCats} siteName={site.name} />
      </AdminCard>
    </div>
  );
}
