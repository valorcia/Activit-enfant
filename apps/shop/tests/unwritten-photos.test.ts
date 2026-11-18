import { afterAll, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import { getStorage } from "@/lib/storage";
import { BLUEPRINTS, bookPlan, pageRange } from "@/lib/unwritten/book-plan";
import { STARTER_PRODUCTS } from "@/lib/unwritten/catalog-content";
import { COLLECTION_KEYS, UNWRITTEN_SITE_ID } from "@/lib/unwritten/constants";
import { deleteDraft, getDraft, saveDraftStep, startDraft } from "@/lib/unwritten/drafts";
import { serializeForStudio } from "@/lib/unwritten/orders";
import { deletePhotos, photoKey, storePhoto } from "@/lib/unwritten/photos";
import { STARTER_DEFINITIONS, STARTER_DEFINITIONS_VERSION } from "@/lib/unwritten/questionnaire/definitions";
import { checkAnswer, normalizeAnswer, photoIdsIn, validateStep } from "@/lib/unwritten/questionnaire/engine";
import { allQuestions, definitionSchema } from "@/lib/unwritten/questionnaire/schema";
import { seedUnwritten } from "@/lib/unwritten/seed";
import { db, resetDb } from "./helpers/db";

const movie = definitionSchema.parse(STARTER_DEFINITIONS["movie-of-my-life"]);
const photoQ = allQuestions(movie).find((q) => q.id === "childhoodPhotos")!;
const id = (c: string) => `ph_${c.repeat(24)}`;

async function jpeg(opts: { width: number; height: number; orientation?: number; gps?: boolean }) {
  let img = sharp({ create: { width: opts.width, height: opts.height, channels: 3, background: { r: 200, g: 120, b: 80 } } }).jpeg();
  if (opts.orientation) img = img.withMetadata({ orientation: opts.orientation });
  if (opts.gps) img = img.withExif({ IFD0: { Copyright: "Famille Test", ImageDescription: "Maison de vacances" } });
  return img.toBuffer();
}

beforeEach(async () => {
  await resetDb();
  await seedUnwritten(db);
});
afterAll(async () => { await db.$disconnect(); });

describe("question « photos » (moteur)", () => {
  it("normalise les entrées, garde les légendes, ignore les identifiants invalides et les doublons", () => {
    expect(normalizeAnswer(photoQ, [id("a"), `${id("b")}::Lyon, 1962`, "pas-une-photo", id("a")])).toEqual([id("a"), `${id("b")}::Lyon, 1962`]);
    expect(normalizeAnswer(photoQ, id("c"))).toEqual([id("c")]);
    expect(normalizeAnswer(photoQ, [])).toBeUndefined();
  });
  it("refuse plus de photos que le maximum de la question", () => {
    expect(checkAnswer(photoQ, [id("a"), id("b"), id("c"), id("d")], { consent: false })).toBeNull();
    expect(checkAnswer(photoQ, [id("a"), id("b"), id("c"), id("d"), id("e")], { consent: false })).toBe("tooManyPhotos");
  });
  it("n'accepte du navigateur que des photos déjà téléversées par ce répondant", () => {
    const existing = { scope: "life", childhoodPhotos: [id("a"), id("b")] };
    const r = validateStep(movie, "childhood", { childhoodPhotos: [`${id("b")}::La maison`, id("z")] }, existing, { consent: false });
    expect(r.ok).toBe(true);
    // id("z") n'a jamais été téléversée : ignorée ; id("a") retirée par le client
    expect(r.answers.childhoodPhotos).toEqual([`${id("b")}::La maison`]);
    expect(photoIdsIn(r.answers)).toEqual([id("b")]);
  });
});

describe("stockage des photos", () => {
  it("ré-encode en JPEG, applique l'orientation, supprime les métadonnées et crée une vignette", async () => {
    const photo = await storePhoto(await jpeg({ width: 3000, height: 1200, orientation: 6, gps: true }));
    // Orientation 6 : l'image est tournée d'un quart de tour, puis réduite à 2400 px
    expect(photo.width).toBe(960);
    expect(photo.height).toBe(2400);
    expect(photo.lowRes).toBe(false);
    const stored = await getStorage().get(photoKey(photo.id));
    expect(stored?.contentType).toBe("image/jpeg");
    const meta = await sharp(stored!.body).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation ?? 1).toBe(1);
    const thumb = await sharp((await getStorage().get(photoKey(photo.id, "thumb")))!.body).metadata();
    expect(Math.max(thumb.width!, thumb.height!)).toBe(480);
    await deletePhotos([photo.id]);
    expect(await getStorage().exists(photoKey(photo.id))).toBe(false);
    expect(await getStorage().exists(photoKey(photo.id, "thumb"))).toBe(false);
  });
  it("signale une petite image et refuse un fichier qui n'est pas une image", async () => {
    const small = await storePhoto(await jpeg({ width: 800, height: 600 }));
    expect(small.lowRes).toBe(true);
    await deletePhotos([small.id]);
    await expect(storePhoto(Buffer.from("%PDF-1.4 pas une image"))).rejects.toMatchObject({ code: "not_image" });
  });
});

