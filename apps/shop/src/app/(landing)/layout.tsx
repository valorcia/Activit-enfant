import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getNewProducts, cardPrice } from "@/lib/catalog";
import { LandingHeader, type LandingProduct } from "@/components/storefront/landing-header";
import { LandingFooter } from "@/components/storefront/landing-footer";
import { ReadingProgress } from "@/components/storefront/reading-progress";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { ConsentBanner } from "@/components/storefront/consent-banner";
import { AnalyticsScripts } from "@/components/storefront/analytics-scripts";
import { UtmCapture } from "@/components/storefront/utm-capture";
import { publicAnalytics } from "@/lib/settings";
import { ExitPopup } from "@/components/storefront/exit-popup";

const getFooterPages = unstable_cache(
  async () => prisma.staticPage.findMany({ where: { status: "PUBLISHED", showInFooter: true }, orderBy: { position: "asc" }, select: { slug: true, title: true } }),
  ["footer-pages"],
  { tags: ["pages"], revalidate: 600 },
);

const THIRTY_DAYS = 30 * 24 * 3600 * 1000;

/**
 * Layout « landing » : chaque fiche /aventures/[slug] est présentée comme un
 * e-book indépendant (en-tête fin sans navigation complète, pied de page
 * compact) avec un sélecteur discret vers les autres aventures publiées.
 */
export default async function LandingLayout({ children }: { children: React.ReactNode }) {
  const [settings, products, pages] = await Promise.all([getSettings(), getNewProducts(12), getFooterPages()]);
  const now = Date.now();
  const others: LandingProduct[] = products.map((p) => {
    const price = cardPrice(p);
    return {
      slug: p.slug,
      name: p.name,
      ageMin: p.ageMin,
      ageMax: p.ageMax,
      universe: p.universe,
      priceCents: price.priceCents,
      compareAtCents: price.compareAtCents,
      currency: p.currency,
      imageUrl: p.images[0]?.url ?? null,
      isNew: !!p.publishedAt && now - new Date(p.publishedAt).getTime() < THIRTY_DAYS,
    };
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <ReadingProgress />
      <LandingHeader brand={settings.brand} products={others} />
      <main id="contenu" className="flex-1">{children}</main>
      <LandingFooter brand={settings.brand} legalPages={pages} />
      <CartDrawer withdrawalNotice={settings.commerce.withdrawalNotice} />
      <ConsentBanner enabled={settings.analytics.consentBannerEnabled} />
      <AnalyticsScripts analytics={publicAnalytics(settings.analytics)} />
      <UtmCapture />
      <ExitPopup config={settings.conversion.exitPopup} />
    </div>
  );
}
