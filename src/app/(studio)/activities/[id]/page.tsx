import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ActivityWorkspace } from "@/components/activity/activity-workspace";
import { ActivityContentSchema, VisualReferenceSheetSchema, ageRangeLabel } from "@/lib/schemas/activity";
import { assetUrl } from "@/lib/storage";
import { getAiSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.activity.findUnique({
    where: { id },
    include: {
      currentVersion: true,
      versions: { orderBy: { number: "desc" }, select: { id: true, number: true, note: true, source: true, createdAt: true } },
      visualRef: true,
      illustrations: { orderBy: [{ kind: "asc" }, { stepIndex: "asc" }, { version: "desc" }], include: { asset: true } },
      issues: { where: { resolved: false }, orderBy: { severity: "desc" } },
      books: { include: { book: { select: { id: true, title: true } } } },
      jobs: { where: { parentId: null }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!a) notFound();
  const settings = await getAiSettings();
  const content = a.currentVersion ? ActivityContentSchema.safeParse(a.currentVersion.content) : null;
  const ref = a.visualRef ? VisualReferenceSheetSchema.safeParse(a.visualRef.data) : null;
  const exportsRows = await prisma.export.findMany({ where: { activityId: id }, orderBy: { createdAt: "desc" }, take: 10 });
  const activeJob = a.jobs.find((j) => ["QUEUED", "RUNNING", "PAUSED"].includes(j.status));

  return (
    <div className="p-8 max-w-7xl">
      <PageHeader
        title={<span className="flex items-center gap-3">{a.title} <StatusBadge kind="activity" status={a.status} /></span>}
        description={<span>{a.category} · {ageRangeLabel(a.ageRange)} · {a.books.map((b) => <Link key={b.book.id} href={`/books/${b.book.id}`} className="hover:underline mr-2">{b.book.title}</Link>)}{a.currentVersion ? `· version ${a.currentVersion.number}` : "· fiche non rédigée"}</span>}
        actions={a.currentVersion && <Button asChild variant="secondary"><Link href={`/print/activities/${id}`} target="_blank">Aperçu impression</Link></Button>}
      />
      <ActivityWorkspace
        activity={{ id: a.id, title: a.title, status: a.status, ageRange: a.ageRange, safetyBlocked: a.safetyBlocked, safetyNotes: a.safetyNotes, concept: a.concept as Record<string, unknown> | null, bookId: a.books[0]?.book.id }}
        content={content?.success ? content.data : null}
        versions={a.versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString(), current: v.id === a.currentVersionId }))}
        visualRef={ref?.success ? ref.data : null}
        illustrations={a.illustrations.map((i) => ({ id: i.id, kind: i.kind, stepIndex: i.stepIndex, version: i.version, status: i.status, isDemo: i.isDemo, isCurrent: i.isCurrent, src: assetUrl(i.assetId), prompt: i.prompt, reviewNote: i.reviewNote, error: i.error, width: i.asset?.width ?? null, provider: i.provider }))}
        issues={a.issues.map((i) => ({ id: i.id, severity: i.severity, code: i.code, message: i.message }))}
        exports={exportsRows.map((e) => ({ id: e.id, status: e.status, assetId: e.assetId, pageCount: e.pageCount, createdAt: e.createdAt.toISOString(), error: e.error }))}
        activeJobId={activeJob?.id ?? null}
        settings={{ imageProvider: settings.imageProvider, stepIllustrations: settings.stepIllustrations }}
      />
    </div>
  );
}
