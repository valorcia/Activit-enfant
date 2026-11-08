import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getAiSettings, getStudioSettings } from "../settings";
import { getImageProvider, getTextProvider, effectiveImageModel, effectiveTextModel } from "../ai/registry";
import { generateStructured, contextBlock } from "../ai/structured";
import { isManualInputRequired } from "../ai/manual-core";
import { storeAsset } from "../storage";
import { ShopListingSchema, type ShopListing } from "../schemas/settings";
import { CoverDataSchema, ageRangeLabel } from "../schemas/activity";
import { KIT_CONTENT_SCHEMAS, KitCustomizationSchema, KitPlanSchema, PranksKitSchema, TreasureHuntSchema, type KitCustomization, type KitPlan, type PranksKit, type ShopListingImport, type TreasureHunt } from "./schemas";
import { kitContentsFor, kitType, type KitTypeDef } from "./types";
import { SYSTEM_KIT_EDITOR, briefToPlanPrompt, kitImagePrompt, pranksPrompt, treasureHuntPrompt } from "./prompts";

export type KitContent = TreasureHunt | PranksKit;

function customizationOf(raw: unknown): KitCustomization {
  const p = KitCustomizationSchema.safeParse(raw ?? {});
  return p.success ? p.data : KitCustomizationSchema.parse({});
}

/** Brief libre → plan de kit (IA du registry, ou demande à coller en mode copier-coller). */
export async function generateKitPlan(brief: string, opts: { jobId?: string } = {}): Promise<KitPlan> {
  const settings = await getAiSettings();
  const provider = getTextProvider(settings, { jobId: opts.jobId });
  const prompt = briefToPlanPrompt(brief) + "\n\n" + contextBlock("kit_plan", { title: brief.split("\n")[0].slice(0, 60), brief: brief.slice(0, 2000) });
  const res = await generateStructured({ provider, model: effectiveTextModel(settings), schema: KitPlanSchema, system: SYSTEM_KIT_EDITOR, prompt, purpose: "kit_plan", jobId: opts.jobId, maxTokens: 4000 });
  return res.data;
}

/** Génère le contenu complet du kit (énigmes, idées, lettres, guide, fiche boutique). */
export async function generateKitContent(bookId: string, opts: { jobId?: string } = {}) {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const def = kitType(book.kitType);
  if (def.family !== "kit" || !def.format) throw new Error(`Le type « ${def.label} » n'a pas de contenu structuré`);
  const c = customizationOf(book.customization);
  const count = c.count ?? book.targetCount ?? def.defaultCount;
  const settings = await getAiSettings();
  const provider = getTextProvider(settings, { bookId, jobId: opts.jobId });
  const args = { def, title: book.title, ageRange: book.ageRange, count, c, brief: book.brief };
  const purpose = def.format === "treasure_hunt" ? "kit_hunt" : "kit_pranks";
  const prompt = (def.format === "treasure_hunt" ? treasureHuntPrompt(args) : pranksPrompt(args)) + "\n\n" + contextBlock(purpose, { title: book.title, count, heroName: c.heroName, companion: c.companion, universe: c.universe, place: c.place });
  const res = await generateStructured({ provider, model: effectiveTextModel(settings), schema: KIT_CONTENT_SCHEMAS[def.format] as never, system: SYSTEM_KIT_EDITOR, prompt, purpose, bookId, jobId: opts.jobId, maxTokens: 32000 });
  await applyKitContent(bookId, res.data as KitContent, { keepTitle: true });
  return { content: res.data as KitContent, usage: res.usage };
}

