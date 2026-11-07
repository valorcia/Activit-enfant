import Image from "next/image";
import Link from "next/link";
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { bundleSavings, type BundleWithItems } from "@/lib/catalog";
import { cn, formatPrice } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";
import { PlaceholderArt } from "./placeholder-art";
import { Price } from "./price";

export function bundleHref(b: Pick<BundleWithItems, "slug">) {
  return `/packs/${b.slug}`;
}

export function BundleCard({ bundle, className }: { bundle: BundleWithItems; className?: string }) {
  const s = bundleSavings(bundle);
  const href = bundleHref(bundle);
  const thumbs = bundle.items.slice(0, 4);
  return (
    <article className={cn("group card-soft card-hover relative flex h-full flex-col overflow-hidden", className)}>
      <Link href={href} className="relative block aspect-[16/10] overflow-hidden bg-lavender-light" aria-label={bundle.name}>
        {bundle.imageUrl ? (
          <Image src={bundle.imageUrl} alt={bundle.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : thumbs.length > 0 ? (
          <div className="grid h-full grid-cols-2 gap-1 p-2">
            {thumbs.map((it) => (
              <div key={it.productId} className="relative overflow-hidden rounded-xl bg-white">
                {it.product.images[0] ? <Image src={it.product.images[0].url} alt="" fill sizes="25vw" className="object-cover" /> : <PlaceholderArt universe={it.product.universe} hideLabel />}
              </div>
            ))}
          </div>
        ) : (
          <PlaceholderArt label="Visuel du pack à venir" />
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge variant="lavender"><Layers /> Pack {bundle.items.length} kits</Badge>
          {s.savingsCents > 0 && <Badge variant="coral">-{s.percent} %</Badge>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex-1">
          <h3 className="font-heading text-xl font-semibold leading-snug">
            <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{bundle.name}</Link>
          </h3>
          {bundle.tagline && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{bundle.tagline}</p>}
          <ul className="mt-2 text-xs text-ink-soft">
            {bundle.items.slice(0, 3).map((it) => <li key={it.productId}>• {it.product.name}</li>)}
            {bundle.items.length > 3 && <li>• et {bundle.items.length - 3} autre{bundle.items.length - 3 > 1 ? "s" : ""}…</li>}
          </ul>
        </div>
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div>
            <Price priceCents={bundle.priceCents} compareAtCents={s.savingsCents > 0 ? s.fullCents : null} currency={bundle.currency} />
            {s.savingsCents > 0 && <p className="text-xs font-bold text-sage-dark">Vous économisez {formatPrice(s.savingsCents, bundle.currency)}</p>}
          </div>
          <AddToCartButton size="sm" label="Acheter" variant="lavender" item={{ kind: "bundle", id: bundle.id, slug: bundle.slug, name: bundle.name, imageUrl: bundle.imageUrl, unitPriceCents: bundle.priceCents, currency: bundle.currency }} />
        </div>
      </div>
    </article>
  );
}
