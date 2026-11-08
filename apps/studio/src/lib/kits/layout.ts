import { prisma } from "../db";
import { assetUrl } from "../storage";
import { kitType } from "./types";
import { KIT_CONTENT_SCHEMAS, KitCustomizationSchema, PranksKitSchema, TreasureHuntSchema } from "./schemas";
import { buildPranksPages, buildTreasureHuntPages, type KitImages } from "./pages";
import type { BuildContext, BuiltPage } from "../layout/engine";

/** Illustrations courantes d'un kit, indexées par emplacement (slot). */
export async function kitImages(bookId: string): Promise<KitImages> {
  const ills = await prisma.illustration.findMany({ where: { bookId, kind: "KIT", isCurrent: true, status: { notIn: ["REJECTED", "FAILED", "PENDING", "GENERATING"] }, assetId: { not: null } } });
  const out: KitImages = {};
  for (const i of ills) if (i.slot) out[i.slot] = { src: assetUrl(i.assetId), isDemo: i.isDemo, illustrationId: i.id };
  return out;
}

/** Pages intérieures d'un kit structuré (null si le contenu est absent ou invalide). */
export async function buildKitInteriorPages(book: { id: string; kitType: string; kitContent: unknown; customization: unknown }, ctx: BuildContext): Promise<BuiltPage[] | null> {
  const def = kitType(book.kitType);
  if (def.family !== "kit" || !def.format || !book.kitContent) return null;
  const parsed = KIT_CONTENT_SCHEMAS[def.format].safeParse(book.kitContent);
  if (!parsed.success) return null;
  const images = await kitImages(book.id);
  if (def.format === "treasure_hunt") {
    const custom = KitCustomizationSchema.safeParse(book.customization ?? {});
    const label = custom.success && /agent|enqu|mission|espion/i.test(custom.data.universe) ? "Mission" : "Défi";
    return buildTreasureHuntPages(ctx, TreasureHuntSchema.parse(parsed.data), images, { challengeLabel: label });
  }
  return buildPranksPages(ctx, PranksKitSchema.parse(parsed.data), images);
}
