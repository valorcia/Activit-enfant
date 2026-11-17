import { isLocale, UNWRITTEN_ROUTE_PREFIX, type Locale } from "./constants";
import { negotiateLocale, parsePublicPath, switchLocale } from "./i18n/routing";

/**
 * Décision de routage (pure, testable) pour une page publique d'une marque à vitrine UNWRITTEN :
 *  - `/` ou chemin sans langue → redirection vers la langue mémorisée (cookie), sinon Accept-Language,
 *    sinon la langue par défaut de la marque ;
 *  - `/{langue ouverte}/…` → réécriture vers l'arbre interne `/u/{langue}/{segments internes}` ;
 *  - `/{langue fermée}/…` → redirection vers la même page dans la langue par défaut.
 */
export type UnwrittenRoute =
  | { type: "redirect"; location: string }
  | { type: "rewrite"; pathname: string; locale: Locale; rememberLocale: boolean };

export function routeUnwritten(input: {
  pathname: string;
  search: string;
  locales: string[];
  defaultLocale: string;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): UnwrittenRoute {
  const open = input.locales;
  const preferred = isLocale(input.cookieLocale) && open.includes(input.cookieLocale) ? input.cookieLocale : negotiateLocale(input.acceptLanguage, open, input.defaultLocale);
  const parsed = parsePublicPath(input.pathname);
  if (!parsed.locale) {
    const rest = parsed.unknownLocale ? "" : input.pathname === "/" ? "" : input.pathname;
    return { type: "redirect", location: `/${preferred}${rest}${input.search}` };
  }
  if (!open.includes(parsed.locale)) {
    const fallback = negotiateLocale(null, open, input.defaultLocale);
    return { type: "redirect", location: `${switchLocale(input.pathname, fallback)}${input.search}` };
  }
  return {
    type: "rewrite",
    pathname: `${UNWRITTEN_ROUTE_PREFIX}/${parsed.locale}${parsed.internal}`,
    locale: parsed.locale,
    rememberLocale: input.cookieLocale !== parsed.locale,
  };
}
