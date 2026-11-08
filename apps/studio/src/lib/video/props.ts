/**
 * Construction des options de montage d'une publicité à partir de la fiche commerciale d'un livre.
 * Module pur (aucun accès base ni fichier) : utilisé par le formulaire, le worker et les tests.
 */
import type { AdFormat, AdPropsInput } from "@malle/video/schema";

export const AD_FORMAT_LABELS: Record<AdFormat, string> = {
  story: "Story / Reel / TikTok (9:16)",
  square: "Carré (1:1)",
  landscape: "Paysage (16:9)",
};
export const AD_FORMATS: AdFormat[] = ["story", "square", "landscape"];

/** Champs de la fiche commerciale utiles au montage (sous-ensemble de buildListingFromBook). */
export interface ListingLike {
  name: string;
  tagline?: string | null;
  priceCents: number;
  salePriceCents?: number | null;
  currency?: string;
  heroBadges?: string[] | null;
  sellingPoints?: Array<{ title: string }> | null;
  kitContents?: Array<{ title: string; quantity?: number | null }> | null;
}

/** Options saisies dans le formulaire « Vidéos pub ». */
export interface AdFormOptions {
  durationSeconds: number;
  hook: string;
  bullets: string[];
  cta: string;
}

/** Fichiers à utiliser (chemins relatifs au dossier public de rendu, ou URL https). */
export interface AdMedia {
  hero: string;
  cover?: string;
  kitImages?: string[];
  clip?: string;
  logo?: string;
  music?: string;
  musicVolume?: number;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** Valeurs proposées par défaut dans le formulaire, tirées de la fiche. */
export function defaultAdForm(listing: ListingLike, durationSeconds = 15): AdFormOptions {
  const fromPoints = (listing.sellingPoints ?? []).map((s) => s.title).filter(Boolean);
  const fromBadges = (listing.heroBadges ?? []).filter(Boolean);
  const bullets = (fromPoints.length ? fromPoints : fromBadges.length ? fromBadges : ["Téléchargement immédiat", "PDF prêt à imprimer"]).slice(0, 3);
  return {
    durationSeconds,
    hook: clip(listing.tagline?.trim() || listing.name, 90),
    bullets: bullets.map((b) => clip(b, 70)),
    cta: "Téléchargez maintenant",
  };
}

export function effectivePrice(listing: ListingLike): { priceCents: number; compareAtCents: number | null } {
  const sale = listing.salePriceCents;
  if (sale != null && sale > 0 && sale < listing.priceCents) return { priceCents: sale, compareAtCents: listing.priceCents };
  return { priceCents: listing.priceCents, compareAtCents: null };
}

export function kitItemsFrom(listing: ListingLike, images: string[] = []): Array<{ title: string; image?: string }> {
  return (listing.kitContents ?? []).slice(0, 4).map((k, i) => ({
    title: clip(k.quantity && k.quantity > 1 && !/^\d/.test(k.title) ? `${k.quantity} ${k.title}` : k.title, 60),
    ...(images[i] ? { image: images[i] } : {}),
  }));
}

/** Props complètes du montage Remotion. */
export function buildAdProps(listing: ListingLike, form: AdFormOptions, media: AdMedia, opts: { format: AdFormat; brandName?: string; url?: string }): AdPropsInput {
  const { priceCents, compareAtCents } = effectivePrice(listing);
  const bullets = form.bullets.map((b) => b.trim()).filter(Boolean).slice(0, 3).map((b) => clip(b, 70));
  return {
    format: opts.format,
    durationSeconds: Math.min(20, Math.max(6, Math.round(form.durationSeconds))),
    brandName: clip(opts.brandName ?? "La Malle à Jeux", 40),
    title: clip(listing.name, 80),
    hook: clip(form.hook.trim() || listing.tagline || listing.name, 90),
    bullets: bullets.length ? bullets : ["Téléchargement immédiat"],
    kitItems: kitItemsFrom(listing, media.kitImages),
    priceCents,
    compareAtCents,
    currency: listing.currency ?? "EUR",
    cta: clip(form.cta.trim() || "Téléchargez maintenant", 40),
    url: clip(opts.url ?? "", 60),
    heroImage: media.hero,
    ...(media.cover ? { coverImage: media.cover } : {}),
    ...(media.clip ? { hookClip: media.clip } : {}),
    ...(media.logo ? { logo: media.logo } : {}),
    ...(media.music ? { music: media.music, musicVolume: media.musicVolume ?? 0.6 } : {}),
  };
}

/** Ratio du clip d'accroche selon le format de la publicité. */
export function clipRatioFor(format: AdFormat): "portrait" | "square" | "landscape" {
  return format === "story" ? "portrait" : format === "square" ? "square" : "landscape";
}
