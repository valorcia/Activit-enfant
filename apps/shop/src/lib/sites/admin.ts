import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { cleanDomain, normalizeDomainList, normalizeHost } from "./host";
import { getPreset, PRESET_IDS } from "./presets";

const slugSchema = z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, "Slug invalide (lettres minuscules, chiffres, tirets)");

export const siteInputSchema = z.object({
  name: z.string().min(2, "Nom requis").max(80),
  slug: slugSchema,
  audienceId: z.string().min(1, "Audience requise"),
  preset: z.enum(PRESET_IDS).default("kit-enfants"),
  status: z.enum(["ACTIVE", "TEST", "ARCHIVED"]).default("TEST"),
  /** Domaines séparés par des virgules, espaces ou retours à la ligne. */
  domains: z.union([z.string(), z.array(z.string())]).optional().default([]),
  primaryDomain: z.string().max(253).optional().nullable(),
  isDefault: z.coerce.boolean().optional().default(false),
});
export type SiteInput = z.input<typeof siteInputSchema>;

export const audienceInputSchema = z.object({
  name: z.string().min(2, "Nom requis").max(80),
  slug: slugSchema,
  description: z.string().max(400).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue").optional().nullable().or(z.literal("")),
});
export type AudienceInput = z.input<typeof audienceInputSchema>;

export class SiteAdminError extends Error {
  constructor(message: string, public field?: string) { super(message); }
}

function parseDomains(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/[\s,;]+/);
  return normalizeDomainList(list);
}

async function checkSite(db: PrismaClient, id: string | null, input: z.output<typeof siteInputSchema>) {
  const domains = parseDomains(input.domains);
  const invalid = domains.find((d) => !/^[a-z0-9.-]+\.[a-z0-9-]{2,}$/.test(d));
  if (invalid) throw new SiteAdminError(`Domaine invalide : ${invalid}`, "domains");
  // Domaine principal : tel que saisi (www. conservé, c'est l'URL canonique) ; la liste couvre www et apex
  const primary = input.primaryDomain ? cleanDomain(input.primaryDomain) || null : domains[0] ?? null;
  if (primary && !domains.includes(normalizeHost(primary))) domains.unshift(normalizeHost(primary));
  const slugClash = await db.site.findFirst({ where: { slug: input.slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (slugClash) throw new SiteAdminError("Ce slug est déjà utilisé par un autre univers", "slug");
  if (domains.length) {
    const others = await db.site.findMany({ where: { ...(id ? { id: { not: id } } : {}), domains: { hasSome: domains } }, select: { name: true, domains: true } });
    const taken = others.flatMap((o) => o.domains.filter((d) => domains.includes(d)).map((d) => `${d} (${o.name})`));
    if (taken.length) throw new SiteAdminError(`Domaine déjà rattaché à un autre univers : ${taken.join(", ")}`, "domains");
  }
  if (!(await db.audience.findUnique({ where: { id: input.audienceId }, select: { id: true } }))) throw new SiteAdminError("Audience inconnue", "audienceId");
  return { domains, primaryDomain: primary };
}

/** Crée un univers et ses catégories de départ (selon le préréglage). */
export async function createSite(db: PrismaClient, raw: unknown) {
  const input = siteInputSchema.parse(raw);
  const { domains, primaryDomain } = await checkSite(db, null, input);
  const preset = getPreset(input.preset);
  return db.$transaction(async (tx) => {
    if (input.isDefault) await tx.site.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    const site = await tx.site.create({
      data: { name: input.name, slug: input.slug, audienceId: input.audienceId, preset: input.preset, status: input.isDefault ? "ACTIVE" : input.status, domains, primaryDomain, isDefault: input.isDefault, settings: {} },
    });
    for (const [position, c] of preset.starterCategories.entries()) {
      await tx.category.create({ data: { siteId: site.id, slug: c.slug, name: c.name, description: c.description, color: c.color, icon: c.icon, position } });
    }
    return site;
  });
}

export async function updateSite(db: PrismaClient, id: string, raw: unknown) {
  const input = siteInputSchema.parse(raw);
  const current = await db.site.findUnique({ where: { id }, select: { isDefault: true } });
  if (!current) throw new SiteAdminError("Univers introuvable");
  if (current.isDefault && !input.isDefault) throw new SiteAdminError("Désignez un autre univers par défaut plutôt que de retirer celui-ci", "isDefault");
  if ((current.isDefault || input.isDefault) && input.status === "ARCHIVED") throw new SiteAdminError("L'univers par défaut ne peut pas être archivé", "status");
  const { domains, primaryDomain } = await checkSite(db, id, input);
  return db.$transaction(async (tx) => {
    if (input.isDefault && !current.isDefault) await tx.site.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    return tx.site.update({ where: { id }, data: { name: input.name, slug: input.slug, audienceId: input.audienceId, preset: input.preset, status: input.status, domains, primaryDomain, isDefault: input.isDefault } });
  });
}

/**
 * Supprime un univers sans produits ni commandes (univers de test) avec ses catégories,
 * collections, pages, articles, abonnés et campagnes. Sinon : archivez-le.
 */
export async function deleteSite(db: PrismaClient, id: string) {
  const site = await db.site.findUnique({ where: { id }, select: { isDefault: true, _count: { select: { products: true, orders: true, bundles: true } } } });
  if (!site) throw new SiteAdminError("Univers introuvable");
  if (site.isDefault) throw new SiteAdminError("L'univers par défaut ne peut pas être supprimé");
  if (site._count.products || site._count.orders || site._count.bundles) throw new SiteAdminError("Cet univers contient des produits, packs ou commandes : archivez-le plutôt que de le supprimer");
  await db.$transaction([
    db.category.updateMany({ where: { siteId: id }, data: { parentId: null } }),
    db.category.deleteMany({ where: { siteId: id } }),
    db.collection.deleteMany({ where: { siteId: id } }),
    db.staticPage.deleteMany({ where: { siteId: id } }),
    db.blogPost.deleteMany({ where: { siteId: id } }),
    db.newsletterSubscriber.deleteMany({ where: { siteId: id } }),
    db.campaign.deleteMany({ where: { siteId: id } }),
    db.site.delete({ where: { id } }),
  ]);
}

export async function saveAudience(db: PrismaClient, id: string | null, raw: unknown) {
  const input = audienceInputSchema.parse(raw);
  const clash = await db.audience.findFirst({ where: { slug: input.slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) throw new SiteAdminError("Ce slug est déjà utilisé par une autre audience", "slug");
  const data = { name: input.name, slug: input.slug, description: input.description || null, color: input.color || null };
  return id ? db.audience.update({ where: { id }, data }) : db.audience.create({ data });
}
