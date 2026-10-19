import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ageRangeLabel, ART_STYLES, BOOK_TYPES, PAGE_FORMATS } from "@/lib/schemas/activity";
import { getAiSettings } from "@/lib/settings";
import { estimateBookCost } from "@/lib/queue/estimate";
import { BookTabs } from "@/components/book/book-tabs";
import { buildContextForBook } from "@/lib/layout/book";
import { getCover } from "@/lib/generation/cover";
import { assetUrl } from "@/lib/storage";
import { PageLayoutSchema } from "@/lib/schemas/layout";
import { formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      activities: { include: { activity: { include: { currentVersion: { select: { id: true, number: true } }, illustrations: { where: { isCurrent: true }, select: { id: true, kind: true, status: true, isDemo: true, assetId: true } }, issues: { where: { resolved: false }, select: { severity: true } } } } }, orderBy: { position: "asc" } },
      pages: { orderBy: { position: "asc" } },
      exports: { orderBy: { createdAt: "desc" }, take: 30 },
      jobs: { where: { parentId: null }, orderBy: { createdAt: "desc" }, take: 20 },
      illustrations: { where: { kind: "COVER" }, orderBy: { createdAt: "desc" }, include: { asset: true } },
      snapshots: { orderBy: { version: "desc" }, take: 10, select: { id: true, version: true, label: true, createdAt: true } },
    },
  });
  if (!book) notFound();
  const settings = await getAiSettings();
  const estimate = estimateBookCost(settings, { activities: book.activities.length, includeCover: true });
  const spent = await prisma.generationLog.aggregate({ where: { bookId: id }, _sum: { costUsd: true } });
  const ctx = await buildContextForBook(id);
  const cover = await getCover(id);
  const activeJob = book.jobs.find((j) => ["QUEUED", "RUNNING", "PAUSED"].includes(j.status));

  return (
    <div className="p-8 max-w-7xl">
      <PageHeader
        title={<span className="flex items-center gap-3">{book.title} <StatusBadge kind="book" status={book.status} /></span>}
        description={`${BOOK_TYPES.find((t) => t.key === book.bookType)?.label} · ${ageRangeLabel(book.ageRange)} · ${ART_STYLES.find((s) => s.key === book.artStyle)?.label} · ${PAGE_FORMATS[book.pageFormat as keyof typeof PAGE_FORMATS]?.label ?? book.pageFormat} · ${book.activities.length} activités · ${book.pages.length} pages · dépensé ${formatUsd(Number(spent._sum.costUsd ?? 0))}`}
        actions={
          <>
            <Button asChild variant="secondary"><Link href={`/print/books/${id}`} target="_blank">Aperçu impression</Link></Button>
            <Button asChild><Link href={`/books/${id}/editor`}>Ouvrir l'éditeur</Link></Button>
          </>
        }
      />
      <BookTabs
        defaultTab={sp.tab ?? "outline"}
        book={{ id: book.id, title: book.title, subtitle: book.subtitle, collection: book.collection, status: book.status, ageRange: book.ageRange, targetCount: book.targetCount, introduction: cover.introduction ?? "", theme: ctx.theme, widthMm: ctx.widthMm, heightMm: ctx.heightMm }}
        activities={book.activities.map((ba) => ({
          id: ba.activity.id,
          title: ba.activity.title,
          status: ba.activity.status,
          category: ba.activity.category,
          difficulty: ba.activity.difficulty,
          durationMinutes: ba.activity.durationMinutes,
          concept: ba.activity.concept as Record<string, unknown> | null,
          hasContent: Boolean(ba.activity.currentVersion),
          illustrations: ba.activity.illustrations.map((i) => ({ kind: i.kind, status: i.status, isDemo: i.isDemo, src: assetUrl(i.assetId) })),
          issues: { blockers: ba.activity.issues.filter((i) => i.severity === "BLOCKER").length, errors: ba.activity.issues.filter((i) => i.severity === "ERROR").length, warnings: ba.activity.issues.filter((i) => i.severity === "WARNING").length },
        }))}
        pages={book.pages.map((p) => ({ id: p.id, templateKey: p.templateKey, locked: p.locked, activityId: p.activityId, layout: PageLayoutSchema.parse(p.layout) }))}
        exports={book.exports.map((e) => ({ id: e.id, kind: e.kind, status: e.status, pageCount: e.pageCount, assetId: e.assetId, createdAt: e.createdAt.toISOString(), checks: e.checks as Record<string, unknown> | null, error: e.error, snapshotId: e.snapshotId }))}
        snapshots={book.snapshots.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
        jobs={book.jobs.map((j) => ({ id: j.id, type: j.type, status: j.status, step: j.step, progress: j.progress, createdAt: j.createdAt.toISOString(), costUsd: Number(j.costUsd), error: j.error }))}
        activeJobId={activeJob?.id ?? null}
        estimate={estimate}
        cover={cover}
        coverIllustrations={book.illustrations.map((i) => ({ id: i.id, status: i.status, isDemo: i.isDemo, isCurrent: i.isCurrent, src: assetUrl(i.assetId), version: i.version }))}
        settings={{ textProvider: settings.textProvider, imageProvider: settings.imageProvider, stepIllustrations: settings.stepIllustrations }}
      />
    </div>
  );
}
