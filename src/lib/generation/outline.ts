import { prisma } from "../db";
import { getAiSettings } from "../settings";
import { getTextProvider, effectiveTextModel } from "../ai/registry";
import { generateStructured, contextBlock } from "../ai/structured";
import { BookOutlineSchema, BOOK_TYPES, type BookOutline } from "../schemas/activity";
import { SYSTEM_EDITOR, outlinePrompt } from "./prompts";
import { slugify } from "../utils";

export async function generateOutline(bookId: string, opts?: { jobId?: string }): Promise<BookOutline> {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const settings = await getAiSettings();
  const provider = getTextProvider(settings);
  const category = BOOK_TYPES.find((t) => t.key === book.bookType)?.category ?? book.bookType;
  const existing = await prisma.activity.findMany({ where: { status: { in: ["VALIDATED", "REVIEW"] } }, select: { title: true }, take: 100 });

  const prompt =
    outlinePrompt({ bookType: book.bookType, category, ageRange: book.ageRange, count: book.targetCount, brief: book.brief ?? undefined, artStyle: book.artStyle, existingTitles: existing.map((e) => e.title) }) +
    "\n\n" +
    contextBlock("outline", { title: book.title, subtitle: book.subtitle, count: book.targetCount, category, ageRange: book.ageRange });

  const res = await generateStructured({ provider, model: effectiveTextModel(settings), schema: BookOutlineSchema, system: SYSTEM_EDITOR, prompt, purpose: "outline", bookId, jobId: opts?.jobId, maxTokens: 20000 });
  const outline = res.data;

  // Enregistre les concepts comme activités CONCEPT rattachées au livre
  await prisma.$transaction(async (tx) => {
    await tx.bookActivity.deleteMany({ where: { bookId, activity: { status: "CONCEPT" } } });
    const kept = await tx.bookActivity.count({ where: { bookId } });
    for (let i = 0; i < outline.activities.length; i++) {
      const c = outline.activities[i];
      const activity = await tx.activity.create({
        data: {
          slug: await uniqueSlug(tx, c.title),
          title: c.title,
          category: c.category,
          ageRange: book.ageRange,
          difficulty: c.difficulty,
          durationMinutes: c.durationMinutes,
          status: "CONCEPT",
          concept: c,
        },
      });
      await tx.bookActivity.create({ data: { bookId, activityId: activity.id, position: kept + i } });
    }
    await tx.book.update({
      where: { id: bookId },
      data: {
        title: book.title || outline.title,
        subtitle: book.subtitle || outline.subtitle || null,
        status: "PLANNED",
        theme: book.theme ?? undefined,
        cover: { ...(book.cover as object | null), introduction: outline.introduction },
      },
    });
  });
  return outline;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export async function uniqueSlug(tx: Tx | typeof prisma, title: string) {
  const base = slugify(title) || "activite";
  let slug = base;
  let n = 2;
  while (await tx.activity.findUnique({ where: { slug } })) slug = `${base}-${n++}`;
  return slug;
}
