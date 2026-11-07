/** URL publique : NEXT_PUBLIC_APP_URL, sinon l'URL fournie par Vercel, sinon localhost. */
export function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/**
 * Accès centralisé aux variables d'environnement.
 * Les secrets (Stripe, S3, Resend…) ne sont lus que côté serveur.
 */
export const env = {
  appUrl: resolveAppUrl(),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",

  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",

  storageDriver: (process.env.STORAGE_DRIVER ?? "local") as "local" | "s3",
  storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? "./storage",
  s3: {
    bucket: process.env.S3_BUCKET ?? "",
    region: process.env.S3_REGION ?? "eu-west-3",
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "") || undefined,
  },

  emailDriver: (process.env.EMAIL_DRIVER ?? "console") as "console" | "resend",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Boutique <no-reply@example.com>",

  downloadTokenSecret: process.env.DOWNLOAD_TOKEN_SECRET ?? process.env.AUTH_SECRET ?? "dev-secret",
  cronSecret: process.env.CRON_SECRET ?? "",
  authSecret: process.env.AUTH_SECRET ?? "",
};

export function assertServerEnv(keys: Array<keyof typeof env>) {
  for (const key of keys) {
    const v = env[key];
    if (!v || (typeof v === "string" && v.length === 0)) {
      throw new Error(`Variable d'environnement manquante : ${String(key)}`);
    }
  }
}
