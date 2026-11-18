import type { Prisma, PrismaClient } from "@prisma/client";
import { STARTER_CONTENT_VERSION, STARTER_PRODUCTS } from "./catalog-content";
import { UNWRITTEN_SITE_ID, UNWRITTEN_SITE_SLUG, UNWRITTEN_STOREFRONT } from "./constants";
import { unwrittenConfigSchema } from "./config";
import { STARTER_DEFINITIONS, STARTER_DEFINITIONS_VERSION } from "./questionnaire/definitions";
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
    if (existing) {
      // Jamais d'écrasement des réglages de l'admin : mise à niveau des seuls éléments créés par le seed
      if (existing.siteId === site.id) await upgradeStarter(db, existing.id, starter, log);
      continue;
    }
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
            content: { ...starter.content, contentVersion: STARTER_CONTENT_VERSION } as unknown as Prisma.InputJsonValue,
            prices: { EUR: starter.priceCents },
            pagesMin: starter.pagesMin,
            pagesMax: starter.pagesMax,
            formats: ["PDF"],
          },
        },
        questionnaires: {
          create: {
            version: STARTER_DEFINITIONS_VERSION,
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

/**
 * Mise à niveau d'un produit de départ déjà en base (idempotente) :
 *  - questionnaire : si la version active est une version du seed plus ancienne et qu'aucune version
 *    plus récente n'existe, la nouvelle version est publiée et l'ancienne archivée. Les brouillons
 *    déjà commencés gardent leur version (ils y sont rattachés) ;
 *  - textes et nombre de pages : mis à jour seulement si le produit n'a jamais été modifié dans
 *    l'admin (date de modification identique à la création) et que la version des textes augmente.
 */
async function upgradeStarter(db: PrismaClient, productId: string, starter: (typeof STARTER_PRODUCTS)[number], log: (m: string) => void) {
  const versions = await db.questionnaire.findMany({ where: { productId }, select: { id: true, version: true, status: true, createdBy: true }, orderBy: { version: "desc" } });
  const latest = versions[0];
  if (latest && latest.version < STARTER_DEFINITIONS_VERSION && latest.status === "ACTIVE" && latest.createdBy === "seed") {
    await db.$transaction([
      db.questionnaire.update({ where: { id: latest.id }, data: { status: "ARCHIVED" } }),
      db.questionnaire.create({
        data: {
          productId,
          version: STARTER_DEFINITIONS_VERSION,
          status: "ACTIVE",
          definition: definitionSchema.parse(STARTER_DEFINITIONS[starter.key]) as unknown as Prisma.InputJsonValue,
          note: "Version 2 : questionnaire organisé par chapitre, avec photos",
          createdBy: "seed",
          publishedAt: new Date(),
        },
      }),
    ]);
    log(`Questionnaire UNWRITTEN mis à niveau (v${STARTER_DEFINITIONS_VERSION}) : ${starter.content.en.name}`);
  }
  const perso = await db.personalizedProduct.findUnique({ where: { productId }, select: { content: true, createdAt: true, updatedAt: true } });
  const current = (perso?.content ?? {}) as { contentVersion?: number; seededAt?: string };
  // « Jamais modifié dans l'admin » : dernière écriture = celle du seed (création ou mise à niveau précédente)
  const seededAt = current.seededAt ? new Date(current.seededAt).getTime() : perso?.createdAt.getTime() ?? 0;
  const untouched = perso && Math.abs(perso.updatedAt.getTime() - seededAt) < 5_000;
  if (perso && untouched && (current.contentVersion ?? 1) < STARTER_CONTENT_VERSION) {
    await db.personalizedProduct.update({
      where: { productId },
      data: { content: { ...starter.content, contentVersion: STARTER_CONTENT_VERSION, seededAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue, pagesMin: starter.pagesMin, pagesMax: starter.pagesMax },
    });
    await db.product.update({ where: { id: productId }, data: { pageCount: starter.pagesMax } });
    log(`Textes UNWRITTEN mis à jour : ${starter.content.en.name}`);
  }
}
