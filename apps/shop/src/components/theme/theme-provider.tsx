import type { ThemeSettings } from "@/lib/schemas/settings";

const FONT_QUERY: Record<string, string> = {
  Fredoka: "Fredoka:wght@400;500;600;700",
  "Baloo 2": "Baloo+2:wght@400;500;600;700;800",
  Nunito: "Nunito:wght@400;600;700;800;900",
  Quicksand: "Quicksand:wght@400;500;600;700",
  Comfortaa: "Comfortaa:wght@400;500;600;700",
  Inter: "Inter:wght@400;500;600;700",
  Mulish: "Mulish:wght@400;600;700;800",
  Poppins: "Poppins:wght@400;500;600;700",
  Manrope: "Manrope:wght@400;500;600;700;800",
  Fraunces: "Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700",
};

/** Variables CSS du thème (couleurs, polices) injectées depuis les paramètres du site. */
export function themeStyle(theme: ThemeSettings): string {
  const c = theme.colors;
  return `:root{--brand-cream:${c.cream};--brand-coral:${c.coral};--brand-honey:${c.honey};--brand-sage:${c.sage};--brand-sky:${c.sky};--brand-lavender:${c.lavender};--brand-ink:${c.ink};--font-heading:"${theme.fonts.heading}","Nunito",system-ui,sans-serif;--font-body:"${theme.fonts.body}",system-ui,sans-serif;}`;
}

export function fontsHref(theme: ThemeSettings): string {
  const families = new Set([theme.fonts.heading, theme.fonts.body]);
  const params = [...families].map((f) => `family=${FONT_QUERY[f] ?? encodeURIComponent(f)}`).join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

export function ThemeHead({ theme }: { theme: ThemeSettings }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={fontsHref(theme)} />
      <style dangerouslySetInnerHTML={{ __html: themeStyle(theme) }} />
    </>
  );
}
