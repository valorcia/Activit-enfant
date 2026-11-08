import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadCatalog, topSellers } from "@/lib/shop/catalog";

const eur = (c: number, cur = "EUR") => new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur }).format(c / 100);

/** Encart « Dans la boutique » du tableau de bord (rendu serveur, tolérant aux erreurs). */
export async function ShopPanel() {
  const catalog = await loadCatalog();
  if (!catalog.configured) {
    return (
      <Card>
        <CardHeader><CardTitle>Dans la boutique</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-slate-500">Boutique non reliée. <Link href="/settings" className="text-blue-700 underline">Renseignez l&apos;URL et la clé API</Link> pour voir les produits publiés et leurs ventes.</p></CardContent>
      </Card>
    );
  }
  if (catalog.error) {
    return (
      <Card>
        <CardHeader><CardTitle>Dans la boutique</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-red-700">Boutique injoignable : {catalog.error}</p></CardContent>
      </Card>
    );
  }
  const published = catalog.entries.filter((e) => e.status === "PUBLISHED").length;
  const toReview = catalog.entries.filter((e) => e.needsReview || e.status === "DRAFT").length;
  const top = await topSellers(catalog.entries, 5);
  return (
    <Card>
      <CardHeader><CardTitle>Dans la boutique</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Link href="/shop" className="rounded-lg bg-emerald-50 p-3 hover:bg-emerald-100"><div className="text-2xl font-black text-emerald-900">{published}</div><div className="text-xs text-emerald-800">publiés</div></Link>
          <Link href="/shop" className="rounded-lg bg-amber-50 p-3 hover:bg-amber-100"><div className="text-2xl font-black text-amber-900">{toReview}</div><div className="text-xs text-amber-800">brouillons à valider</div></Link>
          <Link href="/shop" className="rounded-lg bg-slate-50 p-3 hover:bg-slate-100"><div className="text-2xl font-black">{catalog.entries.filter((e) => e.linkedBook).length}</div><div className="text-xs text-slate-500">liés au studio</div></Link>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Meilleures ventes</div>
          {top.length === 0 ? <p className="text-sm text-slate-500">Aucune vente pour le moment.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {top.map(({ entry, stats }) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate font-semibold">{entry.linkedBook ? <Link href={`/books/${entry.linkedBook.id}`} className="hover:underline">{entry.name}</Link> : entry.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{entry.salesCount} vente(s){stats ? ` · ${eur(stats.total.revenueCents, stats.currency)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/shop" className="text-sm text-blue-700 hover:underline">Voir tout le catalogue</Link>
      </CardContent>
    </Card>
  );
}
