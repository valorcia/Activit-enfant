"use server";
import { z } from "zod";
import { CheckoutError, createCheckoutSession } from "@/lib/orders/checkout";
import { isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/marketing/newsletter";

const schema = z.object({
  lines: z.array(z.object({ kind: z.enum(["product", "bundle"]), id: z.string().min(1), quantity: z.number().int().min(1).max(10) })).min(1).max(50),
  email: z.string().email().optional().nullable().or(z.literal("")),
  couponCode: z.string().max(40).optional().nullable(),
  marketingConsent: z.boolean().optional(),
  utm: z.record(z.string(), z.string()).optional(),
});

export type CheckoutActionResult = { ok: true; url: string } | { ok: false; error: string };

export async function startCheckoutAction(raw: unknown): Promise<CheckoutActionResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Panier invalide. Vérifiez votre email et réessayez." };
  if (!isStripeConfigured()) return { ok: false, error: "Le paiement n'est pas encore configuré sur ce site (clés Stripe manquantes)." };
  const input = parsed.data;
  try {
    const email = input.email || null;
    if (email && input.marketingConsent) {
      await prisma.marketingConsent.create({ data: { email: email.toLowerCase(), channel: "email", purpose: "promotions", granted: true, text: NEWSLETTER_CONSENT_TEXT, source: "checkout" } });
    }
    const { url } = await createCheckoutSession({ lines: input.lines, email, couponCode: input.couponCode, utm: input.utm, marketingConsent: input.marketingConsent, consentText: input.marketingConsent ? NEWSLETTER_CONSENT_TEXT : null });
    return { ok: true, url };
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: e.message };
    console.error("[checkout]", e);
    return { ok: false, error: "Impossible de démarrer le paiement. Réessayez dans un instant." };
  }
}
