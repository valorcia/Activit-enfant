import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { getStudioSettings } from "../settings";
import { defaultThemeForBook, themeForPreset } from "../layout/themes";
import { KIT_CONTENT_SCHEMAS, KitCustomizationSchema, KitPlanSchema, detectKitContentFormat, type KitContentFormat, type KitPlan } from "./schemas";
import { KIT_TYPES, defaultTypeForPreset, kitType, kitTypeFromShop, typeAllowedForPreset } from "./types";
import { applyKitContent, type KitContent } from "./generate";
import { companionOf, heroOf, mainCount } from "./content";
import { activeSites, defaultSiteSlug } from "../universes";
import { preset } from "../universes/presets";
import { siteBySlug } from "../universes/sites";

/**
 * Création d'un kit (utilisée par les actions serveur et par le pilote automatique du worker).
 */

const KIT_KEYS = KIT_TYPES.map((k) => k.key) as [string, ...string[]];

export const CreateKitSchema = z.object({
  kitType: z.enum(KIT_KEYS),
  title: z.string().min(1).max(140),
  subtitle: z.string().max(240).optional(),
  ageRange: z.string().regex(/^\d+-\d+$/),
  /** Style d'illustration ; défaut : celui du préréglage de l'univers */
  artStyle: z.string().optional(),
  pageFormat: z.string().default("A4_PORTRAIT"),
  brief: z.string().max(20000).optional(),
  /** Univers de la boutique ciblé (slug) ; défaut : univers par défaut du studio */
  siteSlug: z.string().max(120).nullable().optional(),
  customization: KitCustomizationSchema,
});
export type CreateKitInput = z.input<typeof CreateKitSchema>;

export function kitTypeForContent(format: KitContentFormat, content: Record<string, unknown>): string {
  const b = (content.boutique ?? {}) as { categorySlug?: string; template?: string; name?: string; universe?: string };
  const title = String(content.titre ?? b.name ?? "");
  if (format === "guide") return "guide-pratique";
  if (format === "recipes") return "livre-recettes";
  if (format === "science") return "fiches-sciences";
  if (format === "pranks") return /lutin/i.test(title) ? "lutins-farceurs" : "kit-noel";
  return kitTypeFromShop({ categorySlug: b.categorySlug ?? "chasses-au-tresor", template: b.template, name: title, universe: b.universe });
}

export function planFromContent(format: KitContentFormat, content: KitContent): KitPlan {
  const raw = content as unknown as Record<string, unknown>;
  const key = kitTypeForContent(format, raw);
  const def = kitType(key);
  const b = content.boutique ?? {};
  const hunt = "enigmes" in content ? content : null;
  const sci = "experiences" in content ? content : null;
  const pranks = "idees" in content ? content : null;
  return KitPlanSchema.parse({
    kitType: key,
    title: content.titre,
    subtitle: content.sous_titre ?? "",
    ageRange: b.ageMin != null && b.ageMax != null ? `${b.ageMin}-${b.ageMax}` : def.defaultAge,
    universe: b.universe ?? def.defaultUniverse ?? "",
    heroName: heroOf(content) ?? "",
    heroDescription: hunt?.personnage?.description ?? pranks?.personnages?.[0]?.description ?? sci?.personnage?.description ?? "",
    companion: companionOf(content) ?? "",
    place: hunt?.personnage?.vehicule ?? "",
    tone: "",
    count: mainCount(content),
    priceCents: b.priceCents,
    shopCategorySlug: b.categorySlug ?? def.shopCategory,
    siteSlug: typeof b.siteSlug === "string" ? b.siteSlug : undefined,
    notes: "Contenu complet importé tel quel (aucun appel IA pour le texte).",
  });
}

