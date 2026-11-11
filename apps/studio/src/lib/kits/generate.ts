import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { getAiSettings } from "../settings";
import { getImageProvider, getTextProvider, effectiveImageModel, effectiveTextModel } from "../ai/registry";
import { generateStructured, contextBlock } from "../ai/structured";
import { isManualInputRequired } from "../ai/manual-core";
import { storeAsset } from "../storage";
import { ShopListingSchema, type ShopListing } from "../schemas/settings";
import { CoverDataSchema, ageRangeLabel } from "../schemas/activity";
import { ITEMS_KEY, itemSchemaFor, KIT_CONTENT_SCHEMAS, KitCustomizationSchema, KitPlanSchema, type KitContentFormat, type KitCustomization, type KitPlan, type ShopListingImport } from "./schemas";
import { kitContentsFor, kitType, isAdultAge, type KitTypeDef } from "./types";
import { briefToPlanPrompt, contentPromptFor, firstBatchNote, itemsBatchPrompt, kitImagePrompt, outlinePrompt, systemPromptFor } from "./prompts";
import { assembleContent, cleanOutline, draftKey, itemTitle, mergeBatchItems, needsBatching, normalizeTitle, planBatches, readDraft, runPool, type BatchRange } from "./batches";
import { clampItemCount, MAX_ITEMS_PER_BOOK } from "./limits";
import { bookImageSettings, bookTextSettings } from "../ai/book-settings";
import { companionOf, heroOf, introOf, mainCount, type KitContent } from "./content";
import { activeSites, charterForBook, defaultSiteSlug, presetForBook } from "../universes";
import { compositionHints, ratioForSlot, sizeForRatio } from "../images/framing";
import { initIllustrationFraming } from "../images/service";
import { useSketch } from "../generation/sketch";
import { COLORING_SLOTS, coloringCharterFor, drawingPrompt, isDrawingSlot, samplePrompt } from "./coloring";
import { ColoringOptionsSchema, type ColoringOptions } from "./schemas";
import { getStudioSettings } from "../settings";

/** Options du cahier de coloriage (valeurs par défaut si absentes). */
export function coloringOptionsOf(customization: unknown): ColoringOptions {
  const raw = (customization as { coloring?: unknown } | null)?.coloring;
  const p = ColoringOptionsSchema.safeParse(raw ?? {});
  return p.success ? p.data : ColoringOptionsSchema.parse({});
}

export type { KitContent };

/** Finalité (purpose) de la rédaction du contenu, par format. */
export const CONTENT_PURPOSE: Record<KitContentFormat, "kit_hunt" | "kit_pranks" | "kit_guide" | "kit_recipes" | "kit_science" | "kit_coloring"> = {
  treasure_hunt: "kit_hunt",
  pranks: "kit_pranks",
  guide: "kit_guide",
  recipes: "kit_recipes",
  science: "kit_science",
  coloring: "kit_coloring",
};

function customizationOf(raw: unknown): KitCustomization {
  const p = KitCustomizationSchema.safeParse(raw ?? {});
  return p.success ? p.data : KitCustomizationSchema.parse({});
}

/** Brief libre → plan de kit (IA du registry, ou demande à coller en mode copier-coller). Le plan propose aussi l'univers le plus adapté. */
export async function generateKitPlan(brief: string, opts: { jobId?: string; siteSlug?: string | null } = {}): Promise<KitPlan> {
  const settings = await getAiSettings();
  const provider = getTextProvider(settings, { jobId: opts.jobId });
  const sites = await activeSites();
  const forced = opts.siteSlug ? sites.find((s) => s.slug === opts.siteSlug) : undefined;
  const prompt =
    briefToPlanPrompt(brief, forced ? [forced] : sites) +
    "\n\n" +
    contextBlock("kit_plan", { title: brief.split("\n")[0].slice(0, 60), brief: brief.slice(0, 2000), sites: (forced ? [forced] : sites).map((s) => `${s.slug}:${s.preset}`).join(",") });
  const res = await generateStructured({ provider, model: effectiveTextModel(settings), schema: KitPlanSchema, system: systemPromptFor(null), prompt, purpose: "kit_plan", jobId: opts.jobId, maxTokens: 4000 });
  const plan = res.data;
  if (forced) plan.siteSlug = forced.slug;
  if (!plan.siteSlug || !sites.some((s) => s.slug === plan.siteSlug)) plan.siteSlug = await defaultSiteSlug();
  return plan;
}

