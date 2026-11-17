import { isLocale, SUPPORTED_LOCALES, type Locale } from "../constants";

/**
 * URLs localisées de la vitrine UNWRITTEN (fonctions pures, utilisées par le proxy et les pages).
 * L'URL publique est `/{locale}/{segment localisé}/…` ; l'arbre interne est `src/app/u/[locale]/{segment interne}/…`.
 * Les slugs des produits et des collections sont communs aux langues (une seule fiche par produit).
 */

export const ROUTE_SEGMENTS = {
  books: { en: "books", fr: "livres" },
  collections: { en: "collections", fr: "collections" },
  create: { en: "create", fr: "creer" },
  review: { en: "review", fr: "recapitulatif" },
  resume: { en: "resume", fr: "reprendre" },
  order: { en: "order", fr: "commande" },
  confirmation: { en: "confirmation", fr: "confirmation" },
  gift: { en: "gift", fr: "cadeau" },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteKey = keyof typeof ROUTE_SEGMENTS;

/** Segment interne (clé) correspondant à un segment public localisé, sinon le segment tel quel. */
function toInternalSegment(locale: Locale, segment: string): string {
  for (const [key, l10n] of Object.entries(ROUTE_SEGMENTS)) if (l10n[locale] === segment) return key;
  return segment;
}

function toPublicSegment(locale: Locale, segment: string): string {
  return segment in ROUTE_SEGMENTS ? ROUTE_SEGMENTS[segment as RouteKey][locale] : segment;
}

/** Construit une URL publique localisée : `href("fr", "books", "the-secret-book")` → `/fr/livres/the-secret-book`. */
export function href(locale: Locale, ...parts: Array<RouteKey | string>): string {
  const segs = parts.filter(Boolean).map((p) => toPublicSegment(locale, p));
  return `/${locale}${segs.length ? `/${segs.join("/")}` : ""}`;
}

export interface ParsedPublicPath {
  locale: Locale | null;
  /** Code de langue présent mais non pris en charge par les dictionnaires (ex. « de »). */
  unknownLocale?: string;
  /** Chemin interne après la langue, avec segments internes (ex. `/books/the-secret-book`). */
  internal: string;
}

/** Analyse un chemin public (`/fr/livres/x` → { locale: "fr", internal: "/books/x" }). */
export function parsePublicPath(pathname: string): ParsedPublicPath {
  const segs = pathname.split("/").filter(Boolean);
  const first = segs[0];
  if (!first || !isLocale(first)) {
    if (first && /^[a-z]{2}$/.test(first)) return { locale: null, unknownLocale: first, internal: `/${segs.slice(1).join("/")}` };
    return { locale: null, internal: pathname || "/" };
  }
  const rest = segs.slice(1).map((s, i) => (i <= 2 ? toInternalSegment(first, s) : s));
  return { locale: first, internal: rest.length ? `/${rest.join("/")}` : "" };
}

/** Même page dans une autre langue (sélecteur de langue, hreflang). */
export function switchLocale(pathname: string, to: Locale): string {
  const parsed = parsePublicPath(pathname);
  if (!parsed.locale) return `/${to}`;
  const segs = parsed.internal.split("/").filter(Boolean);
  return href(to, ...segs);
}

/** Alternatives hreflang d'une page (langues ouvertes de la marque) + x-default. */
export function hreflangAlternates(base: string, openLocales: readonly string[], defaultLocale: string, ...parts: Array<RouteKey | string>): Record<string, string> {
  const root = base.replace(/\/$/, "");
  const out: Record<string, string> = {};
  for (const l of SUPPORTED_LOCALES) if (openLocales.includes(l)) out[l] = `${root}${href(l, ...parts)}`;
  const def = isLocale(defaultLocale) && openLocales.includes(defaultLocale) ? defaultLocale : (Object.keys(out)[0] as Locale | undefined);
  if (def) out["x-default"] = `${root}${href(def, ...parts)}`;
  return out;
}

/**
 * Négociation de la langue à partir de l'en-tête Accept-Language (q-valeurs, sous-étiquette primaire),
 * restreinte aux langues ouvertes ; repli sur la langue par défaut.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined, open: readonly string[], fallback: string): Locale {
  const allowed = SUPPORTED_LOCALES.filter((l) => open.includes(l));
  const def: Locale = isLocale(fallback) && allowed.includes(fallback) ? fallback : allowed[0] ?? "en";
  if (!acceptLanguage) return def;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    const hit = allowed.find((l) => l === tag || l === primary);
    if (hit) return hit;
  }
  return def;
}
