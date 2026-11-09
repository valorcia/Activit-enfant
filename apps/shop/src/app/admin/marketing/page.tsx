import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, AdminCard } from "@/components/admin/page-header";
import { MarketingNav } from "@/components/admin/ops-marketing-nav";
import { Button } from "@/components/ui/button";
import { campaignRoi, periodFromKey, productRoi } from "@/lib/social/roi";
import { formatPrice } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getAdminSite } from "@/lib/sites";

export const metadata = { title: "Marketing social" };
export const dynamic = "force-dynamic";

const PERIODS = [["7j", "7 jours"], ["30j", "30 jours"], ["90j", "90 jours"], ["12m", "12 mois"], ["tout", "Tout"]] as const;

function pct(v: number | null) { return v == null ? "—" : `${Math.round(v * 100)} %`; }
function roas(v: number | null) { return v == null ? "—" : `×${v.toFixed(2)}`; }

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ periode?: string; audience?: string }> }) {
  await requirePermission("marketing:write");
  const { periode = "30j", audience: audienceSlug } = await searchParams;
  const period = periodFromKey(periode);
  // Périmètre : univers du sélecteur admin, et/ou audience choisie ici
  const [adminSite, audiences] = await Promise.all([getAdminSite(), prisma.audience.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } })]);
  const audience = audiences.find((a) => a.slug === audienceSlug) ?? null;
  const scope = { siteId: adminSite?.id ?? null, audienceId: audience?.id ?? null };
  const [products, campaigns] = await Promise.all([productRoi(period, undefined, scope), campaignRoi(period, undefined, undefined, scope)]);
  const qs = (p: Record<string, string | undefined>) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries({ periode, audience: audience?.slug, ...p })) if (v) u.set(k, v); return u.toString(); };
  const totals = products.reduce((t, p) => ({ ht: t.ht + p.revenueHtCents, spend: t.spend + p.adSpendCents, orders: t.orders + p.orders, margin: t.margin + p.marginCents, creation: t.creation + p.creationCostCents, etsyGross: t.etsyGross + p.etsy.grossCents, etsyFees: t.etsyFees + p.etsy.feesCents, etsyNet: t.etsyNet + p.etsy.netCents, etsyOrders: t.etsyOrders + p.etsy.orders }), { ht: 0, spend: 0, orders: 0, margin: 0, creation: 0, etsyGross: 0, etsyFees: 0, etsyNet: 0, etsyOrders: 0 });
  const maxHt = Math.max(1, ...products.map((p) => p.revenueHtCents));
  const sources = new Map<string, { orders: number; ht: number }>();
  for (const p of products) for (const [src, v] of Object.entries(p.bySource)) { const s = sources.get(src) ?? { orders: 0, ht: 0 }; s.orders += v.orders; s.ht += v.revenueHtCents; sources.set(src, s); }

  return (
    <div>
      <AdminPageHeader title="Marketing social" description="Rentabilité de chaque e-book : revenus de la boutique (remboursements déduits) et d'Etsy (frais déduits), dépenses publicitaires, coût de création et marge."
        actions={<>
          <div className="flex rounded-full bg-white border border-line p-0.5">{PERIODS.map(([k, l]) => <Link key={k} href={`/admin/marketing?${qs({ periode: k })}`} className={`rounded-full px-3 py-1 text-xs font-bold ${periode === k ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}>{l}</Link>)}</div>
          <Button asChild variant="outline" size="sm"><a href={`/api/admin/marketing/export?${qs({})}`}>Exporter CSV</a></Button>
        </>} />
      <MarketingNav />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold uppercase tracking-wide text-ink-muted">Audience</span>
        {[{ slug: "", name: "Toutes" }, ...audiences].map((a) => (
          <Link key={a.slug || "all"} href={`/admin/marketing?${qs({ audience: a.slug || undefined })}`} className={`rounded-full px-3 py-1 font-bold ${(audience?.slug ?? "") === a.slug ? "bg-ink text-white" : "bg-white border border-line text-ink-soft hover:text-ink"}`}>{a.name}</Link>
        ))}
        <span className="ml-auto text-ink-muted">Univers : {adminSite ? adminSite.name : "tous"} (sélecteur en haut du menu)</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 mb-6">
        {[["Revenus HT", formatPrice(totals.ht)], ["Commandes", String(totals.orders)], ["Dépenses pub", formatPrice(totals.spend)], ["Coût de création", formatPrice(totals.creation)], ["Marge", formatPrice(totals.margin)]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{l}</p><p className={`mt-1 font-heading text-2xl font-bold ${l === "Marge" && totals.margin < 0 ? "text-red-600" : ""}`}>{v}</p></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <AdminCard title="Rentabilité par e-book" description="ROAS = revenus HT / dépenses publicitaires. La marge déduit les dépenses pub et le coût de création (saisi dans la fiche produit, onglet Prix).">
          {products.length === 0 ? <p className="text-sm text-ink-soft">Aucun produit.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-muted border-b border-line"><th className="py-2 pr-3">E-book</th><th className="py-2 pr-3 text-right">Cmd.</th><th className="py-2 pr-3 text-right">Revenus HT</th><th className="py-2 pr-3 text-right" title="Ventes Etsy : brut / net après frais">Etsy</th><th className="py-2 pr-3 text-right">Pub</th><th className="py-2 pr-3 text-right">Création</th><th className="py-2 pr-3 text-right">Marge</th><th className="py-2 pr-3 text-right">ROAS</th><th className="py-2 text-right">Coût/cmd</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.productId} className="border-b border-line/60 last:border-0 align-top">
                      <td className="py-2.5 pr-3">
                        <Link href={`/admin/produits/${p.productId}`} className="font-semibold hover:underline">{p.name}</Link>
                        <div className="mt-1 h-1.5 w-40 rounded-full bg-ink/5"><div className="h-1.5 rounded-full bg-coral" style={{ width: `${Math.round((p.revenueHtCents / maxHt) * 100)}%` }} /></div>
                      </td>
                      <td className="py-2.5 pr-3 text-right">{p.orders}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold">{formatPrice(p.revenueHtCents)}</td>
                      <td className="py-2.5 pr-3 text-right">{p.etsy.orders ? <><span className="font-semibold">{formatPrice(p.etsy.netCents)}</span><span className="block text-xs text-ink-muted">{p.etsy.orders} vente(s) · brut {formatPrice(p.etsy.grossCents)} · frais {formatPrice(p.etsy.feesCents)}</span></> : "—"}</td>
                      <td className="py-2.5 pr-3 text-right">{formatPrice(p.adSpendCents)}</td>
                      <td className="py-2.5 pr-3 text-right">{formatPrice(p.creationCostCents)}</td>
                      <td className={`py-2.5 pr-3 text-right font-bold ${p.marginCents < 0 ? "text-red-600" : "text-sage-dark"}`}>{formatPrice(p.marginCents)} <span className="text-xs font-normal text-ink-muted">({pct(p.marginRate)})</span></td>
                      <td className="py-2.5 pr-3 text-right">{roas(p.roas)}</td>
                      <td className="py-2.5 text-right">{p.costPerOrderCents != null ? formatPrice(p.costPerOrderCents) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
        <div className="space-y-6">
          <AdminCard title="Ventes par source" description="D'après les paramètres UTM capturés au premier contact (30 jours) ; « etsy » = ventes importées depuis Etsy (net).">
            {sources.size === 0 ? <p className="text-sm text-ink-soft">Aucune vente sur la période.</p> : (
              <ul className="space-y-2 text-sm">{[...sources.entries()].sort((a, b) => b[1].ht - a[1].ht).map(([src, v]) => (
                <li key={src} className="flex items-center justify-between"><span className="font-semibold capitalize">{src}</span><span>{v.orders} cmd · {formatPrice(v.ht)}</span></li>
              ))}</ul>
            )}
          </AdminCard>
          {totals.etsyOrders > 0 && (
            <AdminCard title="Canal Etsy" actions={<Button asChild size="sm" variant="outline"><Link href="/admin/marketing/etsy">Détail</Link></Button>}>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt>Ventes</dt><dd>{totals.etsyOrders}</dd></div>
                <div className="flex justify-between"><dt>Brut (payé par les acheteurs)</dt><dd>{formatPrice(totals.etsyGross)}</dd></div>
                <div className="flex justify-between"><dt>Frais Etsy estimés</dt><dd>− {formatPrice(totals.etsyFees)}</dd></div>
                <div className="flex justify-between font-bold"><dt>Net (compté en revenus HT)</dt><dd>{formatPrice(totals.etsyNet)}</dd></div>
              </dl>
            </AdminCard>
          )}
          <AdminCard title="Campagnes" actions={<Button asChild size="sm" variant="outline"><Link href="/admin/marketing/campagnes">Toutes</Link></Button>}>
            {campaigns.length === 0 ? <p className="text-sm text-ink-soft">Aucune campagne. <Link href="/admin/marketing/campagnes/nouvelle" className="underline">Créer la première</Link>.</p> : (
              <ul className="space-y-2 text-sm">{campaigns.slice(0, 6).map((c) => (
                <li key={c.campaignId} className="flex items-center justify-between gap-2"><Link href={`/admin/marketing/campagnes/${c.campaignId}`} className="font-semibold hover:underline truncate">{c.name}</Link><span className="shrink-0 text-ink-soft">{c.orders} cmd · {roas(c.roas)}</span></li>
              ))}</ul>
            )}
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
