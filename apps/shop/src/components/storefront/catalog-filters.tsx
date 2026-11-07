"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FilterOption { value: string; label: string }

export interface CatalogFilterValues {
  q?: string;
  categorie?: string;
  age?: string;
  theme?: string;
  prix?: string;
  duree?: string;
  tri?: string;
}

interface Props {
  values: CatalogFilterValues;
  categories?: FilterOption[];
  ages: FilterOption[];
  themes: FilterOption[];
  durations: FilterOption[];
  basePath: string;
  total: number;
  autofocusSearch?: boolean;
  /** Masque le filtre catégorie (pages catégorie). */
  hideCategory?: boolean;
}

const SORTS: FilterOption[] = [
  { value: "nouveautes", label: "Nouveautés" },
  { value: "popularite", label: "Popularité" },
  { value: "prix-asc", label: "Prix croissant" },
  { value: "prix-desc", label: "Prix décroissant" },
];
const PRICES: FilterOption[] = [
  { value: "5", label: "Jusqu'à 5 €" },
  { value: "10", label: "Jusqu'à 10 €" },
  { value: "15", label: "Jusqu'à 15 €" },
  { value: "25", label: "Jusqu'à 25 €" },
];

export function CatalogFilters({ values, categories, ages, themes, durations, basePath, total, autofocusSearch, hideCategory }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autofocusSearch) searchRef.current?.focus(); }, [autofocusSearch]);

  const label = (opts: FilterOption[] | undefined, v?: string) => opts?.find((o) => o.value === v)?.label ?? v;
  const active: Array<{ key: keyof CatalogFilterValues; label: string }> = [];
  if (values.q) active.push({ key: "q", label: `« ${values.q} »` });
  if (values.categorie && !hideCategory) active.push({ key: "categorie", label: label(categories, values.categorie) ?? "" });
  if (values.age) active.push({ key: "age", label: label(ages, values.age) ?? "" });
  if (values.theme) active.push({ key: "theme", label: values.theme });
  if (values.prix) active.push({ key: "prix", label: label(PRICES, values.prix) ?? "" });
  if (values.duree) active.push({ key: "duree", label: label(durations, values.duree) ?? "" });

  const hrefWithout = (key: keyof CatalogFilterValues) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) if (v && k !== key) sp.set(k, v);
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  function submitSort(tri: string) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) if (v && k !== "tri") sp.set(k, v);
    if (tri && tri !== "nouveautes") sp.set("tri", tri);
    router.push(`${pathname}?${sp.toString()}`);
  }

  const selectClass = "h-10 text-sm";

  return (
    <div className="mb-6 space-y-3">
      <form method="get" action={basePath} className="card-soft p-3 sm:p-4" role="search" aria-label="Rechercher et filtrer les produits">
        {values.tri && <input type="hidden" name="tri" value={values.tri} />}
        {hideCategory && values.categorie && <input type="hidden" name="categorie" value={values.categorie} />}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input ref={searchRef} type="search" name="q" defaultValue={values.q ?? ""} placeholder="Rechercher une aventure, un thème…" aria-label="Rechercher" className="pl-11" />
          </div>
          <Button type="submit" className="hidden sm:inline-flex">Rechercher</Button>
          <Button type="button" variant="outline" size="icon" className="sm:hidden" aria-expanded={open} aria-controls="filtres-panneau" aria-label="Filtres" onClick={() => setOpen((o) => !o)}>
            <SlidersHorizontal className="size-5" />
          </Button>
          <Button type="button" variant="outline" className="hidden sm:inline-flex" aria-expanded={open} aria-controls="filtres-panneau" onClick={() => setOpen((o) => !o)}>
            <SlidersHorizontal className="size-4" /> Filtres{active.length > 0 && ` (${active.length})`}
          </Button>
        </div>

        <div id="filtres-panneau" className={cn("mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5", !open && active.length === 0 && "hidden")}>
          {!hideCategory && categories && categories.length > 0 && (
            <label className="text-xs font-bold text-ink-soft">Catégorie
              <NativeSelect name="categorie" defaultValue={values.categorie ?? ""} className={selectClass}><option value="">Toutes</option>{categories.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
            </label>
          )}
          <label className="text-xs font-bold text-ink-soft">Âge
            <NativeSelect name="age" defaultValue={values.age ?? ""} className={selectClass}><option value="">Tous les âges</option>{ages.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
          </label>
          <label className="text-xs font-bold text-ink-soft">Thème
            <NativeSelect name="theme" defaultValue={values.theme ?? ""} className={selectClass}><option value="">Tous les thèmes</option>{themes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
          </label>
          <label className="text-xs font-bold text-ink-soft">Prix
            <NativeSelect name="prix" defaultValue={values.prix ?? ""} className={selectClass}><option value="">Tous les prix</option>{PRICES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
          </label>
          <label className="text-xs font-bold text-ink-soft">Durée
            <NativeSelect name="duree" defaultValue={values.duree ?? ""} className={selectClass}><option value="">Toutes</option>{durations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit" size="sm">Appliquer</Button>
            {active.length > 0 && <Button asChild type="button" size="sm" variant="ghost"><Link href={basePath}>Réinitialiser</Link></Button>}
          </div>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-ink-soft" aria-live="polite">{total} résultat{total > 1 ? "s" : ""}</p>
          {active.map((a) => (
            <Link key={a.key} href={hrefWithout(a.key)} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold shadow-card hover:bg-coral-light" aria-label={`Retirer le filtre ${a.label}`}>
              {a.label} <X className="size-3" />
            </Link>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm font-bold text-ink-soft">
          Trier
          <NativeSelect value={values.tri ?? "nouveautes"} onChange={(e) => submitSort(e.target.value)} className="h-9 w-auto text-sm" aria-label="Trier les produits">
            {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </label>
      </div>
    </div>
  );
}