/** Sommaire de la rédaction par lots. */
export const OutlineSchema = z.object({ elements: z.array(z.object({ numero: z.number().int().min(1), titre: z.string().min(1).max(200), idee: z.string().max(400).optional().default("") })).min(1).max(MAX_ITEMS_PER_BOOK) });

/** Plusieurs demandes à coller (lots indépendants) : reconnue comme « réponse à coller » par le worker. */
export class ManualBatchPendingError extends Error {
  readonly code = "MANUAL_INPUT_REQUIRED";
  constructor(public readonly pending: number, public readonly title: string) {
    super(`${pending} réponse(s) à coller : ${title}`);
    this.name = "ManualBatchPendingError";
  }
}

/** Nombre de réponses à coller signalées par une erreur « copier-coller ». */
export function pendingCount(err: unknown): number {
  const n = (err as { pending?: number } | null)?.pending;
  return typeof n === "number" && n > 0 ? n : 1;
}

/** Génère le contenu complet du kit (énigmes, idées, lettres, guide, fiche boutique) ; par lots au-delà de 20 éléments. */
export async function generateKitContent(bookId: string, opts: { jobId?: string; onProgress?: (step: string) => Promise<unknown> | unknown } = {}) {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const def = kitType(book.kitType);
  if (def.family !== "kit" || !def.format) throw new Error(`Le type « ${def.label} » n'a pas de contenu structuré`);
  const format = def.format;
  const c = customizationOf(book.customization);
  const count = clampItemCount(c.count ?? book.targetCount ?? def.defaultCount, def.defaultCount);
  const settings = bookTextSettings(await getAiSettings(), book);
  const provider = getTextProvider(settings, { bookId, jobId: opts.jobId });
  const p = await presetForBook(book);
  const args = { def, title: book.title, ageRange: book.ageRange, count, c, brief: book.brief, tone: c.tone || p.tone };
  const purpose = CONTENT_PURPOSE[format];
  const model = effectiveTextModel(settings);
  const system = systemPromptFor(p);
  const ctxOf = (extra: Record<string, unknown>) => ({ title: book.title, count, heroName: c.heroName, companion: c.companion, universe: c.universe, place: c.place, ageRange: book.ageRange, ...extra });

  if (!needsBatching(count)) {
    const prompt = contentPromptFor(format, args) + "\n\n" + contextBlock(purpose, ctxOf({}));
    const res = await generateStructured({ provider, model, schema: KIT_CONTENT_SCHEMAS[format] as never, system, prompt, purpose, bookId, jobId: opts.jobId, maxTokens: 32000 });
    await applyKitContent(bookId, res.data as KitContent, { keepTitle: true });
    return { content: res.data as KitContent, usage: res.usage, batches: 1 };
  }

  // --- Rédaction par lots ---------------------------------------------------
  const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const add = (u: { inputTokens: number; outputTokens: number; costUsd: number }) => { usage.inputTokens += u.inputTokens; usage.outputTokens += u.outputTokens; usage.costUsd += u.costUsd; };
  const key = draftKey({ format, count, title: book.title, ageRange: book.ageRange });
  const draft = readDraft(book.kitDraft, key);
  const saveDraft = () => prisma.book.update({ where: { id: bookId }, data: { kitDraft: draft as unknown as Prisma.InputJsonValue } });
  const noun = def.countLabel;

  // 1. Sommaire
  if (!draft.outline) {
    await opts.onProgress?.(`Sommaire des ${count} ${noun}`);
    const prompt = outlinePrompt(format, args) + "\n\n" + contextBlock("kit_outline", ctxOf({ format, title: `${book.title} — sommaire (${count} ${noun})` }));
    const res = await generateStructured({ provider, model, schema: OutlineSchema, system, prompt, purpose: "kit_outline", bookId, jobId: opts.jobId, maxTokens: Math.min(32000, 2000 + count * 80) });
    add(res.usage);
    const outline = cleanOutline(res.data.elements, count);
    // Sommaire incomplet : on complète avec des intitulés génériques (rédigés ensuite normalement)
    for (let i = outline.length; i < count; i++) outline.push({ numero: i + 1, titre: `${noun.replace(/s$/, "")} ${i + 1}`, idee: "sujet libre, différent de tous les autres" });
    draft.outline = outline;
    await saveDraft();
  }
  const outline = draft.outline!;
  const ranges = planBatches(count);
  const sliceOf = (r: { from: number; to: number }) => outline.slice(r.from - 1, r.to);

  // 2. Cadre + premier lot, 3. lots suivants : indépendants → parallèles (API) ou collés dans n'importe quel ordre
  const frameTask = async () => {
    if (draft.frame) return;
    const r0 = ranges[0];
    const prompt = contentPromptFor(format, { ...args, count: r0.to }) + firstBatchNote(format, count, sliceOf(r0)) + "\n\n" + contextBlock(purpose, ctxOf({ count: r0.to, total: count, title: `${book.title} — cadre et ${noun} 1 à ${r0.to}` }));
    const res = await generateStructured({ provider, model, schema: KIT_CONTENT_SCHEMAS[format] as never, system, prompt, purpose, bookId, jobId: opts.jobId, maxTokens: 32000 });
    add(res.usage);
    draft.frame = res.data as Record<string, unknown>;
    await saveDraft();
  };
  // Les lots ne dépendent que du sommaire et de la personnalisation (pas du cadre) : leurs prompts
  // restent identiques d'une reprise à l'autre, ce qui permet de les coller dans n'importe quel ordre.
  const frameHero = () => c.heroName || undefined;
  const batchTask = (r: BatchRange, attempt = 0) => async (): Promise<void> => {
    if (draft.batches[String(r.index)]) return;
    const slice = sliceOf(r);
    const prompt = itemsBatchPrompt(format, args, slice, { hero: frameHero(), companion: c.companion || undefined, total: count }) + "\n\n" + contextBlock("kit_items", ctxOf({ format, from: r.from, to: r.to, titles: slice.map((x) => x.titre), title: `${book.title} — ${noun} ${r.from} à ${r.to}` }));
    const schema = z.object({ items: z.array(itemSchemaFor(format)).min(1) });
    try {
      const res = await generateStructured({ provider, model, schema, system, prompt, purpose: "kit_items", bookId, jobId: opts.jobId, maxTokens: Math.min(32000, 3000 + slice.length * 1500) });
      add(res.usage);
      draft.batches[String(r.index)] = res.data.items as Array<Record<string, unknown>>;
      await saveDraft();
      await opts.onProgress?.(`${noun} ${r.from} à ${r.to} rédigés`);
    } catch (err) {
      // Lot tronqué ou invalide : on ne relance que ce lot, en deux moitiés (une fois)
      if (isManualInputRequired(err) || attempt > 0 || slice.length < 4) throw err;
      const mid = r.from + Math.floor(slice.length / 2) - 1;
      const halves: BatchRange[] = [{ index: r.index * 1000 + 1, from: r.from, to: mid }, { index: r.index * 1000 + 2, from: mid + 1, to: r.to }];
      for (const h of halves) await batchTask(h, attempt + 1)();
      draft.batches[String(r.index)] = [...draft.batches[String(halves[0].index)], ...draft.batches[String(halves[1].index)]];
      delete draft.batches[String(halves[0].index)];
      delete draft.batches[String(halves[1].index)];
      await saveDraft();
    }
  };
  const results = await runPool([frameTask, ...ranges.slice(1).map((r) => batchTask(r))], settings.mode === "manual" ? 1 : settings.maxConcurrentGenerations);
  const failures = results.filter((r): r is { ok: false; error: unknown } => !r.ok);
  const manual = failures.filter((f) => isManualInputRequired(f.error));
  if (manual.length) throw new ManualBatchPendingError(manual.reduce((a, f) => a + pendingCount(f.error), 0), `${book.title} — rédaction par lots`);
  if (failures.length) throw failures[0].error;

  // 4. Fusion (sans doublons) ; un lot complémentaire si des éléments manquent
  const frame = draft.frame!;
  const firstItems = ((frame[ITEMS_KEY[format]] as Array<Record<string, unknown>>) ?? []).slice(0, ranges[0].to);
  const ordered = () => [firstItems, ...ranges.slice(1).map((r) => draft.batches[String(r.index)] ?? [])];
  let merged = mergeBatchItems(format, ordered(), count);
  if (merged.missing > 0) {
    const extra: BatchRange = { index: 9999, from: count - merged.missing + 1, to: count };
    const taken = new Set(merged.items.map((it) => normalizeTitle(itemTitle(format, it))));
    const spare = outline.filter((o) => !taken.has(normalizeTitle(o.titre))).slice(0, merged.missing);
    while (spare.length < merged.missing) spare.push({ numero: 0, titre: `${noun} supplémentaire ${spare.length + 1}`, idee: "sujet nouveau, différent de tous les autres" });
    outline.splice(extra.from - 1, merged.missing, ...spare.map((x, i) => ({ ...x, numero: extra.from + i })));
    await batchTask(extra, 1)();
    merged = mergeBatchItems(format, [...ordered(), draft.batches["9999"] ?? []], count);
  }
  const content = KIT_CONTENT_SCHEMAS[format].parse(assembleContent(format, frame, merged.items)) as KitContent;
  await applyKitContent(bookId, content, { keepTitle: true });
  await prisma.book.update({ where: { id: bookId }, data: { kitDraft: Prisma.DbNull } });
  return { content, usage, batches: ranges.length + 1, duplicates: merged.duplicates };
}

