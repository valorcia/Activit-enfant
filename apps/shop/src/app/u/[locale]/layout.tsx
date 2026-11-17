import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/sites";
import { brandConfig, brandCurrency, brandFromParams, openLocales } from "@/lib/unwritten/brand";
import { getUwProducts } from "@/lib/unwritten/catalog";
import { getDictionary } from "@/lib/unwritten/i18n";
import { UwHeader } from "@/components/unwritten/chrome";
import { UwFooter } from "@/components/unwritten/footer";
import { UtmCapture } from "@/components/storefront/utm-capture";
import "../unwritten.css";

/**
 * Coque de la vitrine UNWRITTEN (arbre séparé, choisi par le proxy pour `Site.storefront = "unwritten"`).
 * Rendu dynamique : la marque est lue dans l'en-tête posé par le proxy (une même application
 * sert plusieurs marques). Polices sous licence SIL OFL, auto-hébergées par next/font.
 */
export const dynamic = "force-dynamic";

const serif = Cormorant_Garamond({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--uw-serif", display: "swap" });
const sans = Inter({ subsets: ["latin", "latin-ext"], variable: "--uw-sans", display: "swap" });

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { site, locale } = await brandFromParams(params);
  const dict = getDictionary(locale);
  const { seo, brand } = await getSettings(site);
  const indexable = site.status === "ACTIVE" && seo.robotsIndex;
  return {
    metadataBase: new URL(siteUrl(site)),
    title: { default: dict.meta.homeTitle, template: dict.meta.titleTemplate },
    description: dict.meta.homeDescription,
    applicationName: brand.name,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "website", siteName: "UNWRITTEN", locale: dict.meta.ogLocale },
    twitter: { card: "summary_large_image" },
    icons: { icon: [{ url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23171717'/%3E%3Cpath d='M10 9v9a6 6 0 0 0 12 0V9' fill='none' stroke='%23F7F4EE' stroke-width='1.6'/%3E%3C/svg%3E" }] },
  };
}

export default async function UnwrittenLayout({ children, params }: { children: React.ReactNode } & Params) {
  const { site, locale } = await brandFromParams(params);
  const dict = getDictionary(locale);
  const products = await getUwProducts(site.id, locale, brandCurrency(site));
  const config = brandConfig(site);
  const preview = site.status !== "ACTIVE";
  return (
    <div lang={locale} className={`uw-root ${serif.variable} ${sans.variable}`} data-brand={site.slug}>
      {/* Le document racine est partagé avec La Malle à Jeux (lang="fr") : la langue de la page est
          portée par ce conteneur (attribut lang, valide pour les lecteurs d'écran) et appliquée au
          document avant l'affichage. */}
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)}` }} />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2">{dict.common.skip}</a>
      {preview && <div className="uw-preview-bar">{dict.common.footer.test}</div>}
      <UwHeader locale={locale} locales={openLocales(site)} labels={{ ...dict.common.nav, language: dict.common.language, languages: dict.common.languages }} />
      <main id="main" className="flex-1">{children}</main>
      <UwFooter locale={locale} dict={dict} products={products} contactEmail={config.contactEmail} preview={preview} />
      <UtmCapture />
    </div>
  );
}