/** Enregistre un contenu de kit (généré ou collé) : contenu, titres, couverture, fiche boutique. */
export async function applyKitContent(bookId: string, content: KitContent, opts: { keepTitle?: boolean } = {}) {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const def = kitType(book.kitType);
  const c = customizationOf(book.customization);
  const isHunt = "enigmes" in content;
  const hero = isHunt ? (content as TreasureHunt).personnage?.nom : (content as PranksKit).personnages?.[0]?.nom;
  const coverPrompt = content.illustrations.find((i) => i.page === "couverture")?.prompt;
  const boutique = (content.boutique ?? {}) as ShopListingImport;
  const title = opts.keepTitle && book.title && book.title !== "Nouveau livre" ? book.title : content.titre;
  const cover = CoverDataSchema.parse({
    ...((book.cover ?? {}) as object),
    title,
    subtitle: content.sous_titre || book.subtitle || "",
    collection: book.collection ?? "La Malle à Jeux",
    ageLabel: ageRangeLabel(book.ageRange),
    tagline: boutique.tagline ?? content.sous_titre ?? "",
    backText: boutique.shortDescription ?? "",
    illustrationBrief: coverPrompt ?? `${title}${hero ? ` — ${hero}` : ""}`,
  });
  const listing = mergeListing(book.shopListing, boutique, def, c, isHunt ? (content as TreasureHunt).enigmes.length : (content as PranksKit).idees.length);
  const customization: KitCustomization = {
    ...c,
    heroName: c.heroName || hero || "",
    companion: c.companion || (isHunt ? (content as TreasureHunt).personnage?.compagnon ?? "" : (content as PranksKit).personnages?.[1]?.nom ?? ""),
  };
  await prisma.book.update({
    where: { id: bookId },
    data: {
      kitContent: content as unknown as Prisma.InputJsonValue,
      title,
      subtitle: content.sous_titre || book.subtitle,
      status: "PLANNED",
      cover: { ...cover, introduction: isHunt ? (content as TreasureHunt).lettre : (content as PranksKit).lettre_arrivee },
      shopListing: listing as Prisma.InputJsonValue,
      customization: customization as Prisma.InputJsonValue,
      targetCount: isHunt ? (content as TreasureHunt).enigmes.length : (content as PranksKit).idees.length,
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
export function kitIllustrationPlan(content: KitContent): Array<{ slot: string; prompt: string; label: string }> {
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
  } else {
    const hero = content.personnages?.[0]?.nom ?? "le lutin";
    add("planche-personnages", `Planche de personnages : ${content.personnages.map((p) => `${p.nom} (${p.description})`).join(", ")} ; vues de face, profil, trois expressions, fond crème.`, "Planche de personnages");
    add("lettre-arrivee", `${hero} arrive du pôle Nord avec sa petite valise, dans un salon décoré pour Noël.`, "Lettre d'arrivée");
    add("lettre-depart", `${hero} fait au revoir de la main devant le sapin.`, "Lettre de départ");
    add("certificat", `${hero} et ses amis applaudissent, guirlandes et étoiles.`, "Certificat");
    for (const i of content.idees) add(`idee-${i.numero}`, i.illustration_description || `${hero} prépare la farce « ${i.titre} ».`, `Idée ${i.numero}`);
  }
  return plan;
}

export function readKitContent(book: { kitType: string; kitContent: unknown }): KitContent | null {
  const def = kitType(book.kitType);
  if (!def.format || !book.kitContent) return null;
  const parsed = (def.format === "treasure_hunt" ? TreasureHuntSchema : PranksKitSchema).safeParse(book.kitContent);
  return parsed.success ? parsed.data : null;
}

/** Génère (ou régénère) une illustration de kit pour un emplacement. Lève ManualInputRequiredError en mode copier-coller. */
export async function generateKitIllustration(opts: { bookId: string; slot: string; prompt: string; label: string; jobId?: string }) {
  const settings = await getAiSettings();
  const studio = await getStudioSettings();
  const provider = getImageProvider(settings, { bookId: opts.bookId, jobId: opts.jobId });
  const model = effectiveImageModel(settings);
  const book = await prisma.book.findUniqueOrThrow({ where: { id: opts.bookId } });
  const c = customizationOf(book.customization);
  const characterNote = [c.heroName, c.heroDescription, c.companion].filter(Boolean).join(", ");
  const prompt = kitImagePrompt(studio.illustrationCharter, opts.prompt, characterNote || undefined);
  const negative = "texte, lettres, logo, filigrane, photo-réalisme, 3D, éléments effrayants";
  const previous = await prisma.illustration.findFirst({ where: { bookId: opts.bookId, kind: "KIT", slot: opts.slot, isCurrent: true }, orderBy: { version: "desc" } });
  const record = await prisma.illustration.create({ data: { bookId: opts.bookId, kind: "KIT", slot: opts.slot, version: (previous?.version ?? 0) + 1, parentId: previous?.id, status: "GENERATING", prompt, negative, provider: provider.name, model, isCurrent: true } });
  if (previous) await prisma.illustration.update({ where: { id: previous.id }, data: { isCurrent: false } });
  const started = Date.now();
  try {
    const size = /^enigme-image|^idee-|^planche/.test(opts.slot) ? "1024x1024" : opts.slot === "carte" ? "1024x1536" : settings.imageSize;
    const r = await provider.generate({ prompt, negativePrompt: negative, size, quality: settings.imageQuality, model, label: `${opts.label} — ${book.title}` });
    const asset = await storeAsset({ key: `illustrations/${opts.bookId}/kit-${opts.slot}-${record.id}.png`, data: r.data, mime: r.mime, width: r.width, height: r.height });
    await prisma.illustration.update({ where: { id: record.id }, data: { status: "GENERATED", assetId: asset.id, isDemo: r.isDemo, costUsd: r.costUsd, provider: r.provider, model: r.model } });
    await prisma.generationLog.create({ data: { kind: "image", provider: r.provider, model: r.model, purpose: "illustration", bookId: opts.bookId, jobId: opts.jobId, images: 1, costUsd: r.costUsd, durationMs: Date.now() - started, success: true } }).catch(() => undefined);
    return { illustrationId: record.id, costUsd: r.costUsd, isDemo: r.isDemo };
  } catch (err) {
    await prisma.illustration.delete({ where: { id: record.id } }).catch(() => undefined);
    if (previous) await prisma.illustration.update({ where: { id: previous.id }, data: { isCurrent: true } }).catch(() => undefined);
    if (isManualInputRequired(err)) throw err;
    await prisma.generationLog.create({ data: { kind: "image", provider: provider.name, model, purpose: "illustration", bookId: opts.bookId, jobId: opts.jobId, images: 0, costUsd: 0, durationMs: Date.now() - started, success: false, error: err instanceof Error ? err.message : String(err) } }).catch(() => undefined);
    throw err;
  }
}
