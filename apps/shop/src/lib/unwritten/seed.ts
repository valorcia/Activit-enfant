import type { Prisma, PrismaClient } from "@prisma/client";
import { STARTER_PRODUCTS } from "./catalog-content";
import { UNWRITTEN_SITE_ID, UNWRITTEN_SITE_SLUG, UNWRITTEN_STOREFRONT } from "./constants";
import { unwrittenConfigSchema } from "./config";
import { STARTER_DEFINITIONS } from "./questionnaire/definitions";
import { definitionSchema } from "./questionnaire/schema";

/**
 * Marque UNWRITTEN de départ, créée SEULEMENT SI ABSENTE (aucune donnée existante modifiée) :
 *  - univers PERSONALIZED, vitrine « unwritten », statut TEST, sans domaine (aperçu : /?site=unwritten) ;
 *  - trois collections, trois produits personnalisés, une version 1 active de chaque questionnaire.
 * Imports relatifs uniquement : exécuté par `prisma/seed.ts` (tsx) et par les tests.
 */
export async function seedUnwritten(db: PrismaClient, log: (msg: string) => void = () => undefined) {
  const audience = await db.audience.upsert({
    where: { slug: "unwritten-adultes" },
    create: { id: "aud-unwritten", slug: "unwritten-adultes", name: "UNWRITTEN — adultes", description: "Adultes qui offrent ou se font un livre personnalisé : couples, familles, amis, souvenirs.", color: "#171717" },
    update: {},
  });

  let site = await db.site.findUnique({ where: { slug: UNWRITTEN_SITE_SLUG } });
  if (!site) {
    site = await db.site.create({
      data: {
        id: UNWRITTEN_SITE_ID,
        slug: UNWRITTEN_SITE_SLUG,
        name: "UNWRITTEN",
        audienceId: audience.id,
        preset: "guide-expert",
        status: "TEST",
        domains: [],
        primaryDomain: null,
        isDefault: false,
        kind: "PERSONALIZED",
        storefront: UNWRITTEN_STOREFRONT,
        locales: ["en", "fr"],
        defaultLocale: "en",
        currencies: ["EUR"],
        settings: {
          brand: { name: "UNWRITTEN", tagline: "The book that hasn't been written yet.", logoUrl: null },
          seo: { robotsIndex: false },
          unwritten: unwrittenConfigSchema.parse({}),
        } as Prisma.InputJsonValue,
      },
    });
    log("Marque UNWRITTEN créée (statut TEST, aperçu : /?site=unwritten)");
  }

  for (const starter of STARTER_PRODUCTS) {
    const collection = await db.collection.upsert({
      where: { siteId_slug: { siteId: site.id, slug: starter.key } },
      create: { siteId: site.id, slug: starter.key, name: starter.content.en.name, description: starter.content.fr.collectionLead, position: starter.position },
      update: {},
    });
    const existing = await db.product.findUnique({ where: { slug: starter.slug }, select: { id: true, siteId: true } });
    if (existing) continue; // jamais d'écrasement : les réglages de l'admin priment
    const product = await db.product.create({
      data: {
        siteId: site.id,
        slug: starter.slug,
        name: starter.content.en.name,
        tagline: starter.content.en.tagline,
        shortDescription: starter.content.en.description,
        template: "CLASSIC",
        priceCents: starter.priceCents,
        currency: "EUR",
        pageCount: starter.pagesMax,
        fileFormat: "PDF",
        status: "PUBLISHED",
        publishedAt: new Date(),
        source: "seed",
        collections: { create: { collectionId: collection.id, position: 0 } },
        personalization: {
          create: {
            collectionKey: starter.key,
            content: starter.content as unknown as Prisma.InputJsonValue,
            prices: { EUR: starter.priceCents },
            pagesMin: starter.pagesMin,
            pagesMax: starter.pagesMax,
            formats: ["PDF"],
          },
        },
        questionnaires: {
          create: {
            version: 1,
            status: "ACTIVE",
            definition: definitionSchema.parse(STARTER_DEFINITIONS[starter.key]) as unknown as Prisma.InputJsonValue,
            note: "Définition de départ",
            createdBy: "seed",
            publishedAt: new Date(),
          },
        },
      },
    });
    log(`Produit UNWRITTEN créé : ${product.name}`);
  }
  return site;
}
