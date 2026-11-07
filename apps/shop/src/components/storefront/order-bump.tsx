"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { BumpPayload } from "@/app/api/cart/bump/route";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCart } from "@/lib/cart/store";
import { formatPrice } from "@/lib/utils";
import { PlaceholderArt } from "./placeholder-art";

/** Charge les données de conversion du panier (produit complémentaire, réassurance). */
export function useCartBump() {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const [data, setData] = useState<BumpPayload | null>(null);
  const exclude = items.map((i) => i.id).sort().join(",");
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    fetch(`/api/cart/bump?exclude=${encodeURIComponent(exclude)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BumpPayload | null) => { if (!cancelled) setData(d); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [exclude, hydrated]);
  return data;
}

/** Order bump : case à cocher « Oui, j'ajoute … » pour un produit complémentaire. */
export function OrderBump({ data, className }: { data: BumpPayload | null; className?: string }) {
  const add = useCart((s) => s.add);
  const close = useCart((s) => s.close);
  if (!data?.orderBump.enabled || !data.product) return null;
  const p = data.product;
  const checkboxId = `bump-${p.id}`;
  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-honey bg-honey-light/60 p-4">
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-honey px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink"><Sparkles className="size-3" /> Offre complémentaire</span>
        <p className="pr-28 font-heading font-bold">{data.orderBump.title}</p>
        <p className="text-xs text-ink-soft">{data.orderBump.text}</p>
        <div className="mt-3 flex gap-3">
          <Link href={`/aventures/${p.slug}`} className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white">
            {p.imageUrl ? <Image src={p.imageUrl} alt="" fill sizes="64px" className="object-cover" /> : <PlaceholderArt universe={p.universe} hideLabel />}
          </Link>
          <label htmlFor={checkboxId} className="flex flex-1 cursor-pointer items-start gap-2 text-sm">
            <input
              id={checkboxId}
              type="checkbox"
              className="mt-0.5 size-5 accent-coral"
              onChange={(e) => {
                if (!e.target.checked) return;
                add({ kind: "product", id: p.id, slug: p.slug, name: p.name, imageUrl: p.imageUrl, unitPriceCents: p.priceCents, compareAtCents: p.compareAtCents, currency: p.currency });
                close(); // l'ajout n'ouvre pas le tiroir : l'utilisateur est déjà dans le panier
              }}
            />
            <span>
              <strong>Oui, j&apos;ajoute « {p.name} » pour {formatPrice(p.priceCents, p.currency)}</strong>
              {p.compareAtCents && p.compareAtCents > p.priceCents ? <span className="ml-1 text-ink-muted line-through">{formatPrice(p.compareAtCents, p.currency)}</span> : null}
              {p.tagline && <span className="block text-xs text-ink-soft">{p.tagline}</span>}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

/** Suggestion quand le panier est vide : la meilleure vente, avec bouton d'ajout. */
export function EmptyCartSuggestion({ data, onAdded }: { data: BumpPayload | null; onAdded?: () => void }) {
  const add = useCart((s) => s.add);
  if (!data?.product) return null;
  const p = data.product;
  return (
    <div className="card-soft w-full max-w-sm overflow-hidden text-left">
      <Link href={`/aventures/${p.slug}`} className="relative block aspect-[4/3] bg-cream-dark/30">
        {p.imageUrl ? <Image src={p.imageUrl} alt={p.name} fill sizes="384px" className="object-cover" /> : <PlaceholderArt universe={p.universe} />}
      </Link>
      <div className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-coral-dark">Notre coup de cœur</p>
        <p className="font-heading text-lg font-bold leading-tight">{p.name}</p>
        {p.tagline && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{p.tagline}</p>}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-heading text-xl font-bold">{formatPrice(p.priceCents, p.currency)}</span>
          <Button size="sm" onClick={() => { add({ kind: "product", id: p.id, slug: p.slug, name: p.name, imageUrl: p.imageUrl, unitPriceCents: p.priceCents, compareAtCents: p.compareAtCents, currency: p.currency }); onAdded?.(); }}>Ajouter</Button>
        </div>
      </div>
    </div>
  );
}

export function CartTrust({ data, className }: { data: BumpPayload | null; className?: string }) {
  const badges = data?.trustBadges ?? [{ icon: "lock", label: "Paiement sécurisé Stripe" }, { icon: "download", label: "Téléchargement immédiat" }];
  return (
    <ul className={className} aria-label="Garanties">
      {badges.map((b) => (
        <li key={b.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
          <span className="grid size-5 place-items-center rounded-full bg-sage-light text-sage-dark"><Icon name={b.icon} className="size-3" /></span>{b.label}
        </li>
      ))}
    </ul>
  );
}
