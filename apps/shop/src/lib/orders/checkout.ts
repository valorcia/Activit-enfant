import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getSetting } from "@/lib/settings";
import { applyCoupon, computeTotals, effectivePrice, type CartLineInput, type PricedLine } from "@/lib/pricing";
import { nextOrderNumber } from "./numbers";
import { siteBaseUrl, statementDescriptorSuffix } from "@/lib/sites/host";

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
  /** Univers de la boutique où a lieu l'achat (défaut : univers par défaut). */
  site?: { id: string; name: string; primaryDomain: string | null; domains: string[] } | null;
}

/**
 * Valide le panier côté serveur (prix recalculés depuis la base, jamais depuis
 * le client), crée la commande en attente et la session Stripe Checkout.
 */
export async function priceCart(lines: CartLineInput[], now = new Date(), siteId?: string): Promise<PricedLine[]> {
  if (lines.length === 0) throw new CheckoutError("Votre panier est vide", "EMPTY_CART");
  if (lines.length > 50) throw new CheckoutError("Trop d'articles dans le panier", "TOO_MANY_ITEMS");
  const productIds = lines.filter((l) => l.kind === "product").map((l) => l.id);
  const bundleIds = lines.filter((l) => l.kind === "bundle").map((l) => l.id);

  const [products, bundles] = await Promise.all([
    productIds.length ? prisma.product.findMany({ where: { id: { in: productIds }, status: "PUBLISHED", ...(siteId ? { siteId } : {}) }, include: { _count: { select: { files: true } } } }) : [],
    bundleIds.length ? prisma.bundle.findMany({ where: { id: { in: bundleIds }, status: "PUBLISHED", ...(siteId ? { siteId } : {}) }, include: { items: { include: { product: { select: { name: true, _count: { select: { files: true } } } } } } } }) : [],
  ]);

  const priced: PricedLine[] = [];
  for (const line of lines) {
    const qty = Math.max(1, Math.min(10, Math.floor(line.quantity || 1)));
    if (line.kind === "product") {
      const p = products.find((x) => x.id === line.id);
      if (!p) throw new CheckoutError("Un produit du panier n'est plus disponible", "UNAVAILABLE");
      // Jamais de vente d'un produit qui ne peut rien livrer
      if (p._count.files === 0) throw new CheckoutError(`« ${p.name} » n'est pas encore disponible au téléchargement. Revenez très bientôt !`, "NOT_DOWNLOADABLE");
      const ep = effectivePrice(p, now);
      priced.push({ kind: "product", id: p.id, name: p.name, quantity: qty, unitPriceCents: ep.priceCents, compareAtCents: ep.compareAtCents, totalCents: ep.priceCents * qty, taxRateBp: p.taxRateBp });
    } else {
      const b = bundles.find((x) => x.id === line.id);
      if (!b || b.items.length === 0) throw new CheckoutError("Un pack du panier n'est plus disponible", "UNAVAILABLE");
      const missing = b.items.find((it) => it.product._count.files === 0);
      if (missing) throw new CheckoutError(`Le pack « ${b.name} » n'est pas encore disponible : « ${missing.product.name} » n'a pas encore de fichier.`, "NOT_DOWNLOADABLE");
      priced.push({ kind: "bundle", id: b.id, name: b.name, quantity: qty, unitPriceCents: b.priceCents, compareAtCents: null, totalCents: b.priceCents * qty, taxRateBp: b.taxRateBp });
    }
  }
  return priced;
}

export async function createCheckoutSession(input: CheckoutInput): Promise<{ url: string; orderId: string }> {
  const stripe = await getStripe();
  const site = input.site ?? null;
  const commerce = await getSetting("commerce", site?.id);
  const baseUrl = site ? siteBaseUrl(site, env.appUrl) : env.appUrl;
  const now = new Date();
  // Seuls les produits de l'univers courant sont vendus sur son domaine
  const lines = await priceCart(input.lines, now, site?.id);

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
        ...(site ? { siteId: site.id } : {}),
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
    // Case « J'accepte les CGV » sur Stripe : nécessite l'URL des CGV dans les paramètres publics Stripe
    ...(commerce.collectTermsConsent
      ? { consent_collection: { terms_of_service: "required" as const }, custom_text: { terms_of_service_acceptance: { message: commerce.withdrawalNotice }, submit: { message: commerce.withdrawalNotice } } }
      : { custom_text: { submit: { message: commerce.withdrawalNotice } } }),
    success_url: `${baseUrl}/commande/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/panier?annule=1`,
    metadata: { orderId: order.id, orderNumber: order.number, siteId: order.siteId },
    payment_intent_data: {
      metadata: { orderId: order.id, orderNumber: order.number, siteId: order.siteId },
      // Libellé bancaire : nom court de l'univers (« BOUTIQUE* LA MALLE A JEUX »)
      ...(site ? { statement_descriptor_suffix: statementDescriptorSuffix(site.name) } : {}),
    },
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