/** Enregistre un contenu de kit (généré ou collé) : contenu, titres, couverture, fiche boutique. */
export async function applyKitContent(bookId: string, content: KitContent, opts: { keepTitle?: boolean } = {}) {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const def = kitType(book.kitType);
  const c = customizationOf(book.customization);
  const hero = heroOf(content) ?? undefined;
  const count = mainCount(content);
  const coverPrompt = content.illustrations.find((i) => i.page === "couverture")?.prompt;
  const boutique = (content.boutique ?? {}) as ShopListingImport;
  const title = opts.keepTitle && book.title && book.title !== "Nouveau livre" ? book.title : content.titre;
  const cover = CoverDataSchema.parse({
    ...((book.cover ?? {}) as object),
    title,
    subtitle: content.sous_titre || book.subtitle || "",
    collection: book.collection ?? "La Malle à Jeux",
    ageLabel: isAdultAge(book.ageRange) ? "Guide pratique" : ageRangeLabel(book.ageRange),
    tagline: boutique.tagline ?? content.sous_titre ?? "",
    backText: boutique.shortDescription ?? "",
    illustrationBrief: coverPrompt ?? `${title}${hero ? ` — ${hero}` : ""}`,
  });
  const listing = mergeListing(book.shopListing, boutique, def, c, count);
  const customization: KitCustomization = {
    ...c,
    heroName: c.heroName || hero || "",
    companion: c.companion || companionOf(content) || "",
  };
  await prisma.book.update({
    where: { id: bookId },
    data: {
      kitContent: content as unknown as Prisma.InputJsonValue,
      title,
      subtitle: content.sous_titre || book.subtitle,
      status: "PLANNED",
      cover: { ...cover, introduction: introOf(content) },
      shopListing: listing as Prisma.InputJsonValue,
      customization: customization as Prisma.InputJsonValue,
      targetCount: count,
    },
  });
}

