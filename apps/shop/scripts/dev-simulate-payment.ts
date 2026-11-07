/**
 * DÉVELOPPEMENT UNIQUEMENT — simule la confirmation d'un paiement pour tester
 * la livraison numérique sans Stripe (webhook). Refuse de s'exécuter en
 * production ou avec une clé Stripe live.
 *
 * Usage : pnpm tsx scripts/dev-simulate-payment.ts <slug-produit> [email]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { fulfillOrderFromSession } from "../src/lib/orders/fulfillment";
import { nextOrderNumber } from "../src/lib/orders/numbers";
import { orderAccessUrl } from "../src/lib/orders/access";

if (process.env.NODE_ENV === "production" || (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_")) {
  console.error("Refusé : ce script ne doit jamais être exécuté en production.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const [slug, email = "test@example.com"] = process.argv.slice(2);
  if (!slug) throw new Error("Indiquez le slug d'un produit publié");
  const product = await prisma.product.findUniqueOrThrow({ where: { slug } });
  const sessionId = `cs_test_simulated_${Date.now()}`;
  const order = await prisma.$transaction(async (tx) => {
    const number = await nextOrderNumber(tx, "CC");
    return tx.order.create({
      data: {
        number, email, status: "PENDING", currency: product.currency,
        subtotalCents: product.priceCents, totalCents: product.priceCents, taxCents: 0,
        stripeCheckoutSessionId: sessionId,
        items: { create: [{ productId: product.id, name: product.name, unitPriceCents: product.priceCents, quantity: 1, totalCents: product.priceCents, taxRateBp: product.taxRateBp }] },
      },
    });
  });
  const result = await fulfillOrderFromSession({
    id: sessionId, payment_status: "paid", payment_intent: `pi_simulated_${Date.now()}`, customer: null,
    customer_details: { email, name: "Client Test", address: null, phone: null, tax_exempt: null, tax_ids: null },
    amount_total: product.priceCents, currency: product.currency.toLowerCase(),
  } as never, {}, prisma);
  console.log(`Commande ${order.number} → ${result.status}, ${result.entitlementIds.length} droit(s) de téléchargement`);
  console.log(`Page d'accès : ${orderAccessUrl(order.id)}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
