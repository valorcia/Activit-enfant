import "server-only";
import { parse } from "csv-parse/sync";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { getStorage, publicKey } from "@/lib/storage";
import { createProduct, updateProduct, type Actor } from "@/lib/products/service";
import { productCsvRowSchema, productInputSchema, type ProductCsvRow, type ProductInput } from "@/lib/schemas/product";
import { slugify } from "@/lib/utils";
import type { ImportSource } from "@prisma/client";

export interface ParsedCsvRow { line: number; raw: Record<string, string>; row?: ProductCsvRow; errors: string[] }

function detectDelimiter(text: string): "," | ";" {
  const head = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  return (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ";" : ",";
}

/** Analyse un CSV (UTF-8, séparateur , ou ;) et valide chaque ligne. */
export function parseProductsCsv(text: string): { rows: ParsedCsvRow[]; columns: string[] } {
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean);
  const records = parse(clean, { columns: (h: string[]) => h.map((c) => c.trim().toLowerCase().replace(/\s+/g, "_")), delimiter, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true }) as Record<string, string>[];
  const columns = records.length ? Object.keys(records[0]) : [];
  const rows: ParsedCsvRow[] = records.map((raw, i) => {
    const parsed = productCsvRowSchema.safeParse(raw);
    if (!parsed.success) return { line: i + 2, raw, errors: parsed.error.issues.map((is) => `${is.path.join(".") || "ligne"} : ${is.message}`) };
    return { line: i + 2, raw, row: parsed.data, errors: [] };
  });
  return { rows, columns };
}

const num = (v?: string) => (v && v.trim() !== "" ? v.trim() : undefined);
const euros = (v?: string) => { const n = num(v); if (n === undefined) return undefined; const f = Number(n.replace(",", ".").replace(/\s|€/g, "")); return Number.isFinite(f) ? Math.round(f * 100) : undefined; };
const list = (v?: string, sep = /[,|]/) => (v ? v.split(sep).map((s) => s.trim()).filter(Boolean) : []);
const date = (v?: string) => { const n = num(v); if (!n) return undefined; const d = new Date(n); return Number.isNaN(d.getTime()) ? undefined : d; };

/** Convertit une ligne CSV validée en ProductInput (catégorie/collections résolues par slug ou nom). */
type Lookup = { id: string; slug: string; name: string; siteId?: string };
export async function csvRowToProductInput(row: ProductCsvRow, lookups?: { categories: Lookup[]; collections: Lookup[] }, siteId?: string): Promise<ProductInput> {
  const inSite = (l: Lookup[]) => (siteId ? l.filter((x) => !x.siteId || x.siteId === siteId) : l);
  const cats = inSite(lookups?.categories ?? (await prisma.category.findMany({ where: siteId ? { siteId } : {}, select: { id: true, slug: true, name: true, siteId: true } })));
  const cols = inSite(lookups?.collections ?? (await prisma.collection.findMany({ where: siteId ? { siteId } : {}, select: { id: true, slug: true, name: true, siteId: true } })));
  const findCat = (v?: string) => { const n = num(v); if (!n) return null; const s = slugify(n); return cats.find((c) => c.slug === s || c.name.toLowerCase() === n.toLowerCase())?.id ?? null; };
  const collectionIds = list(row.collections, /\|/).map((v) => { const s = slugify(v); return cols.find((c) => c.slug === s || c.name.toLowerCase() === v.toLowerCase())?.id; }).filter(Boolean) as string[];
  const template = (num(row.template)?.toUpperCase() ?? "CLASSIC");
  const statusRaw = num(row.status)?.toUpperCase() ?? "DRAFT";
  const statusMap: Record<string, string> = { BROUILLON: "DRAFT", PROGRAMME: "SCHEDULED", PROGRAMMÉ: "SCHEDULED", PUBLIE: "PUBLISHED", PUBLIÉ: "PUBLISHED", ARCHIVE: "ARCHIVED", ARCHIVÉ: "ARCHIVED" };
  const taxRate = num(row.tax_rate);
  const priceCents = euros(row.price);
  if (priceCents === undefined) throw new Error("Prix invalide");
  return productInputSchema.parse({
    name: row.name, slug: num(row.slug) ? slugify(row.slug as string) : undefined, tagline: num(row.tagline) ?? null, shortDescription: num(row.short_description) ?? null, longDescription: num(row.long_description) ?? null, story: num(row.story) ?? null,
    template: ["ADVENTURE", "ACTIVITY", "STORY", "EVENT", "CLASSIC", "GUIDE", "RECIPES"].includes(template) ? template : "CLASSIC",
    categoryId: findCat(row.category), collectionIds, universe: num(row.universe) ?? null, tags: list(row.tags), badges: list(row.badges), heroBadges: [],
    ageMin: num(row.age_min), ageMax: num(row.age_max), playersMin: num(row.players_min), playersMax: num(row.players_max), durationMinutes: num(row.duration_minutes), difficulty: num(row.difficulty), pageCount: num(row.page_count), fileFormat: "PDF", materials: list(row.materials),
    priceCents, salePriceCents: euros(row.sale_price), saleStartsAt: date(row.sale_starts_at), saleEndsAt: date(row.sale_ends_at), currency: "EUR", taxRateBp: taxRate ? Math.round(Number(taxRate.replace(",", ".")) * 100) : 2000,
    kitContents: [], faq: [], sellingPoints: [],
    seoTitle: num(row.seo_title) ?? null, seoDescription: num(row.seo_description) ?? null, keywords: list(row.keywords), ogImageUrl: null, promoText: null, recommendedProductIds: [],
    status: statusMap[statusRaw] ?? (["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(statusRaw) ? statusRaw : "DRAFT"), scheduledAt: date(row.scheduled_at), isFeatured: false,
    ...(siteId ? { siteId } : {}),
  });
}

/** Télécharge une image distante vers le stockage public et l'attache au produit. */
export async function importRemoteImage(productId: string, url: string, role: "MAIN" | "GALLERY", position = 0): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return false;
    const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!mime.startsWith("image/")) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 20 * 1024 * 1024) return false;
    const ext = { "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/avif": "avif" }[mime] ?? "jpg";
    const key = publicKey(`products/${productId}`, `${nanoid(10)}.${ext}`);
    const storage = getStorage();
    await storage.put(key, buf, mime);
    if (role === "MAIN") await prisma.productImage.updateMany({ where: { productId, role: "MAIN" }, data: { role: "GALLERY" } });
    await prisma.productImage.create({ data: { productId, url: storage.publicUrl(key), storageKey: key, role, position } });
    return true;
  } catch {
    return false;
  }
}

