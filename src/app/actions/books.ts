"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { enqueue, pauseJob, resumeJob, cancelJob, retryJob, QUEUES } from "@/lib/queue/jobs";
import { AGE_RANGES, ART_STYLES, BOOK_TYPES, PAGE_FORMATS, ActivityConceptSchema, CoverDataSchema } from "@/lib/schemas/activity";
import { BookThemeSchema } from "@/lib/schemas/layout";
import { defaultThemeForBook } from "@/lib/layout/themes";
import { uniqueSlug } from "@/lib/generation/outline";
import { createExport } from "@/lib/export";
import { rebuildBookPages } from "@/lib/layout/book";
import type { ExportKind } from "@prisma/client";

const CreateBookSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(140).optional(),
  collection: z.string().max(60).optional(),
  bookType: z.enum(BOOK_TYPES.map((t) => t.key) as [string, ...string[]]),
  ageRange: z.enum(AGE_RANGES),
  targetCount: z.number().int().min(1).max(365),
  artStyle: z.enum(ART_STYLES.map((s) => s.key) as [string, ...string[]]),
  pageFormat: z.enum(Object.keys(PAGE_FORMATS) as [string, ...string[]]),
  customWidthMm: z.number().int().min(80).max(500).optional(),
  customHeightMm: z.number().int().min(80).max(500).optional(),
  brief: z.string().max(2000).optional(),
});

export async function createBook(input: z.infer<typeof CreateBookSchema>) {
  const data = CreateBookSchema.parse(input);
  const book = await prisma.book.create({
    data: { ...data, theme: defaultThemeForBook(data.bookType, data.ageRange), status: "DRAFT", cover: { introduction: "" } },
  });
  const job = await enqueue(QUEUES.bookOutline, { bookId: book.id });
  revalidatePath("/books");
  return { bookId: book.id, jobId: job.id };
}

export async function regenerateOutline(bookId: string) {
  const job = await enqueue(QUEUES.bookOutline, { bookId });
  return { jobId: job.id };
}

const ConceptPatch = ActivityConceptSchema.partial().extend({ title: z.string().min(3).max(90) });

export async function updateConcept(activityId: string, patch: z.infer<typeof ConceptPatch>) {
  const a = await prisma.activity.findUniqueOrThrow({ where: { id: activityId } });
  const concept = { ...((a.concept as object) ?? {}), ...ConceptPatch.parse(patch) };
  await prisma.activity.update({ where: { id: activityId }, data: { title: patch.title, concept, difficulty: patch.difficulty ?? a.difficulty, durationMinutes: patch.durationMinutes ?? a.durationMinutes } });
  revalidatePath(`/books`);
}

export async function addConceptToBook(bookId: string, concept: z.infer<typeof ActivityConceptSchema>) {
  const data = ActivityConceptSchema.parse(concept);
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const count = await prisma.bookActivity.count({ where: { bookId } });
  const activity = await prisma.activity.create({
    data: { slug: await uniqueSlug(prisma, data.title), title: data.title, category: data.category, ageRange: book.ageRange, difficulty: data.difficulty, durationMinutes: data.durationMinutes, status: "CONCEPT", concept: data },
  });
  await prisma.bookActivity.create({ data: { bookId, activityId: activity.id, position: count } });
  revalidatePath(`/books/${bookId}`);
  return activity.id;
}

export async function addLibraryActivityToBook(bookId: string, activityId: string) {
  const count = await prisma.bookActivity.count({ where: { bookId } });
  await prisma.bookActivity.upsert({ where: { bookId_activityId: { bookId, activityId } }, create: { bookId, activityId, position: count }, update: {} });
  revalidatePath(`/books/${bookId}`);
}

export async function removeActivityFromBook(bookId: string, activityId: string, deleteConcept = false) {
  await prisma.bookActivity.deleteMany({ where: { bookId, activityId } });
  if (deleteConcept) {
    const a = await prisma.activity.findUnique({ where: { id: activityId } });
    if (a?.status === "CONCEPT") await prisma.activity.delete({ where: { id: activityId } });
  }
  await normalizePositions(bookId);
  revalidatePath(`/books/${bookId}`);
}

export async function reorderBookActivities(bookId: string, orderedActivityIds: string[]) {
  await prisma.$transaction(orderedActivityIds.map((activityId, i) => prisma.bookActivity.updateMany({ where: { bookId, activityId }, data: { position: i } })));
  revalidatePath(`/books/${bookId}`);
}

