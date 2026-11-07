import { getSettings } from "@/lib/settings";
import { getCategories } from "@/lib/catalog";
import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { ConsentBanner } from "@/components/storefront/consent-banner";
import { AnalyticsScripts } from "@/components/storefront/analytics-scripts";
import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";

const getFooterPages = unstable_cache(
  async () => prisma.staticPage.findMany({ where: { status: "PUBLISHED", showInFooter: true }, orderBy: { position: "asc" }, select: { slug: true, title: true } }),
  ["footer-pages"],
  { tags: ["pages"], revalidate: 600 },
);

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, pages] = await Promise.all([getSettings(), getCategories(), getFooterPages()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader brand={settings.brand} navigation={settings.navigation} banner={settings.homepage.banner} categories={categories.map((c) => ({ slug: c.slug, name: c.name, color: c.color, icon: c.icon }))} />
      <main id="contenu" className="flex-1">{children}</main>
      <SiteFooter brand={settings.brand} navigation={settings.navigation} legalPages={pages} />
      <CartDrawer withdrawalNotice={settings.commerce.withdrawalNotice} />
      <ConsentBanner enabled={settings.analytics.consentBannerEnabled} />
      <AnalyticsScripts analytics={settings.analytics} />
    </div>
  );
}
