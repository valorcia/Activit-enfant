import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getSetting } from "@/lib/settings";
import { applyCoupon, computeTotals, effectivePrice, type CartLineInput, type PricedLine } from "@/lib/pricing";
import { nextOrderNumber } from "./numbers";

export class CheckoutError extends Error {
  constructor(message: string, public code = "CHECKOUT_ERROR") {
    super(message);
  }
}

export interface CheckoutInput {
  lines: CartLineInput[];
  email?: string | null;
  couponCode?: string | null;
  utm?: Record<string, string> | null;
  marketingConsent?: boolean;
  consentText?: string | null;
}

/**
 * Valide le panier côté serveur (prix recalculés depuis la base, jamais depuis
 * le client), crée la commande en attente et la session Stripe Checkout.
 */
export async function priceCart(lines: CartLineInput[], now = new Date()): Promise<PricedLine[]> {
  if (lines.length === 0) throw new CheckoutError("Votre panier est vide", "EMPTY_CART");
  if (lines.length > 50) throw new CheckoutError("Trop d'articles dans le panier", "TOO_MANY_ITEMS");
  const productIds = lines.filter((l) => l.kind === "product").map((l) => l.id);
  const bundleIds = lines.filter((l) => l.kind === "bundle").map((l) => l.id);

  const [products, bundles] = await Promise.all([
    productIds.length ? prisma.product.findMany({ where: { id: { in: productIds }, status: "PUBLISHED" } }) : [],
    bundleIds.length ? prisma.bundle.findMany({ where: { id: { in: bundleIds }, status: "PUBLISHED" }, include: { items: true } }) : [],
  ]);

  const priced: PricedLine[] = [];
  for (const line of lines) {
    const qty = Math.max(1, Math.min(10, Math.floor(line.quantity || 1)));
    if (line.kind === "product") {
      const p = products.find((x) => x.id === line.id);
      if (!p) throw new CheckoutError("Un produit du panier n'est plus disponible", "UNAVAILABLE");
      const ep = effectivePrice(p, now);
      priced.push({ kind: "product", id: p.id, name: p.name, quantity: qty, unitPriceCents: ep.priceCents, compareAtCents: ep.compareAtCents, totalCents: ep.priceCents * qty, taxRateBp: p.taxRateBp });
    } else {
      const b = bundles.find((x) => x.id === line.id);
      if (!b || b.items.length === 0) throw new CheckoutError("Un pack du panier n'est plus disponible", "UNAVAILABLE");
      priced.push({ kind: "bundle", id: b.id, name: b.name, quantity: qty, unitPriceCents: b.priceCents, compareAtCents: null, totalCents: b.priceCents * qty, taxRateBp: b.taxRateBp });
    }
  }
  return priced;
}

export async function createCheckoutSession(input: CheckoutInput): Promise<{ url: string; orderId: string }> {
  const stripe = getStripe();
  const commerce = await getSetting("commerce");
  const now = new Date();
  const lines = await priceCart(input.lines, now);

  // Coupon interne (optionnel)
  let coupon = null;
  let discountCents = 0;
  if (input.couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: input.couponCode.trim().toUpperCase() } });
    const subtotal = lines.reduce((s, l) => s + l.totalCents, 0);
    const check = applyCoupon(coupon, subtotal, now);
    if (!check.ok) throw new CheckoutError(check.reason, "INVALID_COUPON");
    discountCents = check.discountCents;
  }
  const totals = computeTotals(lines, discountCents);
  if (totals.totalCents < 50 && totals.totalCents !== 0) {
    throw new CheckoutError("Le montant minimum d'une commande est de 0,50 €", "MIN_AMOUNT");
  }

  const email = input.email?.trim().toLowerCase() || undefined;

  // Commande en attente (statut PENDING) — confirmée uniquement par le webhook Stripe
  const order = await prisma.$transaction(async (tx) => {
    const number = await nextOrderNumber(tx, commerce.orderPrefix, now);
    return tx.order.create({
      data: {
        number,
        email: email ?? "",
        status: "PENDING",
        currency: commerce.currency,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        couponId: coupon?.id,
        couponCode: coupon?.code,
        utm: input.utm ?? undefined,
        metadata: { marketingConsent: !!input.marketingConsent, consentText: input.consentText ?? null },
        items: {
          create: lines.map((l) => ({
            productId: l.kind === "product" ? l.id : undefined,
            bundleId: l.kind === "bundle" ? l.id : undefined,
            name: l.name,
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
            totalCents: l.totalCents,
            taxRateBp: l.taxRateBp,
          })),
        },
      },
    });
  });

  // Coupon Stripe synchronisé (créé à la volée si nécessaire)
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (coupon && discountCents > 0) {
    let stripeCouponId = coupon.stripeCouponId;
    if (!stripeCouponId) {
      const created = await stripe.coupons.create(
        coupon.type === "PERCENT"
          ? { percent_off: coupon.percentOff ?? 0, duration: "once", name: coupon.code }
          : { amount_off: coupon.amountOffCents ?? 0, currency: commerce.currency.toLowerCase(), duration: "once", name: coupon.code },
      );
      stripeCouponId = created.id;
      await prisma.coupon.update({ where: { id: coupon.id }, data: { stripeCouponId } });
    }
    discounts = [{ coupon: stripeCouponId }];
  }

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map((l) => ({
    quantity: l.quantity,
    price_data: {
      currency: commerce.currency.toLowerCase(),
      unit_amount: l.unitPriceCents,
      tax_behavior: "inclusive",
      product_data: { name: l.name, metadata: { kind: l.kind, id: l.id } },
    },
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    customer_email: email,
    customer_creation: "always",
    locale: "fr",
    discounts,
    allow_promotion_codes: discounts ? undefined : commerce.allowStripePromotionCodes || undefined,
    billing_address_collection: "auto",
    invoice_creation: { enabled: true },
    consent_collection: { terms_of_service: "required" },
    custom_text: { terms_of_service_acceptance: { message: commerce.withdrawalNotice } },
    success_url: `${env.appUrl}/commande/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}/panier?annule=1`,
    metadata: { orderId: order.id, orderNumber: order.number },
    payment_intent_data: { metadata: { orderId: order.id, orderNumber: order.number } },
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 h
  });

  if (!session.url) throw new CheckoutError("Impossible de créer la session de paiement");

  await prisma.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } });
  await prisma.dailyStat.upsert({
    where: { date: new Date(now.toISOString().slice(0, 10)) },
    create: { date: new Date(now.toISOString().slice(0, 10)), checkoutsStarted: 1 },
    update: { checkoutsStarted: { increment: 1 } },
  }).catch(() => undefined);

  return { url: session.url, orderId: order.id };
}