async function normalizePositions(bookId: string) {
  const links = await prisma.bookActivity.findMany({ where: { bookId }, orderBy: { position: "asc" } });
  await prisma.$transaction(links.map((l, i) => prisma.bookActivity.update({ where: { id: l.id }, data: { position: i } })));
}

export async function validateOutline(bookId: string) {
  await prisma.book.update({ where: { id: bookId }, data: { status: "PLANNED" } });
  revalidatePath(`/books/${bookId}`);
}

export async function startPipeline(bookId: string, opts: { withIllustrations: boolean; withCover: boolean }) {
  const running = await prisma.job.findFirst({ where: { bookId, type: QUEUES.bookPipeline, status: { in: ["QUEUED", "RUNNING", "PAUSED"] } } });
  if (running) return { jobId: running.id, alreadyRunning: true };
  const job = await enqueue(QUEUES.bookPipeline, { bookId, ...opts });
  await prisma.book.update({ where: { id: bookId }, data: { status: "GENERATING" } });
  revalidatePath(`/books/${bookId}`);
  return { jobId: job.id, alreadyRunning: false };
}

export async function jobAction(jobId: string, action: "pause" | "resume" | "cancel" | "retry") {
  if (action === "pause") await pauseJob(jobId);
  if (action === "resume") await resumeJob(jobId);
  if (action === "cancel") await cancelJob(jobId);
  if (action === "retry") await retryJob(jobId);
  revalidatePath("/jobs");
  revalidatePath("/books");
}

export async function rebuildLayout(bookId: string, force = false) {
  const pages = await rebuildBookPages(bookId, { force });
  revalidatePath(`/books/${bookId}`);
  return pages.length;
}

export async function queueLayout(bookId: string, force = false) {
  const job = await enqueue(QUEUES.bookLayout, { bookId, force });
  return { jobId: job.id };
}

export async function generateCover(bookId: string, variants = 2) {
  const job = await enqueue(QUEUES.bookCover, { bookId, variants });
  return { jobId: job.id };
}

export async function regenerateCoverIllustration(bookId: string, variant: number) {
  const job = await enqueue(QUEUES.illustrationSingle, { bookId, kind: "COVER", coverVariant: variant });
  return { jobId: job.id };
}

export async function saveCover(bookId: string, cover: unknown) {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const existing = (book.cover ?? {}) as Record<string, unknown>;
  const parsed = CoverDataSchema.parse(cover);
  await prisma.book.update({ where: { id: bookId }, data: { cover: { ...existing, ...parsed }, title: parsed.title, subtitle: parsed.subtitle || null } });
  revalidatePath(`/books/${bookId}`);
}

export async function saveBookTheme(bookId: string, theme: unknown) {
  const data = BookThemeSchema.parse(theme);
  await prisma.book.update({ where: { id: bookId }, data: { theme: data } });
  revalidatePath(`/books/${bookId}`);
}

export async function updateBookMeta(bookId: string, patch: { title?: string; subtitle?: string; collection?: string; introduction?: string; status?: "READY" | "REVIEW" | "ARCHIVED" }) {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const cover = (book.cover ?? {}) as Record<string, unknown>;
  await prisma.book.update({
    where: { id: bookId },
    data: {
      title: patch.title ?? undefined,
      subtitle: patch.subtitle ?? undefined,
      collection: patch.collection ?? undefined,
      status: patch.status ?? undefined,
      cover: patch.introduction !== undefined ? { ...cover, introduction: patch.introduction } : undefined,
    },
  });
  revalidatePath(`/books/${bookId}`);
}

/** Marque le livre prêt : exige que toutes ses activités soient validées. */
export async function markBookReady(bookId: string) {
  const notValidated = await prisma.bookActivity.count({ where: { bookId, activity: { status: { not: "VALIDATED" } } } });
  if (notValidated > 0) throw new Error(`${notValidated} activité(s) ne sont pas encore validées.`);
  await prisma.book.update({ where: { id: bookId }, data: { status: "READY" } });
  revalidatePath(`/books/${bookId}`);
}

export async function requestExport(o: { kind: ExportKind; bookId?: string; activityId?: string; label?: string }) {
  const exp = await createExport(o);
  const job = await enqueue(QUEUES.bookExport, { bookId: o.bookId, activityId: o.activityId, exportId: exp.id });
  revalidatePath("/exports");
  return { exportId: exp.id, jobId: job.id };
}

export async function deleteBook(bookId: string) {
  await prisma.book.delete({ where: { id: bookId } });
  revalidatePath("/books");
}
