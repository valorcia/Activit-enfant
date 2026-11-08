import "server-only";
import Stripe from "stripe";
import { getSecret, getSecrets } from "@/lib/integrations/secrets";

let stripeClient: { key: string; client: Stripe } | null = null;

/**
 * Client Stripe (serveur uniquement). La clé vient d'Admin → Paramètres →
 * Intégrations (prioritaire) ou de STRIPE_SECRET_KEY. Lève une erreur claire si absente.
 */
export async function getStripe(): Promise<Stripe> {
  const key = await getSecret("stripe.secretKey");
  if (!key) {
    throw new Error("Clé secrète Stripe manquante : renseignez-la dans Administration → Paramètres → Intégrations.");
  }
  if (!stripeClient || stripeClient.key !== key) {
    stripeClient = { key, client: new Stripe(key, { typescript: true }) };
  }
  return stripeClient.client;
}

export async function getStripeWebhookSecret(): Promise<string> {
  return getSecret("stripe.webhookSecret");
}

export async function isStripeConfigured(): Promise<boolean> {
  const s = await getSecrets(["stripe.secretKey", "stripe.webhookSecret"]);
  return Boolean(s["stripe.secretKey"] && s["stripe.webhookSecret"]);
}

export async function isStripeLiveMode(): Promise<boolean> {
  return (await getSecret("stripe.secretKey")).startsWith("sk_live_");
}
