/**
 * Publication d'un livre vers la boutique (apps/shop, API v1).
 *
 * Flux : fiche commerciale dérivée du livre + surcharges éditées (Book.shopListing)
 * → création ou mise à jour du produit → couverture (image MAIN) → aperçus de
 * pages (PDF_PREVIEW) → PDF exporté (fichier privé MAIN_PDF) → publication.
 * Idempotent : un livre déjà synchronisé est mis à jour, jamais dupliqué.
 */
import type { Book, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getStorage } from "../storage";
import { getShopSettings } from "../settings";
import { ShopListingSchema, type ShopListing, type ShopSettings } from "../schemas/settings";
import { ageRangeLabel, BOOK_TYPES } from "../schemas/activity";
import { ShopApiError, ShopClient, type ShopProduct } from "./client";
import { isStructuredKit, kitContentsFor, kitType, LEGACY_ACTIVITY_TYPE } from "../kits/types";
import { KitCustomizationSchema, PranksKitSchema, TreasureHuntSchema } from "../kits/schemas";

export type BookForListing = Book & {
  activities: Array<{ activity: { title: string; concept: Prisma.JsonValue | null; currentVersion: { content: Prisma.JsonValue } | null; durationMinutes: number; difficulty: number; category: string } }>;
  exports: Array<{ id: string; kind: string; status: string; pageCount: number | null; assetId: string | null; createdAt: Date }>;
};

