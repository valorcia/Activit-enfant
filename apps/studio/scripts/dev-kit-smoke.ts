/**
 * DÉVELOPPEMENT — fumée du pipeline kit en mode démonstration (mock) sans worker :
 * crée un kit, génère contenu + illustrations + couverture, assemble les pages.
 * Usage : pnpm tsx scripts/dev-kit-smoke.ts [chasse-au-tresor|lutins-farceurs]
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { handlers } from "../src/worker/handlers";
import { QUEUES } from "../src/lib/queue/boss";
import { saveAiSettings, getAiSettings } from "../src/lib/settings";
import { kitType } from "../src/lib/kits/types";

async function main() {
  const key = process.argv[2] ?? "chasse-au-tresor";
  const def = kitType(key);
  const ai = await getAiSettings();
  await saveAiSettings({ ...ai, mode: "api", textProvider: "mock", imageProvider: "mock" });
  const book = await prisma.book.create({
    data: { title: `[TEST] ${def.label}`, bookType: key, kitType: key, ageRange: def.defaultAge, targetCount: key === "lutins-farceurs" ? 6 : 4, artStyle: "aquarelle", customization: { universe: def.defaultUniverse ?? "Dinosaures", heroName: key === "lutins-farceurs" ? "Pompon" : "Professeure Fossile", companion: key === "lutins-farceurs" ? "Guimauve" : "Pépite, bébé tricératops", count: key === "lutins-farceurs" ? 6 : 4 } },
  });
  const job = await prisma.job.create({ data: { type: QUEUES.bookPipeline, status: "QUEUED", bookId: book.id } });
  await handlers[QUEUES.bookPipeline]({ jobId: job.id, bookId: book.id, withIllustrations: true, withCover: true });
  const j = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
  const pages = await prisma.bookPage.findMany({ where: { bookId: book.id }, orderBy: { position: "asc" }, select: { templateKey: true } });
  const ills = await prisma.illustration.count({ where: { bookId: book.id, kind: "KIT" } });
  console.log(JSON.stringify({ bookId: book.id, job: j.status, step: j.step, error: j.error, illustrations: ills, pages: pages.map((p) => p.templateKey) }));
  await saveAiSettings(ai);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
