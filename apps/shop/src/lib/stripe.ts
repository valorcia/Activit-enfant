import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let stripeClient: Stripe | null = null;

/** Client Stripe (serveur uniquement). Lève une erreur claire si la clé manque. */
export function getStripe(): Stripe {
  if (!env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY manquante : configurez Stripe dans les variables d'environnement.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey, { typescript: true });
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.stripeSecretKey && env.stripeWebhookSecret);
}

export function isStripeLiveMode(): boolean {
  return env.stripeSecretKey.startsWith("sk_live_");
}
