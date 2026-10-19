import { prisma } from "../db";
import { getAiSettings } from "../settings";
import { getTextProvider, effectiveTextModel } from "../ai/registry";
import { generateStructured, contextBlock } from "../ai/structured";
import { CoverDataSchema, ageRangeLabel, type CoverData } from "../schemas/activity";
import { SYSTEM_EDITOR, coverPrompt } from "./prompts";

export async function generateCoverTexts(bookId: string, opts?: { jobId?: string }) {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId }, include: { activities: { include: { activity: true }, orderBy: { position: "asc" } } } });
  const settings = await getAiSettings();
  const provider = getTextProvider(settings);
  const titles = book.activities.map((a) => a.activity.title);
  const prompt =
    coverPrompt({ title: book.title, subtitle: book.subtitle ?? undefined, ageRange: book.ageRange, count: titles.length, activityTitles: titles, collection: book.collection ?? undefined, bookType: book.bookType }) +
    "\n\n" +
    contextBlock("cover", { title: book.title, subtitle: book.subtitle ?? "", collection: book.collection ?? "", ageLabel: ageRangeLabel(book.ageRange), count: titles.length });
  const res = await generateStructured({ provider, model: effectiveTextModel(settings), schema: CoverDataSchema, system: SYSTEM_EDITOR, prompt, purpose: "cover", bookId, jobId: opts?.jobId });
  const existing = (book.cover ?? {}) as Partial<CoverData> & { introduction?: string };
  const cover: CoverData & { introduction?: string } = { ...res.data, introduction: existing.introduction, illustrationId: existing.illustrationId };
  await prisma.book.update({ where: { id: bookId }, data: { cover } });
  return { cover, usage: res.usage };
}

export async function getCover(bookId: string): Promise<CoverData & { introduction?: string }> {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const raw = (book.cover ?? {}) as Partial<CoverData> & { introduction?: string };
  const parsed = CoverDataSchema.safeParse({ title: book.title, subtitle: book.subtitle ?? "", collection: book.collection ?? "", ageLabel: ageRangeLabel(book.ageRange), ...raw });
  const base = parsed.success ? parsed.data : CoverDataSchema.parse({ title: book.title });
  return { ...base, introduction: raw.introduction };
}
