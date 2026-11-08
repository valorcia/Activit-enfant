import Image from "next/image";
import { Check } from "lucide-react";
import { BuyNowButton } from "@/components/storefront/buy-now-button";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { PlaceholderArt } from "@/components/storefront/placeholder-art";
import { Price } from "@/components/storefront/price";
import { TrustBadges } from "@/components/storefront/trust-badges";
import { parseKitContents, type ProductPageData } from "@/lib/catalog";
import { effectivePrice } from "@/lib/pricing";
import { getSetting } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { GuaranteeBlock } from "./guarantee";
import { heroImage } from "./hero";

/** Récapitulatif de l'offre : dernier rappel clair avant la FAQ, avec CTA d'achat. */
export async function OfferRecap({ product }: { product: ProductPageData }) {
  const conversion = await getSetting("conversion", product.siteId);
  const price = effectivePrice(product);
  const img = heroImage(product);
  const items = parseKitContents(product.kitContents);
  const lines = items.length ? items.map((i) => `${i.title}${i.quantity ? ` × ${i.quantity}` : ""}`) : product.files.map((f) => f.name);

  return (
    <section className="py-14 sm:py-20" aria-labelledby="offer-title">
      <div className="container-shell max-w-4xl">
        <div className="card-soft overflow-hidden lg:grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative aspect-[4/3] bg-cream-dark/30 lg:aspect-auto lg:min-h-full">
            {img ? <Image src={img.url} alt={img.alt ?? product.name} fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" /> : <PlaceholderArt universe={product.universe} />}
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-coral-dark">Votre kit</p>
            <h2 id="offer-title" className="mt-1 font-heading text-3xl font-bold">{product.name}</h2>
            {product.tagline && <p className="mt-2 text-ink-soft">{product.tagline}</p>}
            {lines.length > 0 && (
              <ul className="mt-5 space-y-1.5 text-sm">
                {lines.slice(0, 8).map((l) => (
                  <li key={l} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-sage-dark" strokeWidth={3} aria-hidden /><span>{l}</span></li>
                ))}
                {lines.length > 8 && <li className="text-ink-muted">… et {lines.length - 8} autre{lines.length - 8 > 1 ? "s" : ""} élément{lines.length - 8 > 1 ? "s" : ""}</li>}
              </ul>
            )}
            <div className="mt-6 flex flex-wrap items-end gap-3">
              <Price priceCents={price.priceCents} compareAtCents={price.compareAtCents} currency={product.currency} size="xl" />
              {price.isOnSale && <span className="rounded-full bg-coral px-3 py-1 text-xs font-bold text-white">-{price.discountPercent} %{product.saleEndsAt ? ` jusqu'au ${formatDate(product.saleEndsAt)}` : ""}</span>}
            </div>
            <p className="text-xs text-ink-muted">TVA incluse · livraison immédiate par email</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <BuyNowButton kind="product" id={product.id} name={product.name} priceCents={price.priceCents} currency={product.currency} label={conversion.buyNowLabel} size="lg" className="w-full sm:w-auto" />
              <AddToCartButton size="lg" variant="outline" label="Ajouter au panier" className="w-full sm:w-auto" item={{ kind: "product", id: product.id, slug: product.slug, name: product.name, imageUrl: img?.url ?? null, unitPriceCents: price.priceCents, compareAtCents: price.compareAtCents, currency: product.currency }} />
            </div>
            <TrustBadges badges={conversion.trustBadges} compact className="mt-4" />
            <GuaranteeBlock siteId={product.siteId} compact className="mt-4" />
          </div>
        </div>
      </div>
    </section>
  );
}
