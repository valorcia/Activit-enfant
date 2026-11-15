import { env } from "@/lib/env";

/**
 * Adresse du studio : STUDIO_URL si définie, sinon déduite de l'adresse de la boutique
 * (www.exemple.fr → studio.exemple.fr). Chaîne vide en local sans configuration.
 */
export function studioUrl(): string {
  const explicit = process.env.STUDIO_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  try {
    const u = new URL(env.appUrl);
    if (u.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname.endsWith(".vercel.app")) return "";
    const host = u.hostname.replace(/^www\./, "");
    return `${u.protocol}//studio.${host}`;
  } catch {
    return "";
  }
}

/** Lien direct vers le livre du studio qui a produit ce produit (le studio retrouve le livre par l'id produit). */
export function studioProductUrl(productId: string): string {
  const base = studioUrl();
  return base ? `${base}/books/by-shop/${encodeURIComponent(productId)}` : "";
}
