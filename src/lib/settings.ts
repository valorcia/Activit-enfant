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
