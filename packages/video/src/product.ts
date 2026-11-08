import type { AdPropsInput, AdFormat } from "./schema";

/** Fiche produit telle que renvoyée par l'API boutique v1 (champs utilisés). */
export interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  priceCents: number;
  salePriceCents?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  currency?: string;
  universe?: string | null;
  heroBadges?: string[];
  kitContents?: Array<{ title: string; quantity?: number }> | null;
  sellingPoints?: Array<{ title: string }> | null;
  images?: Array<{ url: string; role: string; alt?: string | null }>;
  publicUrl?: string | null;
}

function absolute(url: string, base: string): string {
  return /^https?:/.test(url) ? url : `${base.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

function activeSale(p: ShopProduct, now = new Date()): boolean {
  if (p.salePriceCents == null || p.salePriceCents >= p.priceCents) return false;
  if (p.saleStartsAt && now < new Date(p.saleStartsAt)) return false;
  if (p.saleEndsAt && now > new Date(p.saleEndsAt)) return false;
  return true;
}

/** Construit les props d'une publicité à partir d'une fiche produit de la boutique. */
export function adPropsFromProduct(p: ShopProduct, shopUrl: string, opts: { format?: AdFormat; durationSeconds?: number; hook?: string; logo?: string } = {}): AdPropsInput {
  const imgs = (p.images ?? []).map((i) => ({ ...i, url: absolute(i.url, shopUrl) }));
  const main = imgs.find((i) => i.role === "MAIN") ?? imgs[0];
  const illustration = imgs.find((i) => i.role === "ILLUSTRATION") ?? main;
  const gallery = imgs.filter((i) => i.role === "GALLERY" || i.role === "PDF_PREVIEW" || i.role === "MOCKUP");
  if (!main) throw new Error(`Le produit « ${p.name} » n'a aucune image : ajoutez une image principale avant de générer une vidéo.`);
  const sale = activeSale(p);
  const kit = (p.kitContents ?? []).slice(0, 4).map((k, i) => ({ title: k.quantity && k.quantity > 1 && !/^\d/.test(k.title) ? `${k.quantity} ${k.title}` : k.title, image: gallery[i]?.url }));
  const bullets = (p.sellingPoints?.length ? p.sellingPoints.map((s) => s.title) : p.heroBadges ?? []).slice(0, 3);
  const host = (() => {
    try {
      return new URL(shopUrl).host;
    } catch {
      return "";
    }
  })();
  return {
    format: opts.format ?? "story",
    durationSeconds: opts.durationSeconds ?? 15,
    title: p.name.slice(0, 80),
    hook: (opts.hook ?? p.tagline ?? p.name).slice(0, 90),
    bullets: bullets.length ? bullets.map((b) => b.slice(0, 70)) : ["Téléchargement immédiat", "PDF à imprimer"],
    kitItems: kit,
    priceCents: sale ? (p.salePriceCents as number) : p.priceCents,
    compareAtCents: sale ? p.priceCents : null,
    currency: p.currency ?? "EUR",
    url: host,
    logo: opts.logo ?? absolute("/images/brand/logo-la-malle-a-jeux.webp", shopUrl),
    heroImage: illustration?.url ?? main.url,
    coverImage: main.url,
  };
}