describe("cycle de vie des photos d'un brouillon", () => {
  async function movieDraft() {
    const product = await db.product.findUniqueOrThrow({ where: { slug: "the-movie-of-my-life" } });
    const d = await startDraft({ siteId: UNWRITTEN_SITE_ID, productId: product.id, locale: "fr", currency: "EUR", utm: {}, retentionDays: 30 }, db);
    const a = await storePhoto(await jpeg({ width: 1600, height: 1200 }));
    const b = await storePhoto(await jpeg({ width: 1600, height: 1200 }));
    await db.personalizationDraft.update({ where: { id: d.id }, data: { answers: { scope: "life", genre: "drama", childhoodPhotos: [a.id, b.id] } as Prisma.InputJsonValue } });
    return { draft: (await getDraft(d.id, db))!, a, b };
  }

  it("supprime le fichier d'une photo retirée par le client", async () => {
    const { draft, a, b } = await movieDraft();
    const r = await saveDraftStep(draft, "childhood", { childhoodPhotos: [`${b.id}::Mon père`] }, { consent: false, retentionDays: 30 }, db);
    expect(r.ok).toBe(true);
    expect((await getDraft(draft.id, db))!.answers).toMatchObject({ childhoodPhotos: [`${b.id}::Mon père`] });
    expect(await getStorage().exists(photoKey(a.id))).toBe(false);
    expect(await getStorage().exists(photoKey(b.id))).toBe(true);
    await deletePhotos([b.id]);
  });

  it("supprime les photos avec le brouillon", async () => {
    const { draft, a, b } = await movieDraft();
    expect(await deleteDraft(draft.id, db)).toBe(true);
    expect(await getStorage().exists(photoKey(a.id))).toBe(false);
    expect(await getStorage().exists(photoKey(b.id))).toBe(false);
  });
});

describe("plan des livres", () => {
  it("annonce les mêmes pages que les produits, et chaque question citée existe", () => {
    for (const key of COLLECTION_KEYS) {
      const starter = STARTER_PRODUCTS.find((p) => p.key === key)!;
      expect(pageRange(key)).toEqual({ min: starter.pagesMin, max: starter.pagesMax });
      const ids = new Set(allQuestions(definitionSchema.parse(STARTER_DEFINITIONS[key])).map((q) => q.id));
      for (const c of BLUEPRINTS[key].chapters) {
        for (const q of [...(c.sources ?? []), ...(c.highlights ?? []), ...(c.photos ? [c.photos.question] : [])]) expect(ids, `${key}.${c.key} → ${q}`).toContain(q);
        if (c.photos) expect(allQuestions(definitionSchema.parse(STARTER_DEFINITIONS[key])).find((x) => x.id === c.photos!.question)!.maxFiles).toBe(c.photos.max);
      }
    }
    expect(pageRange("movie-of-my-life")).toEqual({ min: 72, max: 88 });
  });
  it("suit l'avancement : réponses, photos et rappels", () => {
    const plan = bookPlan("movie-of-my-life", { locale: "fr", answers: { scope: "life", birthPlace: "Lyon, la Croix-Rousse", childhoodMemory: "Le marché du dimanche", childhoodPhotos: [id("a"), id("b")] } });
    const ch = plan.chapters.find((c) => c.key === "childhood")!;
    expect(ch.number).toBe(1);
    expect(ch).toMatchObject({ answered: 2, sources: 3, photosAdded: 2, photosMax: 4, highlights: ["Lyon, la Croix-Rousse"] });
    expect(plan.photosAdded).toBe(2);
    // Édition « un chapitre » : pas d'enfance, mais le décor et le cœur de l'histoire
    const chapter = bookPlan("movie-of-my-life", { locale: "fr", edition: "chapter" });
    expect(chapter.chapters.map((c) => c.key)).toEqual(["opening", "setting", "heart", "people", "places", "scenes", "work", "today", "credits"]);
    expect(chapter.chapters.find((c) => c.key === "today")!.title).toBe("Ce qui reste");
  });
});

