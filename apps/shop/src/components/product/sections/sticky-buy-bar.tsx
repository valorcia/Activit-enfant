"use client";
import { useEffect, useState } from "react";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import type { CartItem } from "@/lib/orders/cart-types";
import { formatPrice } from "@/lib/utils";

/** Barre d'achat fixe (mobile) : visible quand le bouton du hero sort de l'écran. */
export function StickyBuyBar({ item, label }: { item: Omit<CartItem, "quantity">; label: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const target = document.getElementById("hero-cta");
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
          <p className="truncate font-heading text-sm font-semibold">{item.name}</p>
          <p className="font-heading text-lg font-bold text-coral-dark">{formatPrice(item.unitPriceCents, item.currency)}</p>
        </div>
        <AddToCartButton item={item} label={label} size="md" className="shrink-0" tabIndex={visible ? 0 : -1} />
      </div>
    </div>
  );
}
