import { prisma } from "../db";
import { assetUrl } from "../storage";
import { kitType } from "./types";
import { ColoringSchema, GuideSchema, KIT_CONTENT_SCHEMAS, KitCustomizationSchema, PranksKitSchema, RecipesSchema, ScienceSchema, TreasureHuntSchema } from "./schemas";
import { buildGuideBookPages, buildRecipesBookPages, buildScienceBookPages } from "./pages-universes";
import { buildDiplomaPage, buildPranksPages, buildQuickStartPage, buildTreasureHuntPages, type KitImages } from "./pages";
import type { QuickStart } from "./schemas";
import type { BuildContext, BuiltPage } from "../layout/engine";
import { buildColoringPages, decorateColoringCover } from "./pages-coloring";
import { coloringOptionsOf } from "./generate";

/** Décore la couverture selon le type (cahier de coloriage : prénom ou ligne à compléter). */
export function decorateKitCover(book: { kitType: string; customization: unknown }, cover: BuiltPage, ctx: BuildContext): BuiltPage {
  if (kitType(book.kitType).format === "coloring") return decorateColoringCover(cover, ctx, coloringOptionsOf(book.customization));
  return cover;
}

/** Illustrations courantes d'un kit, indexées par emplacement (slot). */
export async function kitImages(bookId: string): Promise<KitImages> {
  const ills = await prisma.illustration.findMany({ where: { bookId, kind: "KIT", isCurrent: true, status: { notIn: ["REJECTED", "FAILED", "PENDING", "GENERATING"] }, assetId: { not: null } } });
  const out: KitImages = {};
  for (const i of ills) if (i.slot) out[i.slot] = { src: assetUrl(i.assetId), isDemo: i.isDemo, illustrationId: i.id };
  return out;
}

/**
 * Démarrage rapide d'un contenu : celui écrit par l'IA, sinon déduit des données du kit
 * (matériel et préparation du guide), pour que les anciens e-books en profitent aussi.
 */
export function quickStartOf(format: string, content: Record<string, unknown>): NonNullable<QuickStart> {
  const own = (content.demarrage_rapide ?? {}) as NonNullable<QuickStart>;
  if ((own.etapes?.length ?? 0) >= 2 || (own.materiel?.length ?? 0) > 0) return own;
  const short = (xs: unknown, n: number) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, n) : []);
  if (format === "treasure_hunt") {
    const g = (content.guide ?? {}) as Record<string, unknown>;
    return { ...own, materiel: short(g.materiel, 6), etapes: short(g.preparation, 3), astuce: own.astuce || short(g.securite, 1)[0] || "" };
  }
  if (format === "pranks") {
    const g = (content.guide_parents ?? {}) as Record<string, unknown>;
    return { ...own, etapes: short(g.organisation, 3), materiel: [], astuce: own.astuce || short(g.securite, 1)[0] || "" };
  }
  return own;
}

/** Pages intérieures d'un kit structuré (null si le contenu est absent ou invalide). */
export async function buildKitInteriorPages(book: { id: string; kitType: string; kitContent: unknown; customization: unknown }, ctx: BuildContext): Promise<BuiltPage[] | null> {
  const pages = await buildKitBodyPages(book, ctx);
  if (!pages) return null;
  const def = kitType(book.kitType);
  const images = await kitImages(book.id);
  const img = images["planche-personnage"] ?? images["planche-personnages"] ?? images["lettre"] ?? images["lettre-arrivee"];
  const quick = buildQuickStartPage(ctx, quickStartOf(def.format ?? "", (book.kitContent ?? {}) as Record<string, unknown>), img);
  return quick ? [quick, ...pages] : pages;
}

async function buildKitBodyPages(book: { id: string; kitType: string; kitContent: unknown; customization: unknown }, ctx: BuildContext): Promise<BuiltPage[] | null> {
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
  if (def.format === "coloring") return buildColoringPages(ctx, ColoringSchema.parse(parsed.data), images, coloringOptionsOf(book.customization));
  if (def.format === "guide") return buildGuideBookPages(ctx, GuideSchema.parse(parsed.data), images);
  if (def.format === "recipes") return buildRecipesBookPages(ctx, RecipesSchema.parse(parsed.data), images);
  if (def.format === "science") {
    const pages = buildScienceBookPages(ctx, ScienceSchema.parse(parsed.data), images);
    const sci = ScienceSchema.parse(parsed.data);
    if (sci.diplome?.titre || sci.diplome?.texte) pages.push(buildDiplomaPage(ctx, { title: sci.diplome.titre ?? "Diplôme", body: sci.diplome.texte ?? "", img: images["diplome"] }));
    return pages;
  }
  return buildPranksPages(ctx, PranksKitSchema.parse(parsed.data), images);
}