describe("mise à niveau du seed", () => {
  it("publie la version 2 du questionnaire et met à jour les textes d'un produit jamais modifié", async () => {
    const product = await db.product.findUniqueOrThrow({ where: { slug: "the-secret-book" }, include: { personalization: true } });
    // État d'une base créée avec la version 1
    await db.questionnaire.updateMany({ where: { productId: product.id }, data: { version: 1, definition: { schemaVersion: 1, steps: [] } } });
    await db.$executeRaw`UPDATE "PersonalizedProduct" SET content = '{"en":{},"fr":{}}'::jsonb, "pagesMin" = 1, "updatedAt" = "createdAt" WHERE "productId" = ${product.id}`;
    await seedUnwritten(db);
    const versions = await db.questionnaire.findMany({ where: { productId: product.id }, orderBy: { version: "asc" } });
    expect(versions.map((v) => [v.version, v.status])).toEqual([[1, "ARCHIVED"], [STARTER_DEFINITIONS_VERSION, "ACTIVE"]]);
    const perso = await db.personalizedProduct.findUniqueOrThrow({ where: { productId: product.id } });
    expect((perso.content as { contentVersion?: number }).contentVersion).toBe(2);
    expect(perso.pagesMin).toBe(32);
    // Idempotent
    await seedUnwritten(db);
    expect(await db.questionnaire.count({ where: { productId: product.id } })).toBe(2);
  });
  it("ne touche ni une version publiée dans l'admin, ni des textes modifiés", async () => {
    const product = await db.product.findUniqueOrThrow({ where: { slug: "before-its-too-late" } });
    await db.questionnaire.updateMany({ where: { productId: product.id }, data: { version: 1, createdBy: "admin@example.com" } });
    await db.$executeRaw`UPDATE "PersonalizedProduct" SET content = '{"en":{},"fr":{}}'::jsonb, "updatedAt" = "createdAt" + interval '1 day' WHERE "productId" = ${product.id}`;
    await seedUnwritten(db);
    expect(await db.questionnaire.count({ where: { productId: product.id } })).toBe(1);
    const perso = await db.personalizedProduct.findUniqueOrThrow({ where: { productId: product.id } });
    expect(perso.content).toEqual({ en: {}, fr: {} });
  });
});

describe("transmission au studio", () => {
  it("liste les photos (légende, question, chemin) et le plan à suivre", () => {
    const def = definitionSchema.parse(STARTER_DEFINITIONS["movie-of-my-life"]);
    const row = {
      id: "item_1", status: "PENDING_GENERATION", locale: "fr", mode: "self", isGift: false,
      order: { number: "UW-2026-000001", paidAt: new Date() },
      product: { id: "p1", slug: "the-movie-of-my-life", name: "The Movie of My Life", personalization: { collectionKey: "movie-of-my-life", pagesMin: 72, pagesMax: 88, formats: ["PDF"] } },
      questionnaire: { id: "q1", version: 2, definition: def },
      answers: { scope: "life", heroName: "Hélène", coverPhoto: [id("c")], childhoodPhotos: [`${id("a")}::Lyon, 1962`, id("b")] },
      gift: null, studioRef: null, lastError: null, errorCount: 0, fileKey: null, fileName: null, fileMime: null, fileSize: null,
      dataPurgedAt: null, createdAt: new Date(), productionStartedAt: null, deliveredAt: null,
    } as unknown as Parameters<typeof serializeForStudio>[0];
    const out = serializeForStudio(row);
    expect(out.photos).toEqual([
      { id: id("c"), questionId: "coverPhoto", position: 0, caption: null, path: `/api/v1/personal/items/item_1/photos/${id("c")}` },
      { id: id("a"), questionId: "childhoodPhotos", position: 0, caption: "Lyon, 1962", path: `/api/v1/personal/items/item_1/photos/${id("a")}` },
      { id: id("b"), questionId: "childhoodPhotos", position: 1, caption: null, path: `/api/v1/personal/items/item_1/photos/${id("b")}` },
    ]);
    expect(out.plan?.pagesMin).toBe(72);
    expect(out.plan?.chapters.find((c) => c.key === "childhood")?.photosAdded).toBe(2);
  });
});
