"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PageLayoutSchema } from "@/lib/schemas/layout";
import { buildContextForBook } from "@/lib/layout/book";
import { buildBlankPage, buildDiplomaPage, buildConclusionPage, buildIntroPage } from "@/lib/layout/engine";

const PagesPayload = z.array(z.object({ id: z.string(), templateKey: z.string(), layout: PageLayoutSchema, locked: z.boolean(), activityId: z.string().nullable().optional() }));

/** Sauvegarde complète des pages depuis l'éditeur (ordre, contenu, pages ajoutées/supprimées). */
export async function savePages(bookId: string, pages: unknown) {
  const data = PagesPayload.parse(pages);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.bookPage.findMany({ where: { bookId }, select: { id: true } });
    const keep = new Set(data.map((p) => p.id));
    await tx.bookPage.deleteMany({ where: { bookId, id: { notIn: [...keep] } } });
    const existingIds = new Set(existing.map((e) => e.id));
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      if (existingIds.has(p.id)) await tx.bookPage.update({ where: { id: p.id }, data: { position: i, layout: p.layout, locked: p.locked, templateKey: p.templateKey } });
      else await tx.bookPage.create({ data: { id: p.id, bookId, position: i, layout: p.layout, locked: p.locked, templateKey: p.templateKey, activityId: p.activityId ?? undefined } });
    }
    await tx.book.update({ where: { id: bookId }, data: { version: { increment: 1 } } });
  });
  revalidatePath(`/books/${bookId}`);
}

/** Fabrique une nouvelle page depuis un modèle (sans l'enregistrer : l'éditeur l'ajoute à son état). */
export async function newPageFromTemplate(bookId: string, templateKey: string) {
  const ctx = await buildContextForBook(bookId);
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const cover = (book.cover ?? {}) as { introduction?: string };
  const page =
    templateKey === "diploma" ? buildDiplomaPage(book.title, ctx) : templateKey === "conclusion" ? buildConclusionPage(ctx, 1) : templateKey === "intro" ? buildIntroPage(book.title, cover.introduction ?? "", ctx) : buildBlankPage(ctx);
  return { templateKey: page.templateKey, layout: page.layout };
}
