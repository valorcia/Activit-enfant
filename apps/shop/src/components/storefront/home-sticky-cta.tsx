"use client";
import { useEffect, useState } from "react";
import { BuyNowButton } from "@/components/storefront/buy-now-button";
import { formatPrice } from "@/lib/utils";

/** Barre d'achat fixe (mobile) sur l'accueil : apparaît quand le CTA du hero (#home-cta) sort de l'écran. */
export function HomeStickyCta({ product, label }: { product: { id: string; name: string; priceCents: number; currency: string }; label: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const target = document.getElementById("home-cta");
    if (!target || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    obs.observe(target);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      className={`sticky-buy-bar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-lift backdrop-blur transition-transform duration-300 md:hidden ${visible ? "translate-y-0" : "translate-y-full"}`}
      aria-hidden={!visible}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold">{product.name}</p>
          <p className="font-heading text-lg font-bold text-coral-dark">{formatPrice(product.priceCents, product.currency)}</p>
        </div>
        <BuyNowButton kind="product" id={product.id} name={product.name} priceCents={product.priceCents} currency={product.currency} label={label} size="md" className="shrink-0" tabIndex={visible ? 0 : -1} />
      </div>
    </div>
  );
}