function mergeListing(existing: unknown, b: ShopListingImport, def: KitTypeDef, c: KitCustomization, count: number): ShopListing {
  const prev = ShopListingSchema.safeParse(existing ?? {});
  const base: ShopListing = prev.success ? prev.data : {};
  const pick = <T,>(v: T | undefined, d: T | undefined) => (v !== undefined ? v : d);
  return ShopListingSchema.parse({
    ...base,
    name: pick(base.name, b.name),
    tagline: pick(base.tagline, b.tagline?.slice(0, 200)),
    shortDescription: pick(base.shortDescription, b.shortDescription?.slice(0, 400)),
    longDescription: pick(base.longDescription, b.longDescription),
    story: pick(base.story, b.story),
    priceCents: pick(base.priceCents, c.priceCents ?? b.priceCents ?? def.defaultPriceCents),
    categorySlug: pick(base.categorySlug, c.shopCategorySlug ?? b.categorySlug ?? def.shopCategory),
    template: pick(base.template, c.shopTemplate ?? b.template ?? def.template),
    universe: pick(base.universe, c.universe || b.universe || def.defaultUniverse),
    tags: pick(base.tags, b.tags),
    ageMin: pick(base.ageMin, b.ageMin),
    ageMax: pick(base.ageMax, b.ageMax),
    durationMinutes: pick(base.durationMinutes, b.durationMinutes),
    kitContents: pick(base.kitContents, b.kitContents?.length ? b.kitContents : kitContentsFor(def, { main: count })),
    faq: pick(base.faq, b.faq),
    sellingPoints: pick(base.sellingPoints, b.sellingPoints),
    seoTitle: pick(base.seoTitle, b.seoTitle?.slice(0, 70)),
    seoDescription: pick(base.seoDescription, b.seoDescription?.slice(0, 170)),
    keywords: pick(base.keywords, b.keywords),
  });
}

