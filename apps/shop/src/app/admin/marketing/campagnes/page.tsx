import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { MarketingNav } from "@/components/admin/ops-marketing-nav";
import { Button } from "@/components/ui/button";
import { campaignRoi, periodFromKey } from "@/lib/social/roi";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "Campagnes" };
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await requirePermission("marketing:write");
  const rows = await campaignRoi(periodFromKey("tout"));
  return (
    <div>
      <AdminPageHeader title="Campagnes" description="Une campagne = un lien tracé (UTM) vers un e-book, ses posts et ses dépenses. Les ventes sont attribuées au premier contact."
        actions={<Button asChild variant="admin" size="sm"><Link href="/admin/marketing/campagnes/nouvelle"><Plus className="size-4" /> Nouvelle campagne</Link></Button>} />
      <MarketingNav />
      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink-soft">Aucune campagne. Créez-en une pour obtenir un lien tracé et suivre sa rentabilité.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-muted border-b border-line"><th className="px-4 py-3">Campagne</th><th className="px-4 py-3">E-book</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Cmd.</th><th className="px-4 py-3 text-right">Revenus HT</th><th className="px-4 py-3 text-right">Dépenses</th><th className="px-4 py-3 text-right">ROAS</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.campaignId} className="border-b border-line/60 last:border-0 hover:bg-cream/40">
                  <td className="px-4 py-3"><Link href={`/admin/marketing/campagnes/${c.campaignId}`} className="font-semibold hover:underline">{c.name}</Link><p className="text-xs text-ink-muted">utm_campaign={c.slug}</p></td>
                  <td className="px-4 py-3">{c.productName ?? "Boutique"}</td>
                  <td className="px-4 py-3">{c.channel}</td>
                  <td className="px-4 py-3"><StatusPill status={c.status === "ACTIVE" ? "PUBLISHED" : c.status === "ENDED" ? "ARCHIVED" : c.status === "PAUSED" ? "PENDING" : "DRAFT"} /></td>
                  <td className="px-4 py-3 text-right">{c.orders}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPrice(c.revenueHtCents)}</td>
                  <td className="px-4 py-3 text-right">{formatPrice(c.adSpendCents)}</td>
                  <td className="px-4 py-3 text-right">{c.roas == null ? "—" : `×${c.roas.toFixed(2)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
