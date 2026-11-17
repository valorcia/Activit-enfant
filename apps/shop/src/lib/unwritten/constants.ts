/**
 * Constantes de la vitrine UNWRITTEN (sans dépendance serveur : utilisables dans le proxy,
 * les composants client et les tests).
 */

/** Identifiant de la vitrine dans `Site.storefront`. */
export const UNWRITTEN_STOREFRONT = "unwritten";
/** Slug de la marque créée par le seed (au statut TEST, aperçu par `/?site=unwritten`). */
export const UNWRITTEN_SITE_SLUG = "unwritten";
export const UNWRITTEN_SITE_ID = "site-unwritten";

/** Préfixe interne des routes réécrites par le proxy (`/u/<locale>/…`). */
export const UNWRITTEN_ROUTE_PREFIX = "/u";

/** Langues dont la vitrine possède les dictionnaires (l'ouverture au public se règle par marque). */
export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Cookie de la langue choisie (mémorisée à chaque visite d'une URL localisée). */
export const LOCALE_COOKIE = "uw_locale";
/** Cookie httpOnly signé : brouillons de personnalisation de ce navigateur. */
export const DRAFTS_COOKIE = "uw_drafts";
/** Cookie d'attribution : paramètre `ref` de la première visite (aucune donnée personnelle). */
export const REF_COOKIE = "uw_ref";
export const REF_COOKIE_DAYS = 30;

/** Paramètre `ref` : lettres, chiffres, tirets et soulignés, 64 caractères au plus. */
export function sanitizeRef(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().slice(0, 64);
  return /^[A-Za-z0-9_-]+$/.test(v) ? v : null;
}

/** Collections de départ (clé stable utilisée par le studio). */
export const COLLECTION_KEYS = ["secret-book", "before-its-too-late", "movie-of-my-life"] as const;
export type CollectionKey = (typeof COLLECTION_KEYS)[number];

/** Modes de remplissage d'un brouillon. */
export const DRAFT_MODES = ["self", "gift", "gift_recipient"] as const;
export type DraftMode = (typeof DRAFT_MODES)[number];
