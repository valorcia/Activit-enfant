import { prisma } from "./db";
import { AiSettingsSchema, DEFAULT_AI_SETTINGS, type AiSettings } from "./schemas/settings";

const KEY = "ai";

/**
 * Réglages IA par défaut quand rien n'a été enregistré : jamais le générateur de démonstration en ligne.
 * Clé Claude → Claude pour le texte ; clé OpenAI → GPT Image pour les images ; sans clé → mode copier-coller.
 */
export function defaultAiSettingsFromEnv(env: NodeJS.ProcessEnv = process.env): AiSettings {
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);
  const hasOpenai = Boolean(env.OPENAI_API_KEY);
  const textProvider = hasAnthropic ? "anthropic" : hasOpenai ? "openai" : "mock";
  const imageProvider = hasOpenai ? "openai" : "mock";
  const textOk = textProvider !== "mock";
  const imageOk = imageProvider !== "mock";
  return AiSettingsSchema.parse({
    ...DEFAULT_AI_SETTINGS,
    textProvider,
    textModel: textProvider === "openai" ? "gpt-5" : "claude-opus-5-5",
    imageProvider,
    mode: textOk && imageOk ? "api" : "manual",
    manualFor: textOk && imageOk ? "all" : textOk ? "images" : imageOk ? "text" : "all",
    // En local sans aucune clé (développement), on garde la démonstration
    ...(!textOk && !imageOk && env.NODE_ENV !== "production" ? { mode: "api", manualFor: "all" } : {}),
  });
}

export async function getAiSettings(): Promise<AiSettings> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return defaultAiSettingsFromEnv();
  const parsed = AiSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : defaultAiSettingsFromEnv();
}

/** Le texte ou les images sortiront du générateur de démonstration (aucun rapport avec le brief). */
export function usesDemoProviders(s: AiSettings): { text: boolean; images: boolean } {
  const manualText = s.mode === "manual" && (s.manualFor === "all" || s.manualFor === "text");
  const manualImages = s.mode === "manual" && (s.manualFor === "all" || s.manualFor === "images");
  return { text: !manualText && s.textProvider === "mock", images: !manualImages && s.imageProvider === "mock" };
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

// ---------------------------------------------------------------------------
// Studio (nom, charte d'illustration, prix par défaut par type)
// ---------------------------------------------------------------------------
import { StudioSettingsSchema, DEFAULT_STUDIO_SETTINGS, type StudioSettings } from "./schemas/settings";

const STUDIO_KEY = "studio";

export async function getStudioSettings(): Promise<StudioSettings> {
  const row = await prisma.setting.findUnique({ where: { key: STUDIO_KEY } }).catch(() => null);
  const parsed = row ? StudioSettingsSchema.safeParse(row.value) : null;
  return parsed?.success ? parsed.data : DEFAULT_STUDIO_SETTINGS;
}

export async function saveStudioSettings(input: unknown): Promise<StudioSettings> {
  const data = StudioSettingsSchema.parse(input);
  await prisma.setting.upsert({ where: { key: STUDIO_KEY }, create: { key: STUDIO_KEY, value: data }, update: { value: data } });
  return data;
}

// ---------------------------------------------------------------------------
// Vidéos publicitaires
// ---------------------------------------------------------------------------
import { VideoSettingsSchema, DEFAULT_VIDEO_SETTINGS, type VideoSettings } from "./schemas/settings";

const VIDEO_KEY = "video";

/** Réglages vidéo complets (clé Runway incluse) — usage serveur uniquement. Repli sur RUNWAY_API_KEY. */
export async function getVideoSettings(): Promise<VideoSettings> {
  const row = await prisma.setting.findUnique({ where: { key: VIDEO_KEY } }).catch(() => null);
  const parsed = row ? VideoSettingsSchema.safeParse(row.value) : null;
  const base = parsed?.success ? parsed.data : DEFAULT_VIDEO_SETTINGS;
  return { ...base, runwayApiKey: base.runwayApiKey || process.env.RUNWAY_API_KEY || "" };
}

/** Enregistre les réglages ; une clé vide conserve la clé existante. */
export async function saveVideoSettings(input: unknown): Promise<VideoSettings> {
  const data = VideoSettingsSchema.parse(input);
  const row = await prisma.setting.findUnique({ where: { key: VIDEO_KEY } });
  const prev = row ? VideoSettingsSchema.safeParse(row.value) : null;
  if (!data.runwayApiKey) data.runwayApiKey = prev?.success ? prev.data.runwayApiKey : "";
  await prisma.setting.upsert({ where: { key: VIDEO_KEY }, create: { key: VIDEO_KEY, value: data }, update: { value: data } });
  return data;
}

/** Version sans secret pour le navigateur. */
export function maskVideoSettings(s: VideoSettings) {
  return { ...s, runwayApiKey: "", runwayKeyPreview: s.runwayApiKey ? `${s.runwayApiKey.slice(0, 8)}…` : null, runwayConfigured: Boolean(s.runwayApiKey) };
}
export type VideoSettingsPublic = ReturnType<typeof maskVideoSettings>;

// ---------------------------------------------------------------------------
// Pilote automatique
// ---------------------------------------------------------------------------
import { AutopilotSettingsSchema, DEFAULT_AUTOPILOT_SETTINGS, type AutopilotSettings } from "./schemas/settings";

const AUTOPILOT_KEY = "autopilot";

export async function getAutopilotSettings(): Promise<AutopilotSettings> {
  const row = await prisma.setting.findUnique({ where: { key: AUTOPILOT_KEY } }).catch(() => null);
  const parsed = row ? AutopilotSettingsSchema.safeParse(row.value) : null;
  return parsed?.success ? parsed.data : DEFAULT_AUTOPILOT_SETTINGS;
}

export async function saveAutopilotSettings(input: unknown): Promise<AutopilotSettings> {
  const data = AutopilotSettingsSchema.parse(input);
  await prisma.setting.upsert({ where: { key: AUTOPILOT_KEY }, create: { key: AUTOPILOT_KEY, value: data }, update: { value: data } });
  return data;
}
