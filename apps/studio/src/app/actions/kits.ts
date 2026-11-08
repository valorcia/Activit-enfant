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
import { briefToPlanPrompt, systemPromptFor } from "@/lib/kits/prompts";
import { activeSites } from "@/lib/universes";
import { siteBySlug } from "@/lib/universes/sites";
import { applyKitContent, generateKitPlan, type KitContent } from "@/lib/kits/generate";
import { mainCount } from "@/lib/kits/content";
import { CreateKitSchema, createKitBookRaw, createKitFromPlan, planFromContent, withSite, type CreateKitInput } from "@/lib/kits/create";



/**
 * Crée un livre ou un kit. Kits structurés : rédaction du contenu (job « sommaire »).
 * Livres d'activités : génération du sommaire historique.
 */
export type { CreateKitInput };

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

/**
 * Analyse un texte collé :
 * 1. JSON de kit complet (sortie des prompts docs/prompts) → plan + contenu importé tel quel ;
 * 2. JSON de plan → plan ;
 * 3. brief libre → plan via l'IA (mode API) ou prompt à copier dans Claude / ChatGPT (mode copier-coller).
 */
export async function analyzeBriefAction(text: string, siteSlug?: string | null): Promise<BriefAnalysis> {
  const t = text.trim();
  if (t.length < 10) return { kind: "error", error: "Collez un brief ou un JSON (au moins quelques mots)." };
  const json = t.includes("{") ? extractJson(cleanPastedJson(t)) : null;
  if (json) {
    const format = detectKitContentFormat(json);
    if (format) {
      const parsed = KIT_CONTENT_SCHEMAS[format].safeParse(json);
      if (!parsed.success) return { kind: "error", error: `JSON de kit reconnu mais incomplet : ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ")}` };
      return { kind: "plan", plan: await withSite(planFromContent(format, parsed.data as KitContent), siteSlug), contentJson: JSON.stringify(parsed.data), source: "contenu" };
    }
    const plan = KitPlanSchema.safeParse(json);
    if (plan.success) return { kind: "plan", plan: await withSite({ ...plan.data, kitType: KIT_TYPES.some((k) => k.key === plan.data.kitType) ? plan.data.kitType : "chasse-au-tresor" }, siteSlug), source: "json" };
  }
  const settings = await getAiSettings();
  if (manualText(settings)) {
    return {
      kind: "prompt",
      prompt: await (async () => {
        const sites = await activeSites();
        const forced = siteBySlug(sites, siteSlug);
        return buildTextPrompt(systemPromptFor(null), briefToPlanPrompt(t, forced ? [forced] : sites));
      })(),
      message: "Mode copier-coller : copiez ce prompt dans Claude ou ChatGPT, puis collez le JSON obtenu à la place du brief et relancez l'analyse.",
    };
  }
  try {
    const plan = await generateKitPlan(t, { siteSlug: siteSlug ?? undefined });
    return { kind: "plan", plan: await withSite({ ...plan, kitType: KIT_TYPES.some((k) => k.key === plan.kitType) ? plan.kitType : "chasse-au-tresor" }, siteSlug), source: "ia" };
  } catch (e) {
    return { kind: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Crée le kit à partir du plan validé, importe le contenu fourni éventuel et lance la production. */
export async function createKitFromPlanAction(input: { plan: KitPlan; brief?: string; contentJson?: string; startProduction: boolean }) {
  const def = kitType(KitPlanSchema.parse(input.plan).kitType);
  const { bookId } = await createKitFromPlan(input);
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
  return { ok: true, count: mainCount(c) };
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
