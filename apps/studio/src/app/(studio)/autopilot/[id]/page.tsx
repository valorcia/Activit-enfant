import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AutopilotRunView, type RunViewData } from "@/components/autopilot/run-view";
import { parseStages, STAGE_DESCRIPTIONS } from "@/lib/autopilot/stages";
import type { RunState } from "@/lib/autopilot/runner";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AutopilotRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.autopilotRun.findUnique({ where: { id }, include: { book: { select: { id: true, title: true } } } });
  if (!run) notFound();
  const state = (run.state ?? {}) as RunState;
  const links: RunViewData["links"] = [];
  if (run.book) links.push({ label: "Ouvrir le kit", href: `/books/${run.book.id}?tab=kit` });
  if (run.book && (await prisma.bookPage.count({ where: { bookId: run.book.id } })) > 0) links.unshift({ label: "Aperçu du livre", href: `/books/${run.book.id}/apercu` });
  if (state.pdfExportIds?.length) {
    const exp = await prisma.export.findFirst({ where: { id: { in: state.pdfExportIds }, status: "COMPLETED", assetId: { not: null } }, orderBy: { kind: "asc" } });
    if (exp?.assetId) links.push({ label: "Télécharger le PDF", href: `/api/assets/${exp.assetId}?download=1`, external: true });
  }
  if (state.publicUrl) links.push({ label: "Fiche boutique", href: state.publicUrl, external: true });
  if (state.editUrl) links.push({ label: "Admin boutique", href: state.editUrl, external: true });
  if (state.etsy?.url) links.push({ label: state.etsy.state === "active" ? "Fiche Etsy" : "Fiche Etsy (brouillon)", href: state.etsy.url, external: true });
  if (state.videoIds?.length && run.book) links.push({ label: "Vidéos pub", href: `/books/${run.book.id}?tab=videos` });
  if (state.campaign?.adminUrl) links.push({ label: "Campagne publicitaire", href: state.campaign.adminUrl, external: true });
  const or = [run.bookId ? { bookId: run.bookId } : null, run.jobId ? { jobId: run.jobId } : null].filter(Boolean) as Array<{ bookId?: string; jobId?: string }>;
  const pendingManual = or.length ? await prisma.manualRequest.count({ where: { status: "PENDING", OR: or } }) : 0;
  const data: RunViewData = {
    id: run.id,
    status: run.status,
    title: run.title,
    error: run.error,
    costUsd: Number(run.costUsd),
    maxCostUsd: Number(run.maxCostUsd),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    stages: parseStages(run.stages),
    descriptions: STAGE_DESCRIPTIONS,
    links,
    pendingManual,
  };
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        title={run.book?.title ?? run.title ?? "Pilote automatique"}
        description={`Pilote automatique lancé le ${formatDate(run.createdAt)} : du brief à la campagne publicitaire.`}
        actions={<Button asChild variant="secondary"><Link href="/autopilot">Tous les runs</Link></Button>}
      />
      <AutopilotRunView run={data} />
    </div>
  );
}
