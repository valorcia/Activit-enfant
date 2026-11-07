"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Lock, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { startCheckoutAction } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Alert, Skeleton } from "@/components/ui/misc";
import { trackEvent } from "@/lib/analytics/client";
import { cartSubtotal, useCart } from "@/lib/cart/store";
import { formatPrice } from "@/lib/utils";
import { PlaceholderArt } from "./placeholder-art";
import { CartTrust, EmptyCartSuggestion, OrderBump, useCartBump } from "./order-bump";

export function CartPage({ cancelled, withdrawalNotice }: { cancelled: boolean; withdrawalNotice: string }) {
  const { items, remove, setQuantity, couponCode, setCoupon, hydrated } = useCart();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [coupon, setCouponInput] = useState(couponCode ?? "");
  const subtotal = cartSubtotal(items);
  const bump = useCartBump();
  const [showOptions, setShowOptions] = useState(false);

  function checkout() {
    start(async () => {
      trackEvent("begin_checkout", { value: subtotal / 100, currency: "EUR" });
      const sp = new URLSearchParams(window.location.search);
      const utm = Object.fromEntries([...sp.entries()].filter(([k]) => k.startsWith("utm_")));
      const res = await startCheckoutAction({ lines: items.map((i) => ({ kind: i.kind, id: i.id, quantity: i.quantity })), email: email || null, couponCode: coupon || null, marketingConsent: consent, utm });
      if (res.ok) { setCoupon(coupon || null); window.location.href = res.url; } else toast.error(res.error);
    });
  }

  if (!hydrated) {
    return <div className="grid gap-6 lg:grid-cols-[1fr_380px]"><Skeleton className="h-64" /><Skeleton className="h-80" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="card-soft flex flex-col items-center gap-4 p-12 text-center">
        {cancelled && <Alert variant="info" className="w-full max-w-md">Le paiement a été annulé. Votre panier est vide.</Alert>}
        <ShoppingBag className="size-14 text-ink-muted" />
        <p className="font-heading text-2xl font-bold">Votre panier est vide</p>
        <p className="max-w-sm text-ink-soft">Explorez nos chasses au trésor, cahiers d&apos;activités et kits de fête à imprimer.</p>
        <EmptyCartSuggestion data={bump} />
        <Button asChild size="lg" variant="outline"><Link href="/boutique">Découvrir toute la boutique</Link></Button>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {cancelled && <Alert variant="info" title="Paiement annulé">Votre panier a été conservé. Vous pouvez reprendre le paiement quand vous le souhaitez.</Alert>}
        <ul className="space-y-3" aria-label="Articles du panier">
          {items.map((i) => (
            <li key={`${i.kind}-${i.id}`} className="card-soft flex gap-4 p-4">
              <Link href={i.kind === "bundle" ? `/packs/${i.slug}` : `/aventures/${i.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-cream-dark/30 sm:size-28">
                {i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="112px" className="object-cover" /> : <PlaceholderArt hideLabel />}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-heading text-lg font-bold leading-tight">{i.name}</p>
                    <p className="text-xs text-ink-muted">{i.kind === "bundle" ? "Pack" : "Kit numérique"} · PDF à télécharger</p>
                  </div>
                  <button className="rounded-full p-2 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label={`Retirer ${i.name}`} onClick={() => remove(i.kind, i.id)}><Trash2 className="size-4" /></button>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="inline-flex items-center rounded-full border border-line bg-white">
                    <button className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label="Diminuer la quantité" onClick={() => setQuantity(i.kind, i.id, i.quantity - 1)}><Minus className="size-4" /></button>
                    <span className="w-8 text-center font-bold" aria-live="polite">{i.quantity}</span>
                    <button className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label="Augmenter la quantité" onClick={() => setQuantity(i.kind, i.id, i.quantity + 1)}><Plus className="size-4" /></button>
                  </div>
                  <div className="text-right">
                    <span className="font-heading text-xl font-bold">{formatPrice(i.unitPriceCents * i.quantity, i.currency)}</span>
                    {i.compareAtCents && i.compareAtCents > i.unitPriceCents && <span className="block text-xs text-ink-muted line-through">{formatPrice(i.compareAtCents * i.quantity, i.currency)}</span>}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <OrderBump data={bump} />
        <Button asChild variant="ghost"><Link href="/boutique">← Continuer mes achats</Link></Button>
      </div>

      <aside className="card-soft sticky top-24 space-y-4 p-5 sm:p-6" aria-label="Récapitulatif">
        <h2 className="font-heading text-2xl font-bold">Récapitulatif</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Sous-total</dt><dd className="font-bold">{formatPrice(subtotal)}</dd></div>
          <div className="flex justify-between text-ink-soft"><dt>TVA</dt><dd>incluse</dd></div>
          <div className="flex justify-between border-t border-line pt-2 font-heading text-2xl font-bold"><dt>Total <span className="text-xs font-semibold text-ink-muted">TTC</span></dt><dd>{formatPrice(subtotal)}</dd></div>
          {coupon && <p className="text-xs text-ink-muted">La remise sera appliquée à l&apos;étape de paiement.</p>}
        </dl>
        <Button size="xl" className="w-full" onClick={checkout} disabled={pending}><Lock className="size-5" /> {pending ? "Redirection sécurisée…" : "Payer en toute sécurité"}</Button>
        <p className="text-center text-[11px] text-ink-muted">Stripe · Carte bancaire, Apple Pay, Google Pay · Fichiers envoyés par email dès le paiement</p>
        <CartTrust data={bump} className="flex flex-wrap justify-center gap-x-3 gap-y-1" />
        <div className="border-t border-line pt-3">
          <button type="button" className="text-xs font-semibold text-ink-soft underline-offset-4 hover:underline" onClick={() => setShowOptions((v) => !v)} aria-expanded={showOptions}>
            {showOptions ? "Masquer les options" : "Code promo ou email de livraison ?"}
          </button>
          {showOptions && (
            <div className="mt-3 space-y-3">
              <Field label="Code promo" htmlFor="coupon"><Input id="coupon" value={coupon} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Ex. BIENVENUE" /></Field>
              <Field label="Email de livraison (facultatif)" htmlFor="email" hint="Demandé de toute façon au paiement. Aucun compte à créer."><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" /></Field>
              <label className="flex items-start gap-2 text-xs text-ink-soft">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-coral" />
                <span>J&apos;accepte de recevoir les nouvelles aventures et offres par email (facultatif).</span>
              </label>
            </div>
          )}
        </div>
        <p className="text-[11px] leading-snug text-ink-muted">{withdrawalNotice}</p>
      </aside>
    </div>
  );
}
