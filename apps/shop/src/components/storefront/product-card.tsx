import Image from "next/image";
import Link from "next/link";
import { Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cardPrice, type ProductCardData } from "@/lib/catalog";
import { cn, formatAgeRange, formatDuration } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";
import { PlaceholderArt } from "./placeholder-art";
import { Price } from "./price";
import { Stars } from "@/components/ui/misc";

const BADGE_VARIANTS = ["honey", "sky", "sage", "lavender", "coral"] as const;

export function productHref(p: Pick<ProductCardData, "slug">) {
  return `/aventures/${p.slug}`;
}

/** Carte produit : image, nom, âge, durée, prix, promo, bouton d'achat. */
export function ProductCard({ product, priority = false, className }: { product: ProductCardData; priority?: boolean; className?: string }) {
  const price = cardPrice(product);
  const img = product.images[0];
  const href = productHref(product);
  const badges = [...(price.isOnSale ? [`-${price.discountPercent} %`] : []), ...product.badges].slice(0, 2);

  return (
    <article className={cn("group card-soft card-hover relative flex h-full flex-col overflow-hidden", className)}>
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-cream-dark/30" aria-label={product.name}>
        {img ? (
          <Image
            src={img.url}
            alt={img.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            priority={priority}
          />
        ) : (
          <PlaceholderArt universe={product.universe} className="transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
        )}
        {badges.length > 0 && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {badges.map((b, i) => (
              <Badge key={b} variant={price.isOnSale && i === 0 ? "coral" : BADGE_VARIANTS[i % BADGE_VARIANTS.length]} className="shadow-sm">{b}</Badge>
            ))}
          </div>
        )}
        {product.category && (
          <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink shadow-sm backdrop-blur" style={{ color: product.category.color ?? undefined }}>
            {product.category.name}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex-1">
          <h3 className="font-heading text-lg font-semibold leading-snug">
            <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{product.name}</Link>
          </h3>
          {product.tagline && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{product.tagline}</p>}
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-ink-soft">
          <li className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden /> {formatAgeRange(product.ageMin, product.ageMax)}</li>
          {product.durationMinutes ? <li className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {formatDuration(product.durationMinutes)}</li> : null}
          {product.ratingAvg && product.reviewCount > 0 ? <li className="inline-flex items-center gap-1"><Stars rating={product.ratingAvg} size="sm" /> <span>({product.reviewCount})</span></li> : null}
        </ul>
        <div className="relative z-10 flex items-center justify-between gap-3">
          <Price priceCents={price.priceCents} compareAtCents={price.compareAtCents} currency={product.currency} />
          <AddToCartButton
            size="sm"
            label="Acheter"
            item={{ kind: "product", id: product.id, slug: product.slug, name: product.name, imageUrl: img?.url ?? null, unitPriceCents: price.priceCents, compareAtCents: price.compareAtCents, currency: product.currency }}
          />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, className, priorityCount = 0 }: { products: ProductCardData[]; className?: string; priorityCount?: number }) {
  return (
    <div className={cn("grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < priorityCount} />)}
    </div>
  );
}