/** Emplacements d'illustration d'un kit et leur prompt (prompts fournis par le contenu, sinon déduits). */
export function kitIllustrationPlan(content: KitContent, book?: { ageRange?: string | null; customization?: unknown }): Array<{ slot: string; prompt: string; label: string }> {
  const given = new Map(content.illustrations.map((i) => [i.page, i.prompt]));
  const plan: Array<{ slot: string; prompt: string; label: string }> = [];
  const add = (slot: string, fallback: string, label: string) => {
    const prompt = given.get(slot) ?? fallback;
    if (prompt) plan.push({ slot, prompt, label });
  };
  if ("enigmes" in content) {
    const hero = content.personnage?.nom ?? "le personnage";
    add("planche-personnage", `Planche de personnage (model sheet) : ${hero}, ${content.personnage?.description ?? ""}, et ${content.personnage?.compagnon ?? "son compagnon"} ; vues de face, profil et dos, trois expressions, fond crème.`, "Planche de personnage");
    add("lettre", `${hero} écrit une lettre à son bureau, ${content.personnage?.compagnon ?? ""} à ses côtés.`, "Lettre");
    add("carte", content.carte?.image_description ?? "Carte au trésor illustrée avec un X rouge et un cadre vide sous le X.", "Carte au trésor");
    add("diplome", `${hero} salue joyeusement, décor de fête assorti à l'univers.`, "Diplôme");
    add("invitation", `${hero} invite les enfants à l'aventure, décor de l'univers.`, "Invitation");
    for (const e of content.enigmes) add(`enigme-image-${e.numero}`, e.image_description || `Cachette : ${e.cachette}, un petit parchemin roulé bien visible.`, `Énigme ${e.numero} (image)`);
    addMarketing(hero, content.personnage?.compagnon ?? "");
  } else if ("idees" in content) {
    const hero = content.personnages?.[0]?.nom ?? "le lutin";
    add("planche-personnages", `Planche de personnages : ${content.personnages.map((p) => `${p.nom} (${p.description})`).join(", ")} ; vues de face, profil, trois expressions, fond crème.`, "Planche de personnages");
    add("lettre-arrivee", `${hero} arrive du pôle Nord avec sa petite valise, dans un salon décoré pour Noël.`, "Lettre d'arrivée");
    add("lettre-depart", `${hero} fait au revoir de la main devant le sapin.`, "Lettre de départ");
    add("certificat", `${hero} et ses amis applaudissent, guirlandes et étoiles.`, "Certificat");
    for (const i of content.idees) add(`idee-${i.numero}`, i.illustration_description || `${hero} prépare la farce « ${i.titre} ».`, `Idée ${i.numero}`);
    addMarketing(hero, content.personnages?.[1]?.nom ?? "");
  } else if ("chapitres" in content) {
    // Guide expert : pas de personnage récurrent, une illustration pédagogique par chapitre
    add("guide-probleme", content.probleme?.texte ? `Illustration pédagogique du problème : ${content.probleme.titre || content.titre}. ${content.probleme.texte.slice(0, 300)}` : `Illustration pédagogique du sujet du guide « ${content.titre} ».`, "Le problème");
    for (const ch of content.chapitres) add(`chapitre-${ch.numero}`, ch.illustration_description || `Schéma pédagogique illustrant « ${ch.titre} » : ${ch.resume}`, `Chapitre ${ch.numero}`);
    addMarketingGuide(content.titre);
  } else if ("recettes" in content) {
    for (const r of content.recettes) add(`recette-${r.numero}`, r.illustration_description || `Le plat « ${r.titre} » joliment présenté, vu de trois quarts.`, `Recette ${r.numero}`);
    addMarketingGuide(content.titre);
  } else if ("dessins" in content) {
    // Cahier de coloriage : un dessin au trait par élément, l'exemple coloré et les visuels marketing en couleur
    const opts = coloringOptionsOf(book?.customization);
    const age = book?.ageRange || "5-8";
    for (const d of content.dessins) add(COLORING_SLOTS.drawing(d.numero), drawingPrompt(d, age), `Dessin ${d.numero} : ${d.titre}`);
    if (opts.sampleColored && content.dessins.length) add(COLORING_SLOTS.sample, samplePrompt(content.dessins[0]), "Exemple colorié");
    const theme = content.theme || content.titre;
    add(MARKETING_SLOTS.hero, `Visuel carré EN COULEUR pour la boutique : un enfant colorie joyeusement une page du cahier « ${content.titre} » (thème : ${theme}) posée sur une table, crayons et feutres autour, lumière douce. Aucun texte.`, "Visuel boutique (carré)");
    add(MARKETING_SLOTS.story, `Visuel publicitaire vertical EN COULEUR : pages de coloriage sur le thème « ${theme} », à moitié coloriées, crayons de couleur ; tiers supérieur et tiers inférieur en fond clair et uni (zones réservées au texte). Aucun texte.`, "Visuel publicitaire (vertical)");
  } else {
    const hero = content.personnage?.nom || "";
    if (hero) add("planche-personnage", `Planche de personnage (model sheet) : ${hero}, ${content.personnage?.description ?? ""} ; vues de face, profil et dos, trois expressions, fond clair.`, "Planche de personnage");
    for (const e of content.experiences) add(`experience-${e.numero}`, e.illustration_description || `Des enfants réalisent l'expérience « ${e.titre} » avec le matériel posé sur la table.`, `Expérience ${e.numero}`);
    add("diplome", hero ? `${hero} félicite un petit scientifique, décor de laboratoire joyeux.` : "Décor de laboratoire joyeux pour un diplôme de petit scientifique.", "Diplôme");
    addMarketing(hero || "des enfants curieux", "");
  }
  return plan;

  /** Visuels marketing (boutique et publicité) : carré « héros » et vertical pour les Stories. */
  function addMarketing(hero: string, companion: string) {
    const duo = [hero, companion].filter(Boolean).join(" et ") || "les personnages du kit";
    add(MARKETING_SLOTS.hero, `Scène carrée pleine de joie pour la boutique et la publicité : des enfants de l'âge du kit vivent l'aventure avec ${duo}, au moment le plus magique (découverte, éclat de rire), décor de l'univers du kit. Aucun texte.`, "Visuel boutique (carré)");
    add(MARKETING_SLOTS.story, `Visuel publicitaire vertical : ${duo}, très expressifs, au cœur de l'univers du kit ; tiers supérieur et tiers inférieur en fond clair et uni (zones réservées au texte de la publicité). Aucun texte.`, "Visuel publicitaire (vertical)");
  }

  /** Visuels marketing des guides et livres de recettes (sans personnage). */
  function addMarketingGuide(title: string) {
    add(MARKETING_SLOTS.hero, `Visuel carré pour la boutique et la publicité illustrant le résultat obtenu grâce à « ${title} » (situation réussie, ambiance sereine et lumineuse). Aucun texte.`, "Visuel boutique (carré)");
    add(MARKETING_SLOTS.story, `Visuel publicitaire vertical illustrant le sujet de « ${title} » ; tiers supérieur et tiers inférieur en fond clair et uni (zones réservées au texte de la publicité). Aucun texte.`, "Visuel publicitaire (vertical)");
  }
}

