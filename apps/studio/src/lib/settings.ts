import { prisma } from "./db";
import { AiSettingsSchema, DEFAULT_AI_SETTINGS, type AiSettings } from "./schemas/settings";

const KEY = "ai";

export async function getAiSettings(): Promise<AiSettings> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_AI_SETTINGS;
  const parsed = AiSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_AI_SETTINGS;
}

export async function saveAiSettings(input: unknown): Promise<AiSettings> {
  const data = AiSettingsSchema.parse(input);
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: data }, update: { value: data } });
  return data;
}

/** Indique quelles clés API sont présentes côté serveur, sans jamais les exposer. */
export function providerAvailability() {
  return {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
}

// ---------------------------------------------------------------------------
// Boutique
// ---------------------------------------------------------------------------
import { ShopSettingsSchema, DEFAULT_SHOP_SETTINGS, type ShopSettings } from "./schemas/settings";

const SHOP_KEY = "shop";

/** Réglages boutique complets (clé API incluse) — usage serveur uniquement. Repli sur SHOP_API_URL / SHOP_API_KEY. */
export async function getShopSettings(): Promise<ShopSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SHOP_KEY } });
  const parsed = row ? ShopSettingsSchema.safeParse(row.value) : null;
  const base = parsed?.success ? parsed.data : DEFAULT_SHOP_SETTINGS;
  return {
    ...base,
    shopApiUrl: (base.shopApiUrl || process.env.SHOP_API_URL || "").replace(/\/$/, ""),
    shopApiKey: base.shopApiKey || process.env.SHOP_API_KEY || "",
  };
}

/** Enregistre les réglages ; une clé vide conserve la clé existante. */
export async function saveShopSettings(input: unknown): Promise<ShopSettings> {
  const data = ShopSettingsSchema.parse(input);
  if (!data.shopApiKey) {
    const row = await prisma.setting.findUnique({ where: { key: SHOP_KEY } });
    const prev = row ? ShopSettingsSchema.safeParse(row.value) : null;
    data.shopApiKey = prev?.success ? prev.data.shopApiKey : "";
  }
  await prisma.setting.upsert({ where: { key: SHOP_KEY }, create: { key: SHOP_KEY, value: data }, update: { value: data } });
  return data;
}

/** Version sans secret, envoyée au navigateur (8 premiers caractères de la clé seulement). */
export function maskShopSettings(s: ShopSettings) {
  return { ...s, shopApiKey: "", shopApiKeyPreview: s.shopApiKey ? `${s.shopApiKey.slice(0, 8)}…` : null, shopConfigured: Boolean(s.shopApiUrl && s.shopApiKey) };
}
export type ShopSettingsPublic = ReturnType<typeof maskShopSettings>;
