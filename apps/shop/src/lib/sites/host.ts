/**
 * Résolution pure (sans base) de l'univers d'une requête, testable.
 * Ordre : domaine exact (www. ignoré ; Actif puis Test) → sous-domaine du domaine hub → cookie de prévisualisation → univers par défaut.
 */
export interface SiteRouting {
  slug: string;
  status: "ACTIVE" | "TEST" | "ARCHIVED";
  domains: string[];
  isDefault: boolean;
}

export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "").replace(/\.$/, "");
}

/** Domaine nettoyé (minuscules, sans schéma, chemin, port ni point final) ; le www. est conservé. */
export function cleanDomain(domain: string | null | undefined): string {
  if (!domain) return "";
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/:\d+$/, "").replace(/\.$/, "");
}

/** Liste de domaines d'un univers : dédoublonnée, sans www. (la résolution l'ignore : un domaine couvre les deux). */
export function normalizeDomainList(domains: string[]): string[] {
  return [...new Set(domains.map((d) => normalizeHost(d.replace(/^https?:\/\//, "").split("/")[0])).filter(Boolean))];
}

export function defaultSiteSlug(sites: SiteRouting[], fallback: string): string {
  return sites.find((s) => s.isDefault)?.slug ?? sites.find((s) => s.status === "ACTIVE")?.slug ?? fallback;
}

export function resolveSiteSlug(
  sites: SiteRouting[],
  input: { host?: string | null; hubDomain?: string | null; previewSlug?: string | null },
  fallback: string,
): string {
  const host = normalizeHost(input.host);
  const live = sites.filter((s) => s.status !== "ARCHIVED");
  if (host) {
    // Domaine exact : un univers Actif d'abord ; un univers Test est aussi servi sur son domaine
    // (non indexé) pour vérifier DNS et rendu avant l'ouverture.
    const owns = (s: SiteRouting) => s.domains.some((d) => normalizeHost(d) === host);
    const exact = live.find((s) => s.status === "ACTIVE" && owns(s)) ?? live.find(owns);
    if (exact) return exact.slug;
    const hub = normalizeHost(input.hubDomain);
    if (hub && host.endsWith(`.${hub}`)) {
      const sub = host.slice(0, -(hub.length + 1));
      const bySub = live.find((s) => s.slug === sub);
      if (bySub) return bySub.slug;
    }
  }
  if (input.previewSlug) {
    const preview = live.find((s) => s.slug === input.previewSlug);
    if (preview) return preview.slug;
  }
  return defaultSiteSlug(live.length ? live : sites, fallback);
}

/** URL publique d'un univers : domaine principal, sinon premier domaine, sinon URL de l'application. */
export function siteBaseUrl(site: { primaryDomain?: string | null; domains?: string[] }, appUrl: string): string {
  const domain = cleanDomain(site.primaryDomain || site.domains?.[0]);
  return domain ? `https://${domain}` : appUrl.replace(/\/$/, "");
}

/** Suffixe de libellé bancaire Stripe (≤ 22 caractères, caractères autorisés uniquement). */
export function statementDescriptorSuffix(name: string): string {
  const ascii = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[<>\\'"*]/g, "").replace(/[^A-Za-z0-9 .\-&]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  const cut = ascii.slice(0, 22).trim();
  return /[A-Z]/.test(cut) ? cut : "BOUTIQUE";
}
