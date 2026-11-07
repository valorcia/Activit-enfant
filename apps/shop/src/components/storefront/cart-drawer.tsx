"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Minus, Plus, ShoppingBag, Trash2, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart, cartSubtotal } from "@/lib/cart/store";
import { formatPrice } from "@/lib/utils";
import { PlaceholderArt } from "./placeholder-art";
import { startCheckoutAction } from "@/app/actions/checkout";
import { trackEvent } from "@/lib/analytics/client";
import { CartTrust, EmptyCartSuggestion, OrderBump, useCartBump } from "./order-bump";

export function CartDrawer({ withdrawalNotice }: { withdrawalNotice: string }) {
  const { items, isOpen, close, remove, setQuantity, couponCode, setCoupon, hydrated } = useCart();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [coupon, setCouponInput] = useState(couponCode ?? "");
  const subtotal = cartSubtotal(items);
  const bump = useCartBump();
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  function checkout() {
    start(async () => {
      trackEvent("begin_checkout", { value: subtotal / 100, currency: "EUR" });
      const utm = Object.fromEntries(new URLSearchParams(window.location.search).entries());
      const res = await startCheckoutAction({
        lines: items.map((i) => ({ kind: i.kind, id: i.id, quantity: i.quantity })),
        email: email || null,
        couponCode: coupon || null,
        marketingConsent: consent,
        utm: Object.fromEntries(Object.entries(utm).filter(([k]) => k.startsWith("utm_"))),
      });
      if (res.ok) {
        setCoupon(coupon || null);
        window.location.href = res.url;
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!hydrated) return null;
  return (
    <div className={isOpen ? "fixed inset-0 z-50" : "pointer-events-none fixed inset-0 z-50"} aria-hidden={!isOpen}>
      <div className={`absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`} onClick={close} />
      <aside
        role="dialog" aria-modal="true" aria-label="Panier"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream shadow-lift transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-heading text-2xl font-bold">Mon panier</h2>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Fermer le panier"><X className="size-5" /></Button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center">
            <ShoppingBag className="size-10 text-ink-muted" />
            <p className="font-heading text-xl font-semibold">Votre panier est vide</p>
            <p className="text-sm text-ink-soft">Choisissez une aventure et elle apparaîtra ici.</p>
            <EmptyCartSuggestion data={bump} />
            <Button asChild variant="outline" onClick={close}><Link href="/boutique">Voir toute la boutique</Link></Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={`${i.kind}-${i.id}`} className="flex gap-3 rounded-2xl bg-white p-3 shadow-card">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-cream-dark/30">
                    {i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="80px" className="object-cover" /> : <PlaceholderArt hideLabel />}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <p className="font-heading font-semibold leading-tight">{i.name}</p>
                    <p className="text-xs text-ink-muted">{i.kind === "bundle" ? "Pack" : "Kit numérique"}</p>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="inline-flex items-center rounded-full border border-line">
                        <button className="grid size-7 place-items-center rounded-full hover:bg-ink/5" aria-label="Diminuer" onClick={() => setQuantity(i.kind, i.id, i.quantity - 1)}><Minus className="size-3.5" /></button>
                        <span className="w-6 text-center text-sm font-bold" aria-live="polite">{i.quantity}</span>
                        <button className="grid size-7 place-items-center rounded-full hover:bg-ink/5" aria-label="Augmenter" onClick={() => setQuantity(i.kind, i.id, i.quantity + 1)}><Plus className="size-3.5" /></button>
                      </div>
                      <span className="font-heading font-bold">{formatPrice(i.unitPriceCents * i.quantity, i.currency)}</span>
                    </div>
                  </div>
                  <button className="self-start rounded-full p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label={`Retirer ${i.name}`} onClick={() => remove(i.kind, i.id)}><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
            <OrderBump data={bump} className="mt-4" />
            </div>

            <div className="space-y-3 border-t border-line bg-white px-5 py-4">
              <div className="flex items-center justify-between font-heading text-xl">
                <span>Total <span className="text-xs font-semibold text-ink-muted">TTC</span></span>
                <span className="font-bold">{formatPrice(subtotal)}</span>
              </div>
              <Button size="lg" className="w-full" onClick={checkout} disabled={pending}>
                <Lock className="size-4" /> {pending ? "Redirection sécurisée…" : "Payer en toute sécurité"}
              </Button>
              <p className="text-center text-[11px] text-ink-muted">Stripe · Carte bancaire, Apple Pay, Google Pay · Fichiers envoyés par email dès le paiement</p>
              <CartTrust data={bump} className="flex flex-wrap justify-center gap-x-3 gap-y-1" />
              <details className="group text-xs" open={showEmail}>
                <summary className="cursor-pointer list-none font-semibold text-ink-soft underline-offset-4 hover:underline" onClick={(e) => { e.preventDefault(); setShowEmail((v) => !v); }}>
                  Code promo ou email de livraison ?
                </summary>
                <div className="mt-2 space-y-2">
                  <Input placeholder="Code promo" value={coupon} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} aria-label="Code promo" className="h-10" />
                  <Input type="email" placeholder="Email de livraison (facultatif, demandé au paiement)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" className="h-10" autoComplete="email" />
                  <label className="flex items-start gap-2 text-xs text-ink-soft">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-coral" />
                    <span>J&apos;accepte de recevoir les nouvelles aventures et offres par email (facultatif).</span>
                  </label>
                </div>
              </details>
              <p className="text-[11px] leading-snug text-ink-muted">{withdrawalNotice}</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
