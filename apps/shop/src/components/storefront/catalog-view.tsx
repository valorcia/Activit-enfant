import { PackageSearch } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { AGE_BUCKETS, DURATION_BUCKETS, getCategories, getUniverses, searchCatalog, type CatalogQuery } from "@/lib/catalog";
import { CatalogFilters, type CatalogFilterValues } from "./catalog-filters";
import { Pagination } from "./pagination";
import { ProductGrid } from "./product-card";

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

const SORT_VALUES = new Set(["nouveautes", "popularite", "prix-asc", "prix-desc"]);

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim().slice(0, 100) : undefined;
}

export function parseCatalogParams(sp: CatalogSearchParams): CatalogFilterValues & { page: number; focus?: string } {
  const tri = first(sp.tri);
  return {
    q: first(sp.q),
    categorie: first(sp.categorie),
    age: first(sp.age),
    theme: first(sp.theme),
    prix: first(sp.prix),
    duree: first(sp.duree),
    tri: tri && SORT_VALUES.has(tri) ? tri : undefined,
    page: Math.max(1, Number(first(sp.page)) || 1),
    focus: first(sp.focus),
  };
}

/** Vue catalogue réutilisable : filtres + grille + pagination. */
export async function CatalogView({ searchParams, basePath, fixed = {}, hideCategory = false }: { searchParams: CatalogSearchParams; basePath: string; fixed?: Partial<Pick<CatalogQuery, "category" | "collection">>; hideCategory?: boolean }) {
  const v = parseCatalogParams(searchParams);
  const query: CatalogQuery = {
    q: v.q,
    category: fixed.category ?? v.categorie,
    collection: fixed.collection,
    age: v.age,
    theme: v.theme,
    priceMax: v.prix ? Number(v.prix) || undefined : undefined,
    duration: v.duree,
    sort: v.tri as CatalogQuery["sort"],
    page: v.page,
    perPage: 24,
  };
  const [result, categories, universes] = await Promise.all([searchCatalog(query), getCategories(), getUniverses()]);
  const values: CatalogFilterValues = { q: v.q, categorie: hideCategory ? undefined : v.categorie, age: v.age, theme: v.theme, prix: v.prix, duree: v.duree, tri: v.tri };
  const paginationParams = { q: v.q, categorie: hideCategory ? undefined : v.categorie, age: v.age, theme: v.theme, prix: v.prix, duree: v.duree, tri: v.tri };

  return (
    <div>
      <CatalogFilters
        values={values}
        basePath={basePath}
        total={result.total}
        hideCategory={hideCategory}
        autofocusSearch={v.focus === "recherche"}
        categories={categories.map((c) => ({ value: c.slug, label: c.name }))}
        ages={Object.entries(AGE_BUCKETS).map(([value, b]) => ({ value, label: b.label }))}
        themes={universes.map((u) => ({ value: u, label: u }))}
        durations={Object.entries(DURATION_BUCKETS).map(([value, b]) => ({ value, label: b.label }))}
      />
      {result.items.length === 0 ? (
        <EmptyState
          icon={<PackageSearch />}
          title="Aucune aventure ne correspond à votre recherche"
          description="Essayez d'autres mots-clés ou retirez un filtre. De nouveaux kits arrivent chaque semaine !"
          action={<Button asChild variant="outline"><Link href={basePath}>Voir tout le catalogue</Link></Button>}
        />
      ) : (
        <>
          <ProductGrid products={result.items} priorityCount={4} />
          <Pagination page={result.page} pages={result.pages} basePath={basePath} params={paginationParams} className="mt-10" />
        </>
      )}
    </div>
  );
}
