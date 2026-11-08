import "server-only";
import { getSettings } from "@/lib/settings";
import { getSiteById, siteUrl } from "./index";

/** Identité d'un univers pour les emails : nom, couleur, contact et URL absolue de son domaine. */
export async function emailBrandForSite(siteId: string | null | undefined) {
  const site = await getSiteById(siteId);
  const { brand, theme } = await getSettings(site);
  return { name: brand.name, appUrl: siteUrl(site), contactEmail: brand.contactEmail, color: theme.colors.coral, siteId: site.id };
}
