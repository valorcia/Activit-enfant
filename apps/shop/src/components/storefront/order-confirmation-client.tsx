"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics/client";
import { useCart } from "@/lib/cart/store";

/** Côté client : vide le panier et émet l'événement d'achat ; relance le rafraîchissement tant que la commande est en attente. */
export function OrderConfirmationClient({ status, orderId, totalCents, currency, items }: { status: string; orderId: string; totalCents: number; currency: string; items: Array<{ id: string; name: string; price: number; quantity: number }> }) {
  const router = useRouter();
  const clear = useCart((s) => s.clear);
  const tracked = useRef(false);

  useEffect(() => {
    if (status !== "PAID" && status !== "PARTIALLY_REFUNDED") return;
    clear();
    const key = `cc-purchase-${orderId}`;
    if (!tracked.current && !sessionStorage.getItem(key)) {
      tracked.current = true;
      sessionStorage.setItem(key, "1");
      trackEvent("purchase", { transaction_id: orderId, value: totalCents / 100, currency, items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price / 100, quantity: i.quantity })) });
    }
  }, [status, orderId, totalCents, currency, items, clear]);

  useEffect(() => {
    if (status !== "PENDING") return;
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > 120_000) { clearInterval(id); return; }
      router.refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [status, router]);

  return null;
}
