import { assetUrl } from "@/lib/storage";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAiSettings } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { ManualRequestCard, BatchPaste, type ManualRequestView } from "@/components/manual/request-card";
import { buildBatchPrompt } from "@/lib/ai/manual-core";
import { labelFor } from "@/lib/jobs-labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ManualPage() {
  const settings = await getAiSettings();
  const pending = await prisma.manualRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } });
  const recent = await prisma.manualRequest.findMany({ where: { status: { in: ["DONE", "CANCELLED"] } }, orderBy: { resolvedAt: "desc" }, take: 15 });
  const bookIds = [...new Set([...pending, ...recent].map((r) => r.bookId).filter(Boolean))] as string[];
  const activityIds = [...new Set(pending.map((r) => r.activityId).filter(Boolean))] as string[];
  const jobIds = [...new Set(pending.map((r) => r.jobId).filter(Boolean))] as string[];
  const [books, activities, jobs] = await Promise.all([
    prisma.book.findMany({ where: { id: { in: bookIds } }, select: { id: true, title: true } }),
    prisma.activity.findMany({ where: { id: { in: activityIds } }, select: { id: true, title: true } }),
    prisma.job.findMany({ where: { id: { in: jobIds } }, select: { id: true, type: true, status: true } }),
  ]);
  const bookTitle = (id: string | null) => books.find((b) => b.id === id)?.title ?? "Sans livre";
  const groups = new Map<string, ManualRequestView[]>();
  for (const r of pending) {
    const key = r.bookId ?? "—";
    const job = jobs.find((j) => j.id === r.jobId);
    const view: ManualRequestView = {
      id: r.id, kind: r.kind, title: r.title, prompt: r.prompt, expectedFormat: r.expectedFormat, error: r.error, createdAt: r.createdAt.toISOString(),
      bookId: r.bookId, activityId: r.activityId, activityTitle: activities.find((a) => a.id === r.activityId)?.title ?? null,
      jobId: r.jobId, jobLabel: job ? labelFor(job.type) : null,
      sourceUrl: r.kind === "VIDEO" ? assetUrl(((r.params ?? {}) as { sourceAssetId?: string }).sourceAssetId) ?? null : null,
    };
    groups.set(key, [...(groups.get(key) ?? []), view]);
  }

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        title={<span className="flex items-center gap-3">À coller {pending.length > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-800">{pending.length}</span>}</span>}
        description={
          settings.mode === "manual"
            ? "Mode copier-coller actif : copiez chaque prompt dans Claude ou ChatGPT, puis collez la réponse (ou téléversez l'image). Les tâches reprennent automatiquement dès que leurs réponses sont fournies."
            : "Le mode API est actif : les demandes ci-dessous proviennent d'un passage précédent en mode copier-coller. Vous pouvez toujours y répondre ; les tâches concernées reprendront."
        }
      />

      {pending.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          <p className="font-semibold text-slate-700">Rien à coller pour le moment.</p>
          <p className="mt-1 text-sm">Lancez une production (sommaire, fiches, illustrations) en mode copier-coller : les prompts apparaîtront ici.</p>
          <Link href="/books" className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:underline">Voir les livres</Link>
        </div>
      )}

      {[...groups.entries()].map(([bookId, items]) => {
        const texts = items.filter((i) => i.kind === "TEXT");
        const batch = texts.length > 1 ? buildBatchPrompt(texts.map((t) => ({ id: t.id, title: t.title, prompt: t.prompt }))) : null;
        return (
          <section key={bookId} className="mb-10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black">
                {bookId === "—" ? "Sans livre" : <Link href={`/books/${bookId}`} className="hover:underline">{bookTitle(bookId)}</Link>}
                <span className="ml-2 text-sm font-semibold text-slate-500">{items.length} demande{items.length > 1 ? "s" : ""}</span>
              </h2>
            </div>
            {batch && <BatchPaste prompt={batch} count={texts.length} />}
            <div className="space-y-4">
              {items.map((r) => <ManualRequestCard key={r.id} request={r} />)}
            </div>
          </section>
        );
      })}

      {recent.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-base font-black text-slate-700">Dernières demandes traitées</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="truncate"><span className="text-slate-400 mr-2">{r.kind === "TEXT" ? "Texte" : r.kind === "VIDEO" ? "Vidéo" : "Image"}</span>{r.title}<span className="ml-2 text-xs text-slate-400">{bookTitle(r.bookId)}</span></span>
                <span className={`shrink-0 text-xs font-semibold ${r.status === "DONE" ? "text-emerald-700" : "text-slate-400"}`}>{r.status === "DONE" ? "Collée" : "Annulée"} · {r.resolvedAt ? formatDate(r.resolvedAt) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
