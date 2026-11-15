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
    const existing = await tx.bookPage.findMany({ where: { bookId }, select: { id: true, position: true, layout: true, locked: true, templateKey: true } });
    const keep = new Set(data.map((p) => p.id));
    await tx.bookPage.deleteMany({ where: { bookId, id: { notIn: [...keep] } } });
    const byId = new Map(existing.map((e) => [e.id, e]));
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      const old = byId.get(p.id);
      if (old) {
        // Seules les pages modifiées (contenu, ordre, verrou) sont réécrites : un livre de 100 pages s'enregistre vite
        const same = old.position === i && old.locked === p.locked && old.templateKey === p.templateKey && JSON.stringify(old.layout) === JSON.stringify(p.layout);
        if (!same) await tx.bookPage.update({ where: { id: p.id }, data: { position: i, layout: p.layout, locked: p.locked, templateKey: p.templateKey } });
      } else await tx.bookPage.create({ data: { id: p.id, bookId, position: i, layout: p.layout, locked: p.locked, templateKey: p.templateKey, activityId: p.activityId ?? undefined } });
    }
    await tx.book.update({ where: { id: bookId }, data: { version: { increment: 1 } } });
  });
  revalidatePath(`/books/${bookId}`);
}

/**
 * Correction d'un texte qui déborde depuis l'aperçu, en un clic :
 * - « grow » : agrandit le cadre de `growMm` (sans dépasser le bas de la page, marge comprise) ;
 * - « accept » : valide le bloc tel quel (plus d'alerte).
 */
export async function fixTextOverflowAction(bookId: string, pageId: string, blockId: string, mode: "grow" | "accept", growMm = 0): Promise<{ ok: true; grown: number } | { ok: false; error: string }> {
  const page = await prisma.bookPage.findFirst({ where: { id: pageId, bookId } });
  if (!page) return { ok: false, error: "Page introuvable" };
  const layout = PageLayoutSchema.parse(page.layout);
  const block = layout.blocks.find((b) => b.id === blockId) as (typeof layout.blocks)[number] & { style?: Record<string, unknown> } | undefined;
  if (!block) return { ok: false, error: "Bloc introuvable" };
  let grown = 0;
  if (mode === "grow") {
    const ctx = await buildContextForBook(bookId);
    const limit = layout.heightMm - ctx.theme.marginMm - 6;
    grown = Math.max(0, Math.min(Math.ceil(growMm + 1), limit - (block.y + block.h)));
    if (grown <= 0) return { ok: false, error: "Pas de place sous ce cadre : raccourcissez le texte ou validez-le tel quel." };
    block.h += grown;
  } else {
    block.style = { ...(block.style ?? {}), overflowOk: true };
  }
  await prisma.bookPage.update({ where: { id: page.id }, data: { layout: PageLayoutSchema.parse(layout) } });
  revalidatePath(`/books/${bookId}`);
  revalidatePath(`/books/${bookId}/apercu`);
  return { ok: true, grown };
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