export interface ImportResult { jobId: string; total: number; created: number; updated: number; failed: number; errors: Array<{ line: number; name?: string; error: string }> }

/** Importe des lignes validées : crée ou met à jour par slug, télécharge les images, journalise un ImportJob. */
/** `siteId` : univers des nouveaux produits (défaut : univers par défaut) ; un produit existant reste dans son univers. */
export async function importProducts(rows: ParsedCsvRow[], actor: Actor, opts: { source?: ImportSource; fileName?: string; siteId?: string } = {}): Promise<ImportResult> {
  const job = await prisma.importJob.create({ data: { source: opts.source ?? "CSV", fileName: opts.fileName, total: rows.length, createdById: actor.userId ?? undefined } });
  const lookups = { categories: await prisma.category.findMany({ select: { id: true, slug: true, name: true, siteId: true } }), collections: await prisma.collection.findMany({ select: { id: true, slug: true, name: true, siteId: true } }) };
  const targetSiteId = opts.siteId ?? (await prisma.site.findFirst({ where: { isDefault: true }, select: { id: true } }))?.id;
  const result: ImportResult = { jobId: job.id, total: rows.length, created: 0, updated: 0, failed: 0, errors: [] };

  for (const r of rows) {
    if (!r.row) { result.failed++; result.errors.push({ line: r.line, name: r.raw.name, error: r.errors.join(" ; ") }); continue; }
    try {
      const rowSlug = num(r.row.slug) ? slugify(r.row.slug as string) : slugify(r.row.name);
      const existing = await prisma.product.findUnique({ where: { slug: rowSlug }, select: { id: true, siteId: true } });
      const input = await csvRowToProductInput(r.row, lookups, existing?.siteId ?? targetSiteId);
      const slug = input.slug ?? slugify(input.name);
      const product = existing ? await updateProduct(existing.id, { ...input, slug }, actor) : await createProduct({ ...input, slug }, { ...actor, source: actor.source ?? "csv" });
      if (existing) result.updated++; else result.created++;
      const main = num(r.row.main_image_url);
      if (main) await importRemoteImage(product.id, main, "MAIN");
      const gallery = list(r.row.gallery_urls, /\|/);
      for (let i = 0; i < gallery.length; i++) await importRemoteImage(product.id, gallery[i], "GALLERY", i);
    } catch (e) {
      result.failed++;
      result.errors.push({ line: r.line, name: r.row.name, error: e instanceof Error ? e.message : "Erreur inconnue" });
    }
  }

  await prisma.importJob.update({ where: { id: job.id }, data: { status: result.failed === rows.length && rows.length > 0 ? "FAILED" : "COMPLETED", created: result.created, updated: result.updated, failed: result.failed, errors: result.errors, finishedAt: new Date() } });
  return result;
}
