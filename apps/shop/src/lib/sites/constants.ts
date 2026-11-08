/** Identifiant fixe de l'univers par défaut (La Malle à Jeux), valeur par défaut des colonnes siteId. */
export const DEFAULT_SITE_ID = "site-default";
export const DEFAULT_SITE_SLUG = "la-malle-a-jeux";
/** En-tête posé par le proxy : slug de l'univers résolu pour la requête. */
export const SITE_HEADER = "x-site-slug";
/** Cookie de prévisualisation d'un univers (posé par /?site=<slug>). */
export const PREVIEW_COOKIE = "site_preview";
/** Cookie de l'admin : univers sélectionné (slug) ou « all ». */
export const ADMIN_SITE_COOKIE = "admin_site";
export const SITES_TAG = "sites";
/** Préfixe interne des routes publiques réécrites par le proxy (/s/<slug>/…). */
export const SITE_ROUTE_PREFIX = "/s";
