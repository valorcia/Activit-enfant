/**
 * Projet de démonstration : « Les Petits Inventeurs — 10 inventions extraordinaires ».
 * - 10 concepts d'activités.
 * - Activité pilote « Construis ta voiture propulsée par un ballon » entièrement rédigée
 *   (fiche, fiche de référence visuelle) ; ses illustrations sont générées par le worker
 *   (images de démonstration étiquetées tant qu'aucun fournisseur n'est configuré).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEMO_BOOK, DEMO_CONCEPTS, DEMO_COVER, PILOT_ACTIVITY, PILOT_VISUAL_REFERENCE } from "../src/lib/demo/petits-inventeurs";
import { BUILTIN_TEMPLATES } from "../src/lib/layout/themes";
import { slugify } from "../src/lib/utils";

const prisma = new PrismaClient();

async function main() {
  for (const t of BUILTIN_TEMPLATES) {
    await prisma.template.upsert({ where: { key: t.key }, create: { key: t.key, name: t.name, description: t.description, theme: t.theme, builtin: true }, update: { name: t.name, description: t.description, theme: t.theme } });
  }

  const existing = await prisma.book.findFirst({ where: { title: DEMO_BOOK.title } });
  if (existing) {
    console.log(`Le livre de démonstration existe déjà (${existing.id}).`);
    return;
  }

  const book = await prisma.book.create({
    data: {
      title: DEMO_BOOK.title,
      subtitle: DEMO_BOOK.subtitle,
      collection: DEMO_BOOK.collection,
      bookType: DEMO_BOOK.bookType,
      ageRange: DEMO_BOOK.ageRange,
      targetCount: 10,
      artStyle: DEMO_BOOK.artStyle,
      pageFormat: DEMO_BOOK.pageFormat,
      brief: DEMO_BOOK.brief,
      status: "PLANNED",
      theme: BUILTIN_TEMPLATES[0].theme,
      cover: { ...DEMO_COVER, introduction: DEMO_BOOK.introduction },
    },
  });

  for (let i = 0; i < DEMO_CONCEPTS.length; i++) {
    const c = DEMO_CONCEPTS[i];
    const activity = await prisma.activity.create({
      data: { slug: `${slugify(c.title)}-${book.id.slice(-4)}`, title: c.title, category: c.category, ageRange: DEMO_BOOK.ageRange, difficulty: c.difficulty, durationMinutes: c.durationMinutes, status: "CONCEPT", concept: c },
    });
    await prisma.bookActivity.create({ data: { bookId: book.id, activityId: activity.id, position: i } });
    if (i === 0) {
      const version = await prisma.activityVersion.create({ data: { activityId: activity.id, number: 1, content: PILOT_ACTIVITY, source: "seed", note: "Fiche pilote rédigée à la main" } });
      await prisma.activity.update({ where: { id: activity.id }, data: { currentVersionId: version.id, status: "REVIEW", tags: PILOT_ACTIVITY.tags } });
      await prisma.visualReference.create({ data: { activityId: activity.id, data: PILOT_VISUAL_REFERENCE } });
      console.log(`Activité pilote créée : ${activity.id}`);
    }
  }
  console.log(`Livre de démonstration créé : ${book.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