/** Emplacements marketing ajoutés à chaque kit (utilisés par la boutique et les vidéos). */
export const MARKETING_SLOTS = { hero: "visuel-heros", story: "visuel-story" } as const;

/** Emplacement de la planche de personnages (référence visuelle des autres illustrations). */
export function isCharacterSheetSlot(slot: string | null | undefined) {
  return Boolean(slot && slot.startsWith("planche"));
}

/** Image de la planche de personnages d'un kit (référence pour la cohérence des personnages). */
export async function characterSheetReference(bookId: string): Promise<Buffer | null> {
  const sheet = await prisma.illustration.findFirst({
    where: { bookId, kind: "KIT", slot: { startsWith: "planche" }, isCurrent: true, status: { in: ["ACCEPTED", "GENERATED"] }, assetId: { not: null } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { asset: true },
  });
  if (!sheet?.asset) return null;
  try {
    const { getStorage } = await import("../storage");
    return await getStorage().get(sheet.asset.key);
  } catch {
    return null;
  }
}

/** Image courante d'un emplacement (référence d'une autre illustration). */
async function slotImage(bookId: string, slot: string): Promise<Buffer | null> {
  const ill = await prisma.illustration.findFirst({ where: { bookId, kind: "KIT", slot, isCurrent: true, assetId: { not: null } }, include: { asset: true } });
  if (!ill?.asset) return null;
  try {
    const { getStorage } = await import("../storage");
    return await getStorage().get(ill.asset.key);
  } catch {
    return null;
  }
}

export function readKitContent(book: { kitType: string; kitContent: unknown }): KitContent | null {
  const def = kitType(book.kitType);
  if (!def.format || !book.kitContent) return null;
  const parsed = KIT_CONTENT_SCHEMAS[def.format].safeParse(book.kitContent);
  return parsed.success ? (parsed.data as KitContent) : null;
}

/**
 * Génère une illustration de kit pour un emplacement, au format de son cadre (portrait,
 * paysage, carré) avec des consignes de composition. En mode esquisse, l'image est produite
 * en qualité basse et marquée « esquisse » (la version finale réutilise sa composition).
 * Lève ManualInputRequiredError en mode copier-coller.
 */
export async function generateKitIllustration(opts: { bookId: string; slot: string; prompt: string; label: string; jobId?: string; sketch?: boolean; via?: "api" }) {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: opts.bookId } });
  const cust = (book.customization ?? {}) as Record<string, unknown>;
  // via « api » : dessin rejeté d'un lot copier-coller, régénéré par l'API quand une clé est configurée
  const settings = bookImageSettings(await getAiSettings(), opts.via === "api" ? { ...book, customization: { ...cust, ai: { ...((cust.ai as object) ?? {}), imagesVia: "api" } } } : book);
  const provider = getImageProvider(settings, { bookId: opts.bookId, jobId: opts.jobId });
  const model = effectiveImageModel(settings);
  const c = customizationOf(book.customization);
  const coloring = kitType(book.kitType).format === "coloring";
  const lineArt = coloring && isDrawingSlot(opts.slot);
  const { charter: universeCharter, preset: p } = await charterForBook(book);
  // Dessins à colorier : charte « coloriage » (trait noir sur blanc, éditable dans Paramètres → Univers)
  const charter = lineArt ? coloringCharterFor((await getStudioSettings()).illustrationCharters) : universeCharter;
  const characterNote = coloring ? "" : [c.heroName, c.heroDescription, c.companion].filter(Boolean).join(", ");
  const prompt = `${kitImagePrompt(charter, opts.prompt, characterNote || undefined)}\n\n${compositionHints(opts.slot, "KIT")}`;
  const negative = lineArt ? "gris, ombres, dégradés, couleurs, remplissage, texte, lettres, chiffres, cadre, bordure, signature, filigrane" : p.negative;
  const ratio = ratioForSlot(opts.slot, "KIT");
  const size = sizeForRatio(ratio);
  // Cahier de coloriage : esquisses désactivées par défaut (une esquisse coûterait presque autant qu'un dessin final)
  const sketch = coloring ? settings.sketchMode && useSketch(settings, provider.name, opts.sketch) : useSketch(settings, provider.name, opts.sketch);
  const quality = sketch ? settings.sketchQuality : settings.imageQuality;
  const previous = await prisma.illustration.findFirst({ where: { bookId: opts.bookId, kind: "KIT", slot: opts.slot, isCurrent: true }, orderBy: { version: "desc" } });
  const record = await prisma.illustration.create({ data: { bookId: opts.bookId, kind: "KIT", slot: opts.slot, version: (previous?.version ?? 0) + 1, parentId: previous?.id, status: "GENERATING", prompt, negative, provider: provider.name, model, isCurrent: true, targetRatio: ratio, isSketch: sketch, quality } });
  if (previous) await prisma.illustration.update({ where: { id: previous.id }, data: { isCurrent: false } });
  const started = Date.now();
  try {
    // Cohérence des personnages : la planche validée sert de référence à toutes les autres illustrations
    // Exemple colorié : le premier dessin sert de référence (mêmes contours) ; dessins : aucune référence
    const sheet = lineArt ? null : opts.slot === COLORING_SLOTS.sample ? await slotImage(opts.bookId, COLORING_SLOTS.drawing(1)) : isCharacterSheetSlot(opts.slot) ? null : await characterSheetReference(opts.bookId);
    const r = await provider.generate({ prompt, negativePrompt: negative, size, quality, model, references: sheet ? [sheet] : undefined, label: `${opts.label} — ${book.title}` });
    // Dessins : contrôle noir et blanc et conversion par seuillage si besoin (aucune regénération)
    let data = r.data;
    let mime = r.mime;
    if (lineArt && !r.isDemo) {
      const { ensureLineArt } = await import("../images/lineart");
      const la = await ensureLineArt(r.data);
      data = la.data;
      mime = "image/png";
    }
    const asset = await storeAsset({ key: `illustrations/${opts.bookId}/kit-${opts.slot}-${record.id}.png`, data, mime, width: r.width, height: r.height });
    await prisma.illustration.update({ where: { id: record.id }, data: { status: "GENERATED", assetId: asset.id, isDemo: r.isDemo, costUsd: r.costUsd, provider: r.provider, model: r.model } });
    await initIllustrationFraming(record.id, data).catch(() => undefined);
    // Dessin à colorier : jamais rogné (un trait coupé ne se colorie pas)
    if (lineArt) await prisma.illustration.update({ where: { id: record.id }, data: { fit: "contain" } }).catch(() => undefined);
    await prisma.generationLog.create({ data: { kind: "image", provider: r.provider, model: r.model, purpose: "illustration", bookId: opts.bookId, jobId: opts.jobId, images: 1, costUsd: r.costUsd, durationMs: Date.now() - started, success: true } }).catch(() => undefined);
    return { illustrationId: record.id, costUsd: r.costUsd, isDemo: r.isDemo, isSketch: sketch };
  } catch (err) {
    await prisma.illustration.delete({ where: { id: record.id } }).catch(() => undefined);
    if (previous) await prisma.illustration.update({ where: { id: previous.id }, data: { isCurrent: true } }).catch(() => undefined);
    if (isManualInputRequired(err)) throw err;
    await prisma.generationLog.create({ data: { kind: "image", provider: provider.name, model, purpose: "illustration", bookId: opts.bookId, jobId: opts.jobId, images: 0, costUsd: 0, durationMs: Date.now() - started, success: false, error: err instanceof Error ? err.message : String(err) } }).catch(() => undefined);
    throw err;
  }
}
