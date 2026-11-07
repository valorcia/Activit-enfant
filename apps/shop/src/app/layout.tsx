import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { getSettings } from "@/lib/settings";
import { ThemeHead } from "@/components/theme/theme-provider";
import { env } from "@/lib/env";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { seo, brand } = await getSettings();
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: seo.defaultTitle, template: seo.titleTemplate },
    description: seo.defaultDescription,
    applicationName: brand.name,
    robots: seo.robotsIndex ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "website", siteName: brand.name, locale: "fr_FR", images: seo.ogImageUrl ? [seo.ogImageUrl] : undefined },
    twitter: { card: "summary_large_image" },
    icons: brand.faviconUrl ? { icon: brand.faviconUrl } : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: "#FFF9F0",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme } = await getSettings();
  return (
    <html lang="fr" data-radius={theme.radius} data-texture={theme.texture ? "on" : "off"} suppressHydrationWarning>
      <head>
        <ThemeHead theme={theme} />
      </head>
      <body className="bg-paper-texture">
        {children}
        <Toaster position="bottom-center" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-body)", borderRadius: "1rem" } }} />
      </body>
    </html>
  );
}
