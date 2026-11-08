import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { getSetting } from "@/lib/settings";
import { applyRefund, fulfillOrderFromSession, markOrderExpired, markOrderFailed, recordStripeEvent } from "@/lib/orders/fulfillment";
import { sendOrderConfirmation, sendRefundNotification } from "@/lib/orders/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Stripe. La signature est vérifiée avec le secret de webhook (Intégrations ou STRIPE_WEBHOOK_SECRET) ; chaque
 * événement est enregistré avant traitement (idempotence). La livraison des
 * fichiers n'a lieu qu'ici, après confirmation serveur du paiement.
 */
export async function POST(req: Request) {
  const webhookSecret = await getStripeWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = (await getStripe()).webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.warn("[stripe] signature invalide", err);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const isNew = await recordStripeEvent(prisma, event);
  if (!isNew) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const commerce = await getSetting("commerce");
        const result = await fulfillOrderFromSession(session, { invoicePrefix: commerce.invoicePrefix, maxDownloads: commerce.downloadMaxPerEntitlement });
        if (result.status === "fulfilled" && result.orderId) {
          await sendOrderConfirmation(result.orderId);
        }
        break;
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrderFailed(session.id);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrderExpired(session.id);
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await markOrderFailed(intent.id);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const orderId = await applyRefund({
          payment_intent: typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null,
          amount_refunded: charge.amount_refunded,
          amount: charge.amount,
          refunds: charge.refunds ? { data: charge.refunds.data.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason ?? null })) } : null,
        });
        if (orderId) await sendRefundNotification(orderId, charge.amount_refunded);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe] erreur de traitement ${event.type}`, err);
    // On retire l'enregistrement pour permettre une nouvelle tentative de Stripe
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    return NextResponse.json({ error: "Erreur de traitement" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
