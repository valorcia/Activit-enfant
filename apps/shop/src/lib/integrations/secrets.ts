import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { audit } from "@/lib/audit";

/**
 * Clés d'intégration (Stripe, Resend, Claude, OpenAI, Meta, TikTok, vidéo).
 * Source prioritaire : la table IntegrationSecret (saisie dans Admin → Paramètres
 * → Intégrations, chiffrée AES-256-GCM). Repli : variable d'environnement.
 * Les valeurs ne sont jamais renvoyées au navigateur ni écrites dans les logs.
 */
export const SECRET_DEFS = {
  "stripe.secretKey": { env: "STRIPE_SECRET_KEY", label: "Clé secrète Stripe" },
  "stripe.webhookSecret": { env: "STRIPE_WEBHOOK_SECRET", label: "Secret du webhook Stripe" },
  "stripe.publishableKey": { env: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", label: "Clé publiable Stripe" },
  "resend.apiKey": { env: "RESEND_API_KEY", label: "Clé API Resend" },
  "anthropic.apiKey": { env: "ANTHROPIC_API_KEY", label: "Clé API Claude (Anthropic)" },
  "openai.apiKey": { env: "OPENAI_API_KEY", label: "Clé API OpenAI" },
  "meta.appId": { env: "META_APP_ID", label: "Identifiant d'application Meta" },
  "meta.appSecret": { env: "META_APP_SECRET", label: "Clé secrète d'application Meta" },
  "meta.capiToken": { env: "META_CAPI_TOKEN", label: "Jeton Conversions API Meta" },
  "tiktok.clientKey": { env: "TIKTOK_CLIENT_KEY", label: "Client key TikTok" },
  "tiktok.clientSecret": { env: "TIKTOK_CLIENT_SECRET", label: "Client secret TikTok" },
  "tiktok.adsAccessToken": { env: "TIKTOK_ADS_ACCESS_TOKEN", label: "Jeton Marketing API TikTok" },
  "tiktok.eventsToken": { env: "TIKTOK_EVENTS_TOKEN", label: "Jeton Events API TikTok" },
  "tiktok.advertiserIds": { env: "TIKTOK_ADVERTISER_IDS", label: "Identifiants des comptes publicitaires TikTok" },
  "runway.apiKey": { env: "RUNWAY_API_KEY", label: "Clé API Runway" },
  "etsy.apiKey": { env: "ETSY_API_KEY", label: "Keystring de l'application Etsy" },
  "etsy.sharedSecret": { env: "ETSY_SHARED_SECRET", label: "Shared secret de l'application Etsy" },
  "google.geminiApiKey": { env: "GEMINI_API_KEY", label: "Clé API Google Gemini (Veo)" },
} as const;

export type SecretKey = keyof typeof SECRET_DEFS;
export const SECRET_KEYS = Object.keys(SECRET_DEFS) as SecretKey[];

export function isSecretKey(k: string): k is SecretKey {
  return Object.prototype.hasOwnProperty.call(SECRET_DEFS, k);
}

export type SecretSource = "database" | "environment" | "missing";
export interface SecretStatus {
  key: SecretKey;
  label: string;
  envName: string;
  source: SecretSource;
  hint: string | null; // 4 derniers caractères
  updatedAt: string | null;
}

/** Le chiffrement exige MARKETING_ENCRYPTION_KEY ou AUTH_SECRET. */
export function canEncryptSecrets(): boolean {
  return Boolean(process.env.MARKETING_ENCRYPTION_KEY || process.env.AUTH_SECRET);
}

const TTL_MS = 60_000;
let cache: { at: number; values: Map<string, { value: string; hint: string | null; updatedAt: Date }> } | null = null;

export function invalidateSecretCache() {
  cache = null;
}

async function loadDbSecrets(db: PrismaClient) {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const values = new Map<string, { value: string; hint: string | null; updatedAt: Date }>();
  try {
    const rows = await db.integrationSecret.findMany();
    for (const row of rows) {
      try {
        values.set(row.key, { value: decryptSecret(row.valueEnc), hint: row.hint, updatedAt: row.updatedAt });
      } catch {
        // Clé de chiffrement changée ou valeur corrompue : ignorée (repli sur l'environnement)
        console.warn(`[integrations] valeur illisible pour ${row.key} (clé de chiffrement modifiée ?)`);
      }
    }
  } catch (e) {
    // Base injoignable ou table absente : repli silencieux sur l'environnement
    console.warn("[integrations] lecture des clés impossible, repli sur l'environnement :", e instanceof Error ? e.message.split("\n")[0] : e);
    return values; // non mis en cache
  }
  cache = { at: Date.now(), values };
  return values;
}

function envValue(key: SecretKey): string {
  return (process.env[SECRET_DEFS[key].env] ?? "").trim();
}

/** Valeur d'une clé : base (chiffrée) en priorité, sinon variable d'environnement, sinon chaîne vide. */
export async function getSecret(key: SecretKey, db: PrismaClient = defaultPrisma): Promise<string> {
  const values = await loadDbSecrets(db);
  return values.get(key)?.value || envValue(key);
}

/** Plusieurs clés en une lecture. */
export async function getSecrets<K extends SecretKey>(keys: readonly K[], db: PrismaClient = defaultPrisma): Promise<Record<K, string>> {
  const values = await loadDbSecrets(db);
  const out = {} as Record<K, string>;
  for (const k of keys) out[k] = values.get(k)?.value || envValue(k);
  return out;
}

function hintOf(value: string): string | null {
  return value.length >= 8 ? value.slice(-4) : null;
}

/** État de chaque clé pour l'administration — jamais la valeur. */
export async function getSecretStatus(db: PrismaClient = defaultPrisma): Promise<SecretStatus[]> {
  const values = await loadDbSecrets(db);
  return SECRET_KEYS.map((key) => {
    const dbEntry = values.get(key);
    const env = envValue(key);
    const source: SecretSource = dbEntry ? "database" : env ? "environment" : "missing";
    return {
      key,
      label: SECRET_DEFS[key].label,
      envName: SECRET_DEFS[key].env,
      source,
      hint: dbEntry ? dbEntry.hint : env ? hintOf(env) : null,
      updatedAt: dbEntry ? dbEntry.updatedAt.toISOString() : null,
    };
  });
}

export async function setSecret(key: SecretKey, value: string, actor: { userId?: string | null; actor?: string | null } = {}, db: PrismaClient = defaultPrisma): Promise<void> {
  const clean = value.trim();
  if (!clean) throw new Error("Valeur vide");
  if (clean.length > 4000) throw new Error("Valeur trop longue");
  if (!canEncryptSecrets()) throw new Error("Chiffrement impossible : définissez AUTH_SECRET (ou MARKETING_ENCRYPTION_KEY) dans l'hébergement");
  const valueEnc = encryptSecret(clean);
  const hint = hintOf(clean);
  await db.integrationSecret.upsert({
    where: { key },
    create: { key, valueEnc, hint, updatedById: actor.userId ?? null },
    update: { valueEnc, hint, updatedById: actor.userId ?? null },
  });
  invalidateSecretCache();
  await audit({ userId: actor.userId, actor: actor.actor, action: "integration.secret.set", entity: "integrationSecret", entityId: key });
}

export async function deleteSecret(key: SecretKey, actor: { userId?: string | null; actor?: string | null } = {}, db: PrismaClient = defaultPrisma): Promise<void> {
  await db.integrationSecret.deleteMany({ where: { key } });
  invalidateSecretCache();
  await audit({ userId: actor.userId, actor: actor.actor, action: "integration.secret.delete", entity: "integrationSecret", entityId: key });
}
