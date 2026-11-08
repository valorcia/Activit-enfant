"use client";
import { useTransition } from "react";
import { Zap, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { startCheckoutAction } from "@/app/actions/checkout";
import { trackEvent } from "@/lib/analytics/client";
import { useCart } from "@/lib/cart/store";
import { currentUtm } from "@/lib/analytics/utm";

/**
 * Achat en un clic : crée directement la session Stripe Checkout pour cet article
 * (plus le panier en cours si `includeCart`), sans passer par la page panier.
 */
export function BuyNowButton({ kind, id, name, priceCents, currency = "EUR", label = "Acheter maintenant", includeCart = true, showLock = true, ...btn }: {
  kind: "product" | "bundle"; id: string; name: string; priceCents: number; currency?: string; label?: string; includeCart?: boolean; showLock?: boolean;
} & Omit<ButtonProps, "onClick">) {
  const [pending, start] = useTransition();
  const items = useCart((s) => s.items);
  const couponCode = useCart((s) => s.couponCode);

  return (
    <Button
      {...btn}
      disabled={pending || btn.disabled}
      onClick={() => start(async () => {
        trackEvent("begin_checkout", { item_id: id, item_name: name, value: priceCents / 100, currency });
        const others = includeCart ? items.filter((i) => !(i.kind === kind && i.id === id)).map((i) => ({ kind: i.kind, id: i.id, quantity: i.quantity })) : [];
        const utm = currentUtm();
        const res = await startCheckoutAction({ lines: [{ kind, id, quantity: 1 }, ...others], couponCode, utm });
        if (!res.ok) { toast.error(res.error); return; }
        window.location.href = res.url;
      })}
    >
      {showLock ? <Lock className="size-5" /> : <Zap className="size-5" />}
      {pending ? "Redirection sécurisée…" : label}
    </Button>
  );
}
