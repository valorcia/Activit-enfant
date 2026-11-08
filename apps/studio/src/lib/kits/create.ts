import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { getStudioSettings } from "../settings";
import { defaultThemeForBook } from "../layout/themes";
import { KIT_CONTENT_SCHEMAS, KitCustomizationSchema, KitPlanSchema, detectKitContentFormat, type KitPlan } from "./schemas";
import { KIT_TYPES, kitType, kitTypeFromShop } from "./types";
import { applyKitContent, type KitContent } from "./generate";

/**
 * Création d'un kit (utilisée par les actions serveur et par le pilote automatique du worker).
 */

const KIT_KEYS = KIT_TYPES.map((k) => k.key) as [string, ...string[]];

export const CreateKitSchema = z.object({
  kitType: z.enum(KIT_KEYS),
  title: z.string().min(1).max(140),
  subtitle: z.string().max(240).optional(),
  ageRange: z.string().regex(/^\d+-\d+$/),
  artStyle: z.string().default("aquarelle"),
  pageFormat: z.string().default("A4_PORTRAIT"),
  brief: z.string().max(20000).optional(),
  customization: KitCustomizationSchema,
});
export type CreateKitInput = z.input<typeof CreateKitSchema>;

export function kitTypeForContent(format: "treasure_hunt" | "pranks", content: Record<string, unknown>): string {
  const b = (content.boutique ?? {}) as { categorySlug?: string; template?: string; name?: string; universe?: string };
  const title = String(content.titre ?? b.name ?? "");
  if (format === "pranks") return /lutin/i.test(title) ? "lutins-farceurs" : "kit-noel";
  return kitTypeFromShop({ categorySlug: b.categorySlug ?? "chasses-au-tresor", template: b.template, name: title, universe: b.universe });
}

export function planFromContent(format: "treasure_hunt" | "pranks", content: KitContent): KitPlan {
  const raw = content as unknown as Record<string, unknown>;
  const key = kitTypeForContent(format, raw);
  const def = kitType(key);
  const b = content.boutique ?? {};
  const hunt = "enigmes" in content ? content : null;
  const pranks = "idees" in content ? content : null;
  return KitPlanSchema.parse({
    kitType: key,
    title: content.titre,
    subtitle: content.sous_titre ?? "",
    ageRange: b.ageMin != null && b.ageMax != null ? `${b.ageMin}-${b.ageMax}` : def.defaultAge,
    universe: b.universe ?? def.defaultUniverse ?? "",
    heroName: hunt?.personnage?.nom ?? pranks?.personnages?.[0]?.nom ?? "",
    heroDescription: hunt?.personnage?.description ?? pranks?.personnages?.[0]?.description ?? "",
    companion: hunt?.personnage?.compagnon ?? pranks?.personnages?.[1]?.nom ?? "",
    place: hunt?.personnage?.vehicule ?? "",
    tone: "",
    count: hunt ? hunt.enigmes.length : pranks!.idees.length,
    priceCents: b.priceCents,
    shopCategorySlug: b.categorySlug ?? def.shopCategory,
    notes: "Contenu complet importé tel quel (aucun appel IA pour le texte).",
  });
}

export async function createKitBookRaw(input: CreateKitInput) {
  const data = CreateKitSchema.parse(input);
  const def = kitType(data.kitType);
  const studio = await getStudioSettings();
  const count = data.customization.count ?? def.defaultCount;
  const priceCents = data.customization.priceCents ?? studio.priceByKitType[def.key] ?? def.defaultPriceCents;
  const book = await prisma.book.create({
    data: {
      title: data.title, subtitle: data.subtitle || null, collection: studio.defaultAuthor || "La Malle à Jeux",
      bookType: def.key, kitType: def.key, ageRange: data.ageRange, targetCount: count, artStyle: data.artStyle, pageFormat: data.pageFormat,
      brief: data.brief || null, theme: defaultThemeForBook(def.family === "kit" ? "kit" : def.key, data.ageRange), status: "DRAFT", cover: { introduction: "" },
      customization: { ...data.customization, count, priceCents } as Prisma.InputJsonValue,
      shopListing: { priceCents, categorySlug: data.customization.shopCategorySlug ?? def.shopCategory, template: data.customization.shopTemplate ?? def.template, universe: data.customization.universe || def.defaultUniverse } as Prisma.InputJsonValue,
    },
  });
  return { bookId: book.id };
}


/** Crée le kit à partir d'un plan validé et importe le contenu complet éventuel. */
export async function createKitFromPlan(input: { plan: KitPlan; brief?: string; contentJson?: string }): Promise<{ bookId: string; contentImported: boolean }> {
  const plan = KitPlanSchema.parse(input.plan);
  const def = kitType(plan.kitType);
  const { bookId } = await createKitBookRaw({
    kitType: def.key,
    title: plan.title,
    subtitle: plan.subtitle,
    ageRange: plan.ageRange,
    brief: [input.brief?.trim() && !input.contentJson ? input.brief.trim() : "", plan.notes].filter(Boolean).join("\n\n").slice(0, 20000) || undefined,
    customization: KitCustomizationSchema.parse({ universe: plan.universe, heroName: plan.heroName, heroDescription: plan.heroDescription, companion: plan.companion, place: plan.place, tone: plan.tone || "Joyeux et complice", count: plan.count, priceCents: plan.priceCents, shopCategorySlug: plan.shopCategorySlug, extraInstructions: plan.notes }),
  });
  let contentImported = false;
  if (input.contentJson) {
    const json = JSON.parse(input.contentJson);
    const format = detectKitContentFormat(json);
    if (format) {
      await applyKitContent(bookId, KIT_CONTENT_SCHEMAS[format].parse(json) as KitContent);
      contentImported = true;
    }
  }
  return { bookId, contentImported };
}

export { KIT_TYPES };

/**
 * Brief collé → plan (et contenu complet éventuel), utilisable hors de l'interface (pilote automatique).
 * JSON complet des prompts → import direct ; JSON de plan → plan ; texte libre → plan par l'IA
 * (en mode copier-coller, lève ManualInputRequiredError : la demande apparaît dans « À coller »).
 */
export async function resolveBrief(text: string, opts: { jobId?: string } = {}): Promise<{ plan: KitPlan; contentJson?: string; source: "ia" | "json" | "contenu" }> {
  const { extractJson } = await import("../ai/structured");
  const { cleanPastedJson } = await import("../ai/manual-core");
  const { generateKitPlan } = await import("./generate");
  const t = text.trim();
  if (t.length < 10) throw new Error("Brief trop court : collez une demande ou un JSON de kit.");
  const json = t.includes("{") ? extractJson(cleanPastedJson(t)) : null;
  if (json) {
    const format = detectKitContentFormat(json);
    if (format) {
      const parsed = KIT_CONTENT_SCHEMAS[format].safeParse(json);
      if (!parsed.success) throw new Error(`JSON de kit reconnu mais incomplet : ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ")}`);
      return { plan: planFromContent(format, parsed.data as KitContent), contentJson: JSON.stringify(parsed.data), source: "contenu" };
    }
    const plan = KitPlanSchema.safeParse(json);
    if (plan.success) return { plan: normalizePlan(plan.data), source: "json" };
  }
  return { plan: normalizePlan(await generateKitPlan(t, opts)), source: "ia" };
}

function normalizePlan(plan: KitPlan): KitPlan {
  return { ...plan, kitType: KIT_TYPES.some((k) => k.key === plan.kitType) ? plan.kitType : "chasse-au-tresor" };
}
