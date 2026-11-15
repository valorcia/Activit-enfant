import type { CreatorContribution, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { creatorsSettingsSchema, type CreatorsSettings } from "@/lib/schemas/settings";

type Db = PrismaClient | Prisma.TransactionClient;

export const CREATORS_SETTINGS_KEY = "creators";

/**
 * Réglages du programme créatrices (communs à tous les univers), lus directement
 * en base (sans cache) : ils servent au calcul des commissions et des paiements.
 */
export async function getCreatorSettings(db: Db = defaultPrisma): Promise<CreatorsSettings> {
  const row = await db.siteSetting.findUnique({ where: { key: CREATORS_SETTINGS_KEY } }).catch(() => null);
  const parsed = creatorsSettingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : creatorsSettingsSchema.parse({});
}

export async function saveCreatorSettings(value: unknown, db: PrismaClient = defaultPrisma): Promise<CreatorsSettings> {
  const parsed = creatorsSettingsSchema.parse(value);
  await db.siteSetting.upsert({ where: { key: CREATORS_SETTINGS_KEY }, create: { key: CREATORS_SETTINGS_KEY, value: parsed }, update: { value: parsed } });
  return parsed;
}

/** Taux conseillé pour une proposition : apport (idée / tutoriel complet) + bonus d'exclusivité. */
export function rateForSubmission(sub: { contribution: CreatorContribution; exclusive: boolean }, settings: CreatorsSettings): number {
  const base = sub.contribution === "FULL_TUTORIAL" ? settings.fullTutorialRateBp : settings.ideaRateBp;
  return Math.min(9000, base + (sub.exclusive ? settings.exclusivityBonusBp : 0));
}

/** « 5 points » (espace insécable) */
export function formatPoints(bp: number): string {
  return `${(bp / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}\u00a0points`;
}

/** « 25 % », « 42,5 % » (espace insécable) */
export function formatRate(bp: number): string {
  return `${(bp / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}\u00a0%`;
}
