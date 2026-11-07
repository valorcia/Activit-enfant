import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { brand, theme } = await getSettings();
  return {
    name: brand.name,
    short_name: brand.logoText ?? brand.name,
    description: brand.tagline,
    start_url: "/",
    display: "standalone",
    background_color: theme.colors.cream,
    theme_color: theme.colors.coral,
    lang: "fr",
    icons: brand.faviconUrl ? [{ src: brand.faviconUrl, sizes: "any" }] : [],
  };
}
