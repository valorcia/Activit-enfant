import { prisma } from "../db";
import { buildContextForBook } from "../layout/book";
import { PageLayoutSchema, type BookTheme, type PageLayout } from "../schemas/layout";

export interface BookThumbData {
  theme: BookTheme;
  widthMm: number;
  heightMm: number;
  pages: PageLayout[];
}

/** Couverture + 3 premières pages de chaque livre (vignettes de la liste et de l'accueil). */
export async function firstPagesFor(bookIds: string[], count = 4): Promise<Record<string, BookThumbData>> {
  const out: Record<string, BookThumbData> = {};
  if (!bookIds.length) return out;
  const rows = await prisma.bookPage.findMany({ where: { bookId: { in: bookIds } }, orderBy: [{ bookId: "asc" }, { position: "asc" }], select: { bookId: true, layout: true, position: true } });
  const byBook = new Map<string, PageLayout[]>();
  for (const r of rows) {
    const list = byBook.get(r.bookId) ?? [];
    if (list.length >= count) continue;
    const l = PageLayoutSchema.safeParse(r.layout);
    if (l.success) list.push(l.data);
    byBook.set(r.bookId, list);
  }
  for (const [bookId, pages] of byBook) {
    const ctx = await buildContextForBook(bookId).catch(() => null);
    if (ctx) out[bookId] = { theme: ctx.theme, widthMm: ctx.widthMm, heightMm: ctx.heightMm, pages };
  }
  return out;
}