/** Univers retenu pour un plan : celui du plan s'il existe, sinon le premier univers compatible avec le type, sinon l'univers par défaut. */
export async function resolvePlanSite(plan: Pick<KitPlan, "siteSlug" | "kitType">): Promise<string> {
  const sites = await activeSites();
  const chosen = siteBySlug(sites, plan.siteSlug);
  if (chosen) return chosen.slug;
  const compatible = sites.find((s) => typeAllowedForPreset(plan.kitType, s.preset));
  return compatible?.slug ?? (await defaultSiteSlug());
}

export async function createKitBookRaw(input: CreateKitInput) {
  const data = CreateKitSchema.parse(input);
  const def = kitType(data.kitType);
  const studio = await getStudioSettings();
  const sites = await activeSites();
  const siteSlug = siteBySlug(sites, data.siteSlug)?.slug ?? (await resolvePlanSite({ siteSlug: undefined, kitType: def.key }));
  const site = siteBySlug(sites, siteSlug);
  const p = preset(site?.preset ?? def.presets[0]);
  const count = data.customization.count ?? def.defaultCount;
  const priceCents = data.customization.priceCents ?? studio.priceByKitType[def.key] ?? def.defaultPriceCents;
  const book = await prisma.book.create({
    data: {
      title: data.title, subtitle: data.subtitle || null, collection: site?.name || studio.defaultAuthor || "La Malle à Jeux",
      bookType: def.key, kitType: def.key, ageRange: data.ageRange, targetCount: count, artStyle: data.artStyle || p.artStyle, pageFormat: data.pageFormat,
      siteSlug,
      brief: data.brief || null, theme: p.key === "kit-enfants" ? defaultThemeForBook(def.family === "kit" ? "kit" : def.key, data.ageRange) : themeForPreset(p.key), status: "DRAFT", cover: { introduction: "" },
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
    siteSlug: await resolvePlanSite(plan),
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
export async function resolveBrief(text: string, opts: { jobId?: string; siteSlug?: string | null } = {}): Promise<{ plan: KitPlan; contentJson?: string; source: "ia" | "json" | "contenu" }> {
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
      return { plan: await withSite(planFromContent(format, parsed.data as KitContent), opts.siteSlug), contentJson: JSON.stringify(parsed.data), source: "contenu" };
    }
    const plan = KitPlanSchema.safeParse(json);
    if (plan.success) return { plan: await withSite(normalizePlan(plan.data), opts.siteSlug), source: "json" };
  }
  return { plan: await withSite(normalizePlan(await generateKitPlan(t, opts)), opts.siteSlug), source: "ia" };
}

/** Applique l'univers imposé (sinon celui du plan, validé) et garantit un type compatible avec son préréglage. */
export async function withSite(plan: KitPlan, forcedSlug?: string | null): Promise<KitPlan> {
  const sites = await activeSites();
  const forced = siteBySlug(sites, forcedSlug);
  const siteSlug = forced?.slug ?? (await resolvePlanSite(plan));
  const site = siteBySlug(sites, siteSlug);
  let kitTypeKey = plan.kitType;
  if (site && !typeAllowedForPreset(kitTypeKey, site.preset)) kitTypeKey = defaultTypeForPreset(site.preset);
  const def = kitType(kitTypeKey);
  const categories = site?.categories ?? [];
  const shopCategorySlug = plan.shopCategorySlug && (!categories.length || categories.some((c) => c.slug === plan.shopCategorySlug)) ? plan.shopCategorySlug : categories.find((c) => c.slug === def.shopCategory)?.slug ?? categories[0]?.slug ?? def.shopCategory;
  const changedType = kitTypeKey !== plan.kitType;
  return { ...plan, siteSlug, kitType: kitTypeKey, shopCategorySlug, ...(changedType ? { count: def.defaultCount, ageRange: def.defaultAge } : {}) };
}

function normalizePlan(plan: KitPlan): KitPlan {
  return { ...plan, kitType: KIT_TYPES.some((k) => k.key === plan.kitType) ? plan.kitType : "chasse-au-tresor" };
}
