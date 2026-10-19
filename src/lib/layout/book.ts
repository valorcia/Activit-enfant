import { prisma } from "../db";
import { ActivityContentSchema } from "../schemas/activity";
import { PageLayoutSchema } from "../schemas/layout";
import { assetUrl } from "../storage";
import { pageSize } from "./formats";
import { themeFor, defaultThemeForBook } from "./themes";
import { getCover } from "../generation/cover";
import { buildActivityPages, buildBackCoverPage, buildConclusionPage, buildCoverPage, buildDiplomaPage, buildIntroPage, buildTocPages, TOC_PER_PAGE, type BuildContext, type BuiltPage, type IllustrationRef } from "./engine";

export async function buildContextForBook(bookId: string): Promise<BuildContext> {
  const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
  const size = pageSize(book.pageFormat, book.customWidthMm, book.customHeightMm);
  const theme = book.theme ? themeFor(book.theme) : defaultThemeForBook(book.bookType, book.ageRange);
  return { ...size, theme };
}

export async function illustrationRefs(activityId: string): Promise<IllustrationRef[]> {
  const ills = await prisma.illustration.findMany({ where: { activityId, isCurrent: true, status: { not: "REJECTED" } } });
  return ills.map((i) => ({ id: i.id, kind: i.kind, stepIndex: i.stepIndex, src: assetUrl(i.assetId), isDemo: i.isDemo, status: i.status }));
}

/**
 * Reconstruit toutes les pages d'un livre à partir des activités.
 * Les groupes de pages verrouillés (édités manuellement) sont conservés tels quels,
 * sauf si `force` est vrai.
 */
