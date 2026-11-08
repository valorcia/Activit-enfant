import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getPublicSite, getSites, siteUrl } from "@/lib/sites";
import { ThemeHead } from "@/components/theme/theme-provider";

export const revalidate = 300;

type Params = { params: Promise<{ site: string }> };

/** Pré-génère chaque univers en ligne ou en test (les pages enfants combinent univers × slugs). */
export async function generateStaticParams() {
  const sites = await getSites();
  return sites.filter((s) => s.status !== "ARCHIVED").map((s) => ({ site: s.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const site = await getPublicSite((await params).site);
  if (!site) return {};
  const { seo, brand } = await getSettings(site);
  return {
    metadataBase: new URL(siteUrl(site)),
    title: { default: seo.defaultTitle, template: seo.titleTemplate },
    description: seo.defaultDescription,
    applicationName: brand.name,
    robots: seo.robotsIndex && site.status === "ACTIVE" ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "website", siteName: brand.name, locale: "fr_FR", images: seo.ogImageUrl ? [seo.ogImageUrl] : undefined },
    twitter: { card: "summary_large_image" },
    icons: brand.faviconUrl ? { icon: brand.faviconUrl } : undefined,
    verification: {
      ...(seo.googleSiteVerification ? { google: seo.googleSiteVerification } : {}),
      ...(seo.facebookDomainVerification ? { other: { "facebook-domain-verification": seo.facebookDomainVerification } } : {}),
    },
  };
}

/**
 * Coque d'un univers : thème (couleurs, polices, rayon, texture) propre à l'univers,
 * appliqué par-dessus le thème par défaut du document racine.
 */
export default async function SiteLayout({ children, params }: { children: React.ReactNode } & Params) {
  const site = await getPublicSite((await params).site);
  if (!site) notFound();
  const { theme } = await getSettings(site);
  return (
    <div data-site={site.slug} data-radius={theme.radius} data-texture={theme.texture ? "on" : "off"} className="bg-paper-texture min-h-dvh">
      <ThemeHead theme={theme} />
      {children}
    </div>
  );
}
