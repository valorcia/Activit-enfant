"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueue, QUEUES } from "@/lib/queue/jobs";
import { getAiSettings, getStudioSettings } from "@/lib/settings";
import { manualText } from "@/lib/ai/registry";
import { buildTextPrompt, cleanPastedJson } from "@/lib/ai/manual-core";
import { extractJson } from "@/lib/ai/structured";
import { defaultThemeForBook } from "@/lib/layout/themes";
import { KIT_CONTENT_SCHEMAS, KitCustomizationSchema, KitPlanSchema, detectKitContentFormat, type KitPlan } from "@/lib/kits/schemas";
import { KIT_TYPES, isStructuredKit, kitType, kitTypeFromShop } from "@/lib/kits/types";
import { SYSTEM_KIT_EDITOR, briefToPlanPrompt } from "@/lib/kits/prompts";
import { applyKitContent, generateKitPlan, type KitContent } from "@/lib/kits/generate";

const KIT_KEYS = KIT_TYPES.map((k) => k.key) as [string, ...string[]];

const CreateKitSchema = z.object({
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

/**
 * Crée un livre ou un kit. Kits structurés : rédaction du contenu (job « sommaire »).
 * Livres d'activités : génération du sommaire historique.
 */
export async function createKitBook(input: CreateKitInput, opts: { startProduction?: boolean } = {}) {
  const { bookId } = await createKitBookRaw(input);
  const structured = isStructuredKit(CreateKitSchema.parse(input).kitType);
  const job = structured && opts.startProduction
    ? await enqueue(QUEUES.bookPipeline, { bookId, withIllustrations: true, withCover: true })
    : await enqueue(QUEUES.bookOutline, { bookId });
  if (structured && opts.startProduction) await prisma.book.update({ where: { id: bookId }, data: { status: "GENERATING" } });
  revalidatePath("/books");
  return { bookId, jobId: job.id };
}

// ---------------------------------------------------------------------------
// Brief collé → plan (ou contenu complet)
// ---------------------------------------------------------------------------

export type BriefAnalysis =
  | { kind: "plan"; plan: KitPlan; contentJson?: string; source: "ia" | "json" | "contenu" }
  | { kind: "prompt"; prompt: string; message: string }
  | { kind: "error"; error: string };

function kitTypeForContent(format: "treasure_hunt" | "pranks", content: Record<string, unknown>): string {
  const b = (content.boutique ?? {}) as { categorySlug?: string; template?: string; name?: string; universe?: string };
  const title = String(content.titre ?? b.name ?? "");
  if (format === "pranks") return /lutin/i.test(title) ? "lutins-farceurs" : "kit-noel";
  return kitTypeFromShop({ categorySlug: b.categorySlug ?? "chasses-au-tresor", template: b.template, name: title, universe: b.universe });
}

function planFromContent(format: "treasure_hunt" | "pranks", content: KitContent): KitPlan {
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

/**
 * Analyse un texte collé :
 * 1. JSON de kit complet (sortie des prompts docs/prompts) → plan + contenu importé tel quel ;
 * 2. JSON de plan → plan ;
 * 3. brief libre → plan via l'IA (mode API) ou prompt à copier dans Claude / ChatGPT (mode copier-coller).
 */
export async function analyzeBriefAction(text: string): Promise<BriefAnalysis> {
  const t = text.trim();
  if (t.length < 10) return { kind: "error", error: "Collez un brief ou un JSON (au moins quelques mots)." };
  const json = t.includes("{") ? extractJson(cleanPastedJson(t)) : null;
  if (json) {
    const format = detectKitContentFormat(json);
    if (format) {
      const parsed = KIT_CONTENT_SCHEMAS[format].safeParse(json);
      if (!parsed.success) return { kind: "error", error: `JSON de kit reconnu mais incomplet : ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ")}` };
      return { kind: "plan", plan: planFromContent(format, parsed.data as KitContent), contentJson: JSON.stringify(parsed.data), source: "contenu" };
    }
    const plan = KitPlanSchema.safeParse(json);
    if (plan.success) return { kind: "plan", plan: { ...plan.data, kitType: KIT_TYPES.some((k) => k.key === plan.data.kitType) ? plan.data.kitType : "chasse-au-tresor" }, source: "json" };
  }
  const settings = await getAiSettings();
  if (manualText(settings)) {
    return {
      kind: "prompt",
      prompt: buildTextPrompt(SYSTEM_KIT_EDITOR, briefToPlanPrompt(t)),
      message: "Mode copier-coller : copiez ce prompt dans Claude ou ChatGPT, puis collez le JSON obtenu à la place du brief et relancez l'analyse.",
    };
  }
  try {
    const plan = await generateKitPlan(t);
    return { kind: "plan", plan: { ...plan, kitType: KIT_TYPES.some((k) => k.key === plan.kitType) ? plan.kitType : "chasse-au-tresor" }, source: "ia" };
  } catch (e) {
    return { kind: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Crée le kit à partir du plan validé, importe le contenu fourni éventuel et lance la production. */
export async function createKitFromPlanAction(input: { plan: KitPlan; brief?: string; contentJson?: string; startProduction: boolean }) {
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
  if (input.contentJson) {
    const json = JSON.parse(input.contentJson);
    const format = detectKitContentFormat(json);
    if (format) await applyKitContent(bookId, KIT_CONTENT_SCHEMAS[format].parse(json) as KitContent);
  }
  let jobId: string | null = null;
  if (input.startProduction && isStructuredKit(def.key)) {
    jobId = (await enqueue(QUEUES.bookPipeline, { bookId, withIllustrations: true, withCover: true })).id;
    await prisma.book.update({ where: { id: bookId }, data: { status: "GENERATING" } });
  } else if (!input.contentJson) {
    jobId = (await enqueue(QUEUES.bookOutline, { bookId })).id;
  }
  revalidatePath("/books");
  return { bookId, jobId };
}

async function createKitBookRaw(input: CreateKitInput) {
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

// ---------------------------------------------------------------------------
// Kit existant : import de JSON, régénération, personnalisation
// ---------------------------------------------------------------------------

/** Remplace le contenu d'un kit par un JSON collé (sortie de Claude / ChatGPT). */
export async function importKitJsonAction(bookId: string, text: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const json = extractJson(cleanPastedJson(text));
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const def = kitType(book.kitType);
  if (!def.format) return { ok: false, error: "Ce livre n'est pas un kit structuré." };
  const parsed = KIT_CONTENT_SCHEMAS[def.format].safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "racine"} : ${i.message}`).join(" ; ") };
  await applyKitContent(bookId, parsed.data as KitContent, { keepTitle: true });
  revalidatePath(`/books/${bookId}`);
  const c = parsed.data as KitContent;
  return { ok: true, count: "enigmes" in c ? c.enigmes.length : c.idees.length };
}

export async function regenerateKitContentAction(bookId: string) {
  const job = await enqueue(QUEUES.bookOutline, { bookId });
  revalidatePath(`/books/${bookId}`);
  return { jobId: job.id };
}

export async function saveKitCustomizationAction(bookId: string, input: unknown) {
  const c = KitCustomizationSchema.parse(input);
  await prisma.book.update({ where: { id: bookId }, data: { customization: c as Prisma.InputJsonValue, targetCount: c.count ?? undefined } });
  revalidatePath(`/books/${bookId}`);
}

/** Régénère l'illustration d'un emplacement du kit (via une tâche). */
export async function regenerateKitSlotAction(bookId: string, slot: string) {
  await prisma.illustration.updateMany({ where: { bookId, kind: "KIT", slot, isCurrent: true }, data: { isCurrent: false } });
  const job = await enqueue(QUEUES.bookPipeline, { bookId, withIllustrations: true, withCover: false });
  revalidatePath(`/books/${bookId}`);
  return { jobId: job.id };
}
