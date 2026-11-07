"use client";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/client";

/** Enregistre une vue produit (la page étant mise en cache, l'appel se fait côté client). */
export function ViewTracker({ productId, name, priceCents, currency }: { productId: string; name: string; priceCents: number; currency: string }) {
  useEffect(() => {
    const body = JSON.stringify({ productId });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track/view", new Blob([body], { type: "application/json" }));
      else fetch("/api/track/view", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    } catch { /* ignoré */ }
    trackEvent("view_item", { item_id: productId, item_name: name, value: priceCents / 100, currency });
  }, [productId, name, priceCents, currency]);
  return null;
}