const bookInclude = {
  activities: { orderBy: { position: "asc" as const }, include: { activity: { select: { title: true, concept: true, durationMinutes: true, difficulty: true, category: true, currentVersion: { select: { content: true } } } } } },
  exports: { where: { status: "COMPLETED" as const, kind: { in: ["BOOK_DIGITAL", "BOOK_PRINT"] as never } }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.BookInclude;

export function parseAgeRange(range: string): { ageMin?: number; ageMax?: number } {
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(range);
  return m ? { ageMin: Number(m[1]), ageMax: Number(m[2]) } : {};
}

export function slugify(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function stableSlug(book: Pick<Book, "id" | "title">): string {
  return `${slugify(book.title) || "ebook"}-${book.id.slice(-6).toLowerCase()}`;
}

function templateFor(bookType: string, fallback: ShopSettings["defaultTemplate"]) {
  if (["jeux", "prescolaire", "creativite", "bricolages"].includes(bookType)) return "ACTIVITY" as const;
  if (["inventions", "sciences", "nature"].includes(bookType)) return "ACTIVITY" as const;
  return fallback;
}

/** Fiche commerciale dérivée du livre, puis fusionnée avec les surcharges éditées dans le studio. */
export function buildListingFromBook(book: BookForListing, settings: ShopSettings) {
  if (isStructuredKit(book.kitType) && book.kitContent) return buildListingFromKit(book, settings);
  const override = ShopListingSchema.safeParse(book.shopListing ?? {});
  const o: ShopListing = override.success ? override.data : {};
  const def = book.kitType && book.kitType !== LEGACY_ACTIVITY_TYPE ? kitType(book.kitType) : null;
  const typeLabel = BOOK_TYPES.find((t) => t.key === book.bookType)?.label ?? book.bookType;
  const cover = (book.cover ?? {}) as { backText?: string; introduction?: string; tagline?: string };
  const titles = book.activities.map((a) => a.activity.title);
  const latestExport = book.exports.find((e) => e.kind === "BOOK_DIGITAL") ?? book.exports[0];
  const ages = parseAgeRange(book.ageRange);
  const durations = book.activities.map((a) => a.activity.durationMinutes).filter(Boolean);
  const avgDuration = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : undefined;

  const kitContents = book.activities.map((a) => {
    const concept = (a.activity.concept ?? {}) as { summary?: string };
    const content = (a.activity.currentVersion?.content ?? {}) as { subtitle?: string; description?: string };
    const line = content.subtitle || concept.summary || content.description || "";
    return { title: a.activity.title, description: line.split(/(?<=[.!?])\s/)[0]?.slice(0, 200) ?? "", icon: "sparkles" };
  });

  const shortDescription = (cover.backText || book.brief || `${titles.length} activités « ${typeLabel.toLowerCase()} » pour les enfants de ${ageRangeLabel(book.ageRange)}, à télécharger et imprimer à la maison.`).slice(0, 400);
  const longDescription = [
    cover.introduction,
    titles.length ? `## Au sommaire\n\n${titles.map((t) => `- ${t}`).join("\n")}` : null,
    latestExport?.pageCount ? `\n${latestExport.pageCount} pages au format PDF, prêtes à imprimer.` : null,
  ].filter(Boolean).join("\n\n");

  const keywords = [...new Set([typeLabel.toLowerCase(), ageRangeLabel(book.ageRange), ...titles.slice(0, 8).map((t) => t.toLowerCase())])].slice(0, 12);

  return {
    name: o.name ?? book.title,
    slug: o.slug ?? book.shopProductSlug ?? stableSlug(book),
    tagline: o.tagline ?? book.subtitle ?? `${titles.length} activités ${typeLabel.toLowerCase()} à imprimer`,
    shortDescription: o.shortDescription ?? shortDescription,
    longDescription: o.longDescription ?? longDescription,
    story: o.story ?? cover.introduction ?? undefined,
    template: o.template ?? def?.template ?? templateFor(book.bookType, settings.defaultTemplate),
    categorySlug: o.categorySlug ?? def?.shopCategory ?? settings.defaultCategorySlug,
    collectionSlugs: o.collectionSlugs ?? [],
    universe: o.universe ?? typeLabel,
    tags: o.tags ?? [typeLabel.toLowerCase(), "e-book", "à imprimer"],
    badges: ["Nouveau"],
    heroBadges: ["PDF immédiat", "Prêt à imprimer", ageRangeLabel(book.ageRange)],
    ageMin: o.ageMin ?? ages.ageMin,
    ageMax: o.ageMax ?? ages.ageMax,
    durationMinutes: o.durationMinutes === null ? undefined : o.durationMinutes ?? avgDuration,
    pageCount: latestExport?.pageCount ?? undefined,
    fileFormat: "PDF",
    materials: [...new Set(book.activities.flatMap((a) => ((a.activity.concept ?? {}) as { keyMaterials?: string[] }).keyMaterials ?? []))].slice(0, 12),
    priceCents: o.priceCents ?? settings.defaultPriceCents,
    salePriceCents: o.salePriceCents ?? undefined,
    currency: "EUR",
    kitContents: o.kitContents ?? kitContents,
    faq: o.faq ?? [],
    sellingPoints: o.sellingPoints ?? [],
    seoTitle: (o.seoTitle ?? `${book.title} — e-book d'activités à imprimer`).slice(0, 70),
    seoDescription: (o.seoDescription ?? shortDescription).slice(0, 170),
    keywords: o.keywords ?? keywords,
  };
}

/** Fiche commerciale d'un kit structuré : contenu réel du kit + section « boutique » + personnalisation. */
export function buildListingFromKit(book: BookForListing, settings: ShopSettings) {
  const def = kitType(book.kitType);
  const o: ShopListing = ShopListingSchema.safeParse(book.shopListing ?? {}).data ?? {};
  const c = KitCustomizationSchema.safeParse(book.customization ?? {}).data;
  const hunt = def.format === "treasure_hunt" ? TreasureHuntSchema.safeParse(book.kitContent).data : undefined;
  const pranks = def.format === "pranks" ? PranksKitSchema.safeParse(book.kitContent).data : undefined;
  const content = hunt ?? pranks;
  const b = content?.boutique ?? {};
  const count = hunt ? hunt.enigmes.length : pranks?.idees.length ?? book.targetCount;
  const latestExport = book.exports.find((e) => e.kind === "BOOK_DIGITAL") ?? book.exports[0];
  const ages = parseAgeRange(book.ageRange);
  const universe = o.universe ?? (c?.universe || b.universe || def.defaultUniverse || def.label);
  const hero = hunt?.personnage?.nom ?? pranks?.personnages?.[0]?.nom;
  const shortDescription = (o.shortDescription ?? b.shortDescription ?? `${def.label} à imprimer pour les ${ageRangeLabel(book.ageRange)} : ${count} ${def.countLabel}${hero ? ` avec ${hero}` : ""}. Téléchargement immédiat.`).slice(0, 400);
  const story = o.story ?? b.story ?? (hunt ? hunt.lettre : pranks?.lettre_arrivee);
  const heroBadges = b.heroBadges?.length ? b.heroBadges : ["PDF A4 immédiat", ageRangeLabel(book.ageRange), `${count} ${def.countLabel}`];
  const tags = o.tags ?? b.tags ?? [def.label.toLowerCase(), universe.toLowerCase(), "à imprimer"];
  return {
    name: o.name ?? book.title,
    slug: o.slug ?? book.shopProductSlug ?? stableSlug(book),
    tagline: (o.tagline ?? b.tagline ?? book.subtitle ?? content?.sous_titre ?? "").slice(0, 200) || undefined,
    shortDescription,
    longDescription: o.longDescription ?? b.longDescription ?? undefined,
    story: story ?? undefined,
    template: o.template ?? c?.shopTemplate ?? def.template,
    categorySlug: o.categorySlug ?? c?.shopCategorySlug ?? def.shopCategory ?? settings.defaultCategorySlug,
    collectionSlugs: o.collectionSlugs ?? [],
    universe,
    tags,
    badges: ["Nouveau"],
    heroBadges,
    ageMin: o.ageMin ?? b.ageMin ?? ages.ageMin,
    ageMax: o.ageMax ?? b.ageMax ?? ages.ageMax,
    playersMin: b.playersMin,
    playersMax: b.playersMax,
    durationMinutes: o.durationMinutes === null ? undefined : o.durationMinutes ?? b.durationMinutes,
    difficulty: b.difficulty,
    pageCount: latestExport?.pageCount ?? b.pageCount ?? undefined,
    fileFormat: "PDF A4",
    materials: (b.materials ?? hunt?.guide?.materiel ?? []).slice(0, 12),
    priceCents: o.priceCents ?? c?.priceCents ?? b.priceCents ?? def.defaultPriceCents ?? settings.defaultPriceCents,
    salePriceCents: o.salePriceCents ?? undefined,
    currency: "EUR",
    kitContents: o.kitContents ?? (b.kitContents?.length ? b.kitContents : kitContentsFor(def, { main: count })),
    faq: o.faq ?? b.faq ?? [],
    sellingPoints: o.sellingPoints ?? b.sellingPoints ?? [],
    seoTitle: (o.seoTitle ?? b.seoTitle ?? `${book.title} — ${def.label.toLowerCase()} à imprimer`).slice(0, 70),
    seoDescription: (o.seoDescription ?? b.seoDescription ?? shortDescription).slice(0, 170),
    keywords: o.keywords ?? b.keywords ?? tags,
  };
}

export interface PublishOptions {
  exportId?: string;
  publish?: boolean; // publication immédiate (sinon brouillon « à valider »)
  withPreviews?: boolean; // rendre des aperçus de pages (Chromium)
  creationCostCents?: number; // coût de création (IA, illustrations) pour la rentabilité dans la boutique
  log?: (message: string) => void | Promise<void>;
}

export interface PublishResult {
  product: ShopProduct;
  status: "published" | "draft_pending_review" | "updated";
  warnings: string[];
}

export async function loadBookForListing(bookId: string): Promise<BookForListing> {
  return prisma.book.findUniqueOrThrow({ where: { id: bookId }, include: bookInclude }) as Promise<BookForListing>;
}

/** Crée ou met à jour la fiche produit du livre dans la boutique, avec couverture, aperçus et PDF. */
export async function publishBookToShop(bookId: string, opts: PublishOptions = {}): Promise<PublishResult> {
  const settings = await getShopSettings();
  const client = new ShopClient({ baseUrl: settings.shopApiUrl, apiKey: settings.shopApiKey });
  const log = opts.log ?? (() => undefined);
  const warnings: string[] = [];
  const book = await loadBookForListing(bookId);
  const listing = { ...buildListingFromBook(book, settings), ...(opts.creationCostCents != null ? { creationCostCents: Math.max(0, Math.round(opts.creationCostCents)) } : {}) };
  const shouldPublish = opts.publish ?? (ShopListingSchema.safeParse(book.shopListing ?? {}).data?.autoPublish ?? settings.autoPublish);

  try {
    // 1. Produit : retrouvé par id mémorisé, sinon par slug stable, sinon créé
    let product: ShopProduct | null = book.shopProductId ? await client.getProduct(book.shopProductId) : null;
    if (!product) product = await client.findBySlug(listing.slug);
    const { slug: _slug, ...patch } = listing;
    if (product) {
      await log(`Mise à jour du produit ${product.slug}`);
      product = (await client.updateProduct(product.id, patch)).data;
    } else {
      await log(`Création du produit ${listing.slug}`);
      product = (await client.createProduct(listing)).data;
    }
    const productId = product.id;

    // 2. Couverture → image MAIN
    const coverAsset = await currentCoverAsset(book);
    if (coverAsset) {
      await log("Envoi de la couverture");
      await client.uploadImage(productId, coverAsset, { role: "MAIN", alt: `Couverture — ${book.title}`, replace: true });
    } else {
      warnings.push("Aucune illustration de couverture acceptée : la fiche utilisera un visuel d'attente.");
    }

    // 3. PDF exporté → fichier privé MAIN_PDF
    const exp = opts.exportId
      ? await prisma.export.findUnique({ where: { id: opts.exportId } })
      : book.exports.find((e) => e.kind === "BOOK_DIGITAL") ?? book.exports[0] ?? null;
    if (exp?.assetId && exp.status === "COMPLETED") {
      const asset = await prisma.asset.findUnique({ where: { id: exp.assetId } });
      if (asset) {
        await log(`Envoi du PDF (${exp.pageCount ?? "?"} pages)`);
        const data = await getStorage().get(asset.key);
        await client.uploadFile(productId, { data, mime: "application/pdf", name: `${slugify(book.title) || "ebook"}.pdf` }, { kind: "MAIN_PDF", description: `${book.title} — ${exp.pageCount ?? ""} pages`.trim(), replace: true });
      }
    } else {
      warnings.push("Aucun export PDF terminé : le produit ne pourra pas être publié tant qu'un fichier n'est pas attaché.");
    }

    // 4. Aperçus de pages (3 premières pages intérieures) → PDF_PREVIEW
    if (opts.withPreviews !== false) {
      try {
        const previews = await renderPagePreviews(book, 3);
        for (const [i, img] of previews.entries()) {
          await client.uploadImage(productId, img, { role: "PDF_PREVIEW", alt: `Aperçu page ${i + 1} — ${book.title}`, replace: i === 0 });
        }
        if (previews.length) await log(`${previews.length} aperçu(s) de pages envoyé(s)`);
      } catch (e) {
        warnings.push(`Aperçus de pages non générés : ${e instanceof Error ? e.message : e}`);
      }
    }

    // 5. Publication
    let status: PublishResult["status"] = "updated";
    if (shouldPublish && product.status !== "PUBLISHED") {
      try {
        product = (await client.publish(productId)).data;
        status = "published";
      } catch (e) {
        if (e instanceof ShopApiError && e.status === 403) {
          status = "draft_pending_review";
          warnings.push("La clé API n'autorise pas la publication directe : le produit est en attente de validation dans la boutique.");
        } else if (e instanceof ShopApiError && e.status === 409) {
          status = "draft_pending_review";
          warnings.push(e.message);
        } else throw e;
      }
    } else if (product.status === "PUBLISHED") {
      status = "published";
    } else {
      status = "draft_pending_review";
    }

    product = (await client.getProduct(productId)) ?? product;
    await prisma.book.update({
      where: { id: bookId },
      data: {
        shopProductId: product.id,
        shopProductSlug: product.slug,
        shopLastSyncAt: new Date(),
        shopPublishedAt: product.status === "PUBLISHED" ? (book.shopPublishedAt ?? new Date()) : book.shopPublishedAt,
        shopSyncError: warnings.length ? warnings.join(" | ") : null,
      },
    });
    return { product, status, warnings };
  } catch (e) {
    const message = e instanceof ShopApiError ? `${e.message}${e.details ? ` — ${JSON.stringify(e.details).slice(0, 300)}` : ""}` : e instanceof Error ? e.message : String(e);
    await prisma.book.update({ where: { id: bookId }, data: { shopLastSyncAt: new Date(), shopSyncError: message } }).catch(() => undefined);
    throw e;
  }
}

/** Illustration de couverture courante et acceptée (sinon la plus récente générée). */
async function currentCoverAsset(book: Book): Promise<{ data: Buffer; mime: string; name: string } | null> {
  const cover = (book.cover ?? {}) as { illustrationId?: string };
  const ill =
    (cover.illustrationId ? await prisma.illustration.findUnique({ where: { id: cover.illustrationId }, include: { asset: true } }) : null) ??
    (await prisma.illustration.findFirst({ where: { bookId: book.id, kind: "COVER", isCurrent: true, status: { in: ["ACCEPTED", "GENERATED"] }, assetId: { not: null } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { asset: true } }));
  if (!ill?.asset) return null;
  const data = await getStorage().get(ill.asset.key);
  return { data, mime: ill.asset.mime, name: `couverture.${ill.asset.mime.split("/")[1] ?? "png"}` };
}

/** Rend les premières pages du livre en PNG via la route d'impression (Chromium déjà utilisé pour les PDF). */
export async function renderPagePreviews(book: Book, count = 3): Promise<Array<{ data: Buffer; mime: string; name: string }>> {
  const { getBrowser } = await import("../pdf/browser");
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const url = new URL(`${appUrl}/print/books/${book.id}`);
  url.searchParams.set("mode", "digital");
  if (process.env.INTERNAL_TOKEN) url.searchParams.set("token", process.env.INTERNAL_TOKEN);
  const browser = await getBrowser();
  const context = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 900, height: 1300 } });
  const page = await context.newPage();
  try {
    await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForFunction(() => (window as unknown as { __INVENTOR_READY__?: boolean }).__INVENTOR_READY__ === true, null, { timeout: 60_000 });
    const pages = page.locator("[data-page-index]");
    const total = await pages.count();
    const out: Array<{ data: Buffer; mime: string; name: string }> = [];
    // On saute la couverture (index 0) si le livre a plus d'une page
    const start = total > 1 ? 1 : 0;
    for (let i = start; i < Math.min(total, start + count); i++) {
      const buf = await pages.nth(i).screenshot({ type: "jpeg", quality: 82 });
      out.push({ data: Buffer.from(buf), mime: "image/jpeg", name: `apercu-page-${i + 1}.jpg` });
    }
    return out;
  } finally {
    await context.close();
  }
}

/** Teste la connexion (clé + URL) : renvoie les catégories disponibles. */
export async function testShopConnection() {
  const settings = await getShopSettings();
  const client = new ShopClient({ baseUrl: settings.shopApiUrl, apiKey: settings.shopApiKey });
  const [categories, collections] = await Promise.all([client.categories(), client.collections()]);
  return { categories, collections };
}
