"use client";
import { ShoppingBag, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useCart } from "@/lib/cart/store";
import type { CartItem } from "@/lib/orders/cart-types";
import { trackEvent } from "@/lib/analytics/client";

export function AddToCartButton({ item, label = "Ajouter au panier", addedLabel = "Ajouté !", openCart = true, ...btn }: { item: Omit<CartItem, "quantity">; label?: string; addedLabel?: string; openCart?: boolean } & Omit<ButtonProps, "onClick">) {
  const add = useCart((s) => s.add);
  const close = useCart((s) => s.close);
  const [added, setAdded] = useState(false);
  return (
    <Button
      {...btn}
      onClick={() => {
        add({ ...item, quantity: 1 });
        if (!openCart) close();
        setAdded(true);
        trackEvent("add_to_cart", { item_id: item.id, item_name: item.name, value: item.unitPriceCents / 100, currency: item.currency });
        toast.success(`${item.name} ajouté au panier`);
        setTimeout(() => setAdded(false), 1800);
      }}
      aria-live="polite"
    >
      {added ? <Check className="size-5" /> : <ShoppingBag className="size-5" />}
      {added ? addedLabel : label}
    </Button>
  );
}
