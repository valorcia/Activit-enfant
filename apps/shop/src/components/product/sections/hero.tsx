import Image from "next/image";
import { Lock, Download, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/misc";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { PlaceholderArt } from "@/components/storefront/placeholder-art";
import { Price } from "@/components/storefront/price";
import { effectivePrice } from "@/lib/pricing";
import type { ProductPageData } from "@/lib/catalog";
import { cn, formatAgeRange, formatDate } from "@/lib/utils";
import { TEMPLATE_THEMES, defaultHeroBadges } from "../theme";

const BADGE_VARIANTS = ["coral", "sky", "sage", "lavender", "honey"] as const;

export function heroImage(product: ProductPageData) {
  return product.images.find((i) => i.role === "MAIN") ?? product.images.find((i) => i.role === "ILLUSTRATION") ?? null;
}

export function ProductHero({ product }: { product: ProductPageData }) {
  const theme = TEMPLATE_THEMES[product.template];
  const price = effectivePrice(product);
  const img = heroImage(product);
  const ageLabel = formatAgeRange(product.ageMin, product.ageMax);
  const badges = product.heroBadges.length ? product.heroBadges : defaultHeroBadges(ageLabel);
  const catColor = product.category?.color ?? undefined;

  return (
    <section className="relative overflow-hidden" aria-labelledby="product-title">
      {/* formes organiques en arrière-plan */}
      <div aria-hidden className={cn("pointer-events-none absolute -right-24 -top-24 size-80 opacity-50 blob-tl", theme.accentBg)} style={catColor ? { backgroundColor: catColor } : undefined} />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-16 size-64 bg-honey/40 blob-br" />

      <div className="container-shell relative grid gap-8 py-8 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-14">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] shadow-lift lg:order-2">
          {img ? (
            <Image src={img.url} alt={img.alt ?? product.name} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          ) : (
            <PlaceholderArt universe={product.universe} label="Illustration à venir" />
          )}
        </div>

        <div className="lg:order-1">
          {product.category && (
            <p className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold shadow-sm" style={{ color: catColor }}>{product.category.name}</p>
          )}
          <h1 id="product-title" className="font-heading text-4xl font-bold leading-[1.05] text-balance sm:text-5xl">{product.name}</h1>
          {product.tagline && <p className="mt-4 text-lg text-ink-soft text-pretty sm:text-xl">{product.tagline}</p>}

          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Points clés">
            {badges.map((b, i) => <li key={b}><Badge variant={BADGE_VARIANTS[i % BADGE_VARIANTS.length]} size="lg">{b}</Badge></li>)}
          </ul>

          {product.ratingAvg != null && product.reviewCount > 0 && (
            <a href="#avis" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink">
              <Stars rating={product.ratingAvg} /> {product.ratingAvg.toFixed(1)} / 5 · {product.reviewCount} avis
            </a>
          )}

          <div className="mt-7 flex flex-col gap-4 rounded-3xl bg-white/80 p-5 shadow-card backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Price priceCents={price.priceCents} compareAtCents={price.compareAtCents} currency={product.currency} size="xl" />
              {price.isOnSale && (
                <p className="mt-1 text-sm font-bold text-coral-dark">
                  -{price.discountPercent} %{product.saleEndsAt ? ` jusqu'au ${formatDate(product.saleEndsAt)}` : ""}
                </p>
              )}
              <p className="text-xs text-ink-muted">TVA incluse · {product.fileFormat} à télécharger</p>
            </div>
            <div id="hero-cta">
              <AddToCartButton
                size="lg"
                className="w-full sm:w-auto"
                label={theme.cta}
                item={{ kind: "product", id: product.id, slug: product.slug, name: product.name, imageUrl: img?.url ?? null, unitPriceCents: price.priceCents, compareAtCents: price.compareAtCents, currency: product.currency }}
              />
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-ink-soft">
            <li className="inline-flex items-center gap-1"><Lock className="size-3.5" aria-hidden /> Paiement sécurisé Stripe</li>
            <li className="inline-flex items-center gap-1"><Download className="size-3.5" aria-hidden /> Téléchargement immédiat</li>
            <li className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" aria-hidden /> Fichiers accessibles à vie par email</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