export async function rebuildBookPages(bookId: string, opts?: { force?: boolean; includeDiploma?: boolean }) {
  const book = await prisma.book.findUniqueOrThrow({
    where: { id: bookId },
    include: { activities: { include: { activity: { include: { currentVersion: true } } }, orderBy: { position: "asc" } }, pages: { orderBy: { position: "asc" } } },
  });
  const ctx = await buildContextForBook(bookId);
  const cover = await getCover(bookId);
  const coverIll = await prisma.illustration.findFirst({ where: { bookId, kind: "COVER", isCurrent: true, status: { not: "REJECTED" } } });

  // Activités avec fiche rédigée uniquement (jamais de page pour un simple concept)
  const ready = book.activities.filter((ba) => ba.activity.currentVersion && ba.activity.status !== "ARCHIVED");

  // Groupes verrouillés existants
  const lockedGroups = new Set(book.pages.filter((p) => p.locked).map((p) => p.activityId ?? `__${p.templateKey}`));
  const existingByGroup = new Map<string, typeof book.pages>();
  for (const p of book.pages) {
    const key = p.activityId ?? `__${p.templateKey}`;
    if (!existingByGroup.has(key)) existingByGroup.set(key, []);
    existingByGroup.get(key)!.push(p);
  }

  type Group = { key: string; pages: BuiltPage[]; activityId?: string; keepExisting?: typeof book.pages };
  const groups: Group[] = [];

  const useExisting = (key: string) => !opts?.force && lockedGroups.has(key) && existingByGroup.has(key);

  groups.push(useExisting("__cover") ? { key: "__cover", pages: [], keepExisting: existingByGroup.get("__cover") } : { key: "__cover", pages: [buildCoverPage(cover, ctx, coverIll ? { id: coverIll.id, kind: "COVER", stepIndex: null, src: assetUrl(coverIll.assetId), isDemo: coverIll.isDemo, status: coverIll.status } : undefined)] });

  const tocPageCount = Math.max(1, Math.ceil(ready.length / TOC_PER_PAGE));
  const introPage = buildIntroPage(book.title, cover.introduction ?? "", ctx);
  // Numérotation : couverture = 0 (non numérotée), intro = 1, sommaire = 2.., activités ensuite
  let pageNo = 1 + 1 + tocPageCount; // première page d'activité
  const tocEntries: { number: number; title: string; page: number }[] = [];
  const activityGroups: Group[] = [];
  ready.forEach((ba, idx) => {
    const content = ActivityContentSchema.safeParse(ba.activity.currentVersion!.content);
    if (!content.success) return;
    const key = ba.activityId;
    tocEntries.push({ number: idx + 1, title: content.data.title, page: pageNo });
    if (useExisting(key)) {
      const ex = existingByGroup.get(key)!;
      activityGroups.push({ key, pages: [], activityId: key, keepExisting: ex });
      pageNo += ex.length;
    } else {
      const pages = buildActivityPages({ content: content.data, illustrations: [], ctx, activityNumber: idx + 1, activityId: key });
      activityGroups.push({ key, pages, activityId: key });
      pageNo += pages.length;
    }
  });
  // Les illustrations sont injectées après (requêtes async)
  for (const g of activityGroups) {
    if (g.keepExisting) continue;
    const ba = ready.find((b) => b.activityId === g.activityId)!;
    const content = ActivityContentSchema.parse(ba.activity.currentVersion!.content);
    const ills = await illustrationRefs(g.activityId!);
    const idx = ready.indexOf(ba);
    g.pages = buildActivityPages({ content, illustrations: ills, ctx, activityNumber: idx + 1, activityId: g.activityId! });
  }
  // Recalcule les numéros de page après injection des illustrations (le nombre de pages peut changer)
  pageNo = 2 + tocPageCount;
  tocEntries.length = 0;
  activityGroups.forEach((g, idx) => {
    const ba = ready[idx];
    tocEntries.push({ number: idx + 1, title: ba.activity.title, page: pageNo });
    pageNo += g.keepExisting ? g.keepExisting.length : g.pages.length;
  });

  groups.push(useExisting("__intro") ? { key: "__intro", pages: [], keepExisting: existingByGroup.get("__intro") } : { key: "__intro", pages: [introPage] });
  groups.push({ key: "__toc", pages: buildTocPages(tocEntries, ctx) });
  groups.push(...activityGroups);
  groups.push(useExisting("__conclusion") ? { key: "__conclusion", pages: [], keepExisting: existingByGroup.get("__conclusion") } : { key: "__conclusion", pages: [buildConclusionPage(ctx, ready.length)] });
  if (opts?.includeDiploma ?? true) groups.push(useExisting("__diploma") ? { key: "__diploma", pages: [], keepExisting: existingByGroup.get("__diploma") } : { key: "__diploma", pages: [buildDiplomaPage(book.title, ctx)] });
  groups.push(useExisting("__back_cover") ? { key: "__back_cover", pages: [], keepExisting: existingByGroup.get("__back_cover") } : { key: "__back_cover", pages: [buildBackCoverPage(cover, ctx)] });

  await prisma.$transaction(async (tx) => {
    await tx.bookPage.deleteMany({ where: { bookId, locked: opts?.force ? undefined : false } });
    if (opts?.force) await tx.bookPage.deleteMany({ where: { bookId } });
    let position = 0;
    for (const g of groups) {
      if (g.keepExisting) {
        for (const p of g.keepExisting) {
          await tx.bookPage.update({ where: { id: p.id }, data: { position: position++ } });
        }
      } else {
        for (const p of g.pages) {
          await tx.bookPage.create({ data: { bookId, activityId: g.activityId, position: position++, templateKey: p.templateKey, layout: PageLayoutSchema.parse(p.layout) } });
        }
      }
    }
    await tx.book.update({ where: { id: bookId }, data: { version: { increment: 1 } } });
  });
  return prisma.bookPage.findMany({ where: { bookId }, orderBy: { position: "asc" } });
}

/** Pages d'une seule activité (export individuel, aperçu) sans toucher à la base. */
export async function buildStandaloneActivityPages(activityId: string, bookId?: string) {
  const activity = await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include: { currentVersion: true, books: { include: { book: true }, take: 1 } } });
  if (!activity.currentVersion) throw new Error("Fiche non rédigée");
  const content = ActivityContentSchema.parse(activity.currentVersion.content);
  const bId = bookId ?? activity.books[0]?.bookId;
  const ctx: BuildContext = bId ? await buildContextForBook(bId) : { widthMm: 210, heightMm: 297, theme: defaultThemeForBook(activity.category, activity.ageRange) };
  const ills = await illustrationRefs(activityId);
  return { pages: buildActivityPages({ content, illustrations: ills, ctx, activityNumber: 1, activityId }), ctx };
}
