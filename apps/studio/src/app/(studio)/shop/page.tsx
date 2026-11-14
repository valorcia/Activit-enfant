import Link from "next/link";
import { ExternalLink, Store } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImportProductButton } from "@/components/shop/import-button";
import { loadCatalog } from "@/lib/shop/catalog";
import { kitLabel } from "@/lib/kits/types";
import { loadSites } from "@/lib/universes";
import { DEFAULT_SITE_SLUG, SITE_STATUS_LABELS } from "@/lib/universes/sites";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "default" }> = {
  PUBLISHED: { label: "Publié", variant: "success" },
  DRAFT: { label: "Brouillon", variant: "secondary" },
  SCHEDULED: { label: "Programmé", variant: "default" },
  ARCHIVED: { label: "Archivé", variant: "secondary" },
};

const euros = (cents: number, currency = "EUR") => new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);

export default async function ShopCatalogPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const [{ configured, entries: all, error, baseUrl }, { sites, source }, sp] = await Promise.all([loadCatalog(), loadSites(), searchParams]);
  const siteOf = (e: (typeof all)[number]) => e.site?.slug ?? sites[0]?.slug ?? DEFAULT_SITE_SLUG;
  const siteName = (slug: string) => sites.find((x) => x.slug === slug)?.name ?? all.find((e) => e.site?.slug === slug)?.site?.name ?? slug;
  const current = sp.site && sites.some((x) => x.slug === sp.site) ? sp.site : null;
  const entries = current ? all.filter((e) => siteOf(e) === current) : all;
  const published = entries.filter((e) => e.status === "PUBLISHED").length;
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <PageHeader
        title="Boutique"
        description={configured ? `${entries.length} produit(s) dans la boutique · ${published} publié(s) · ${entries.filter((e) => e.linkedBook).length} lié(s) à un livre du studio` : "Catalogue de la boutique La Malle à Jeux"}
        actions={baseUrl ? <Button asChild variant="secondary"><a href={`${baseUrl}/admin/produits`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Admin boutique</a></Button> : undefined}
      />
      {!configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          La boutique n&apos;est pas encore reliée. Renseignez son URL et une clé API dans <Link href="/settings" className="underline font-semibold">Paramètres → Boutique</Link> (clé créée dans l&apos;admin de la boutique, rubrique API &amp; automatisation).
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Impossible de lire le catalogue : {error}</div>}
      {configured && !error && entries.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Aucun produit dans la boutique pour l&apos;instant.</div>}
      {configured && sites.length > 1 && (
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Filtrer par univers">
          <span className="text-slate-500">Univers :</span>
          <Link href="/shop" className={`rounded-full border px-3 py-1 ${!current ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}>Tous ({all.length})</Link>
          {sites.map((x) => (
            <Link key={x.slug} href={`/shop?site=${encodeURIComponent(x.slug)}`} className={`rounded-full border px-3 py-1 ${current === x.slug ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
              {x.name} ({all.filter((e) => siteOf(e) === x.slug).length}){x.status !== "ACTIVE" ? ` · ${SITE_STATUS_LABELS[x.status]}` : ""}
            </Link>
          ))}
        </nav>
      )}
      {configured && source === "fallback" && <p className="mb-4 text-xs text-slate-500">Boutique mono-univers : tous les produits sont rattachés à « {sites[0]?.name} ».</p>}
      {entries.length > 0 && (
        <ul className="grid gap-3">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {e.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Store className="m-5 h-6 w-6 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{e.name}</span>
                  <Badge variant={STATUS[e.status]?.variant ?? "secondary"}>{STATUS[e.status]?.label ?? e.status}</Badge>
                  {e.needsReview && <Badge variant="warning">À valider</Badge>}
                  <Badge variant="secondary">{siteName(siteOf(e))}</Badge>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {e.category?.name ?? "Sans catégorie"} · {e.salePriceCents ? <><s>{euros(e.priceCents, e.currency)}</s> {euros(e.salePriceCents, e.currency)}</> : euros(e.priceCents, e.currency)} · {e.salesCount} vente(s)
                </div>
                <div className="flex flex-wrap gap-3 text-xs mt-1">
                  {e.publicUrl && <a href={e.publicUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Voir la fiche</a>}
                  <a href={e.editUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Admin boutique</a>
                </div>
              </div>
              <div className="text-right">
                {e.linkedBook ? (
                  <Link href={`/books/${e.linkedBook.id}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                    Lié au livre « {e.linkedBook.title} »
                  </Link>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <ImportProductButton productId={e.id} name={e.name} />
                    <span className="text-[11px] text-slate-400">Type proposé : {kitLabel(e.suggestedKitType)}</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
