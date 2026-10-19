"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobProgress, labelFor } from "@/components/job-progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { startPipeline, queueLayout, markBookReady } from "@/app/actions/books";
import { formatUsd, formatDate } from "@/lib/utils";
import type { ActivityRow, BookView, JobRow } from "./book-tabs";
import type { estimateBookCost } from "@/lib/queue/estimate";

export function ProductionTab({ book, activities, jobs, activeJobId, estimate, settings }: { book: BookView; activities: ActivityRow[]; jobs: JobRow[]; activeJobId: string | null; estimate: ReturnType<typeof estimateBookCost>; settings: { textProvider: string; imageProvider: string; stepIllustrations: boolean } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobId, setJobId] = useState<string | null>(activeJobId);
  const [withIllustrations, setWithIllustrations] = useState(true);
  const [withCover, setWithCover] = useState(true);
  const toWrite = activities.filter((a) => !a.hasContent).length;
  const toIllustrate = activities.filter((a) => a.hasContent && !a.illustrations.some((i) => i.kind === "FINAL" && i.status !== "REJECTED")).length;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h3 className="font-bold">Lancer la production par lot</h3>
          <p className="text-sm text-slate-600">Le pipeline rédige les fiches manquantes ({toWrite}), prépare les fiches de référence visuelle, génère les illustrations ({toIllustrate} activité(s) sans illustration finale), assemble les pages et exécute les contrôles. Les contenus déjà produits ou validés sont conservés ; rien n'est publié sans validation humaine.</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={withIllustrations} onChange={(e) => setWithIllustrations(e.target.checked)} /> Générer les illustrations</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={withCover} onChange={(e) => setWithCover(e.target.checked)} /> Générer la couverture (2 propositions)</label>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 text-sm grid md:grid-cols-4 gap-3">
            <div><div className="text-xs text-slate-500">Textes ({estimate.textModel})</div><div className="font-bold">{formatUsd(estimate.text)}</div></div>
            <div><div className="text-xs text-slate-500">Images ({estimate.imageModel}) × {estimate.imagesCount}</div><div className="font-bold">{formatUsd(estimate.images)}</div></div>
            <div><div className="text-xs text-slate-500">Couverture</div><div className="font-bold">{formatUsd(estimate.cover)}</div></div>
            <div><div className="text-xs text-slate-500">Estimation totale / budget</div><div className={`font-bold ${estimate.overBudget ? "text-red-700" : ""}`}>{formatUsd(estimate.total)} / {formatUsd(estimate.budget)}</div></div>
          </div>
          {(settings.textProvider === "mock" || settings.imageProvider === "mock") && (
            <p className="text-xs rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-900">
              Mode démonstration actif ({settings.textProvider === "mock" ? "texte hors ligne" : ""}{settings.textProvider === "mock" && settings.imageProvider === "mock" ? " + " : ""}{settings.imageProvider === "mock" ? "images étiquetées DÉMO" : ""}). Configurez un fournisseur dans Paramètres pour une génération réelle. Les images de démonstration ne sont jamais considérées comme définitives.
            </p>
          )}
          {estimate.overBudget && <p className="text-xs text-red-700">L'estimation dépasse le budget maximal par livre : le pipeline s'arrêtera automatiquement au dépassement. Ajustez le budget dans Paramètres.</p>}
          <div className="flex gap-2">
            <Button disabled={pending || Boolean(jobId) || activities.length === 0} onClick={() => start(async () => { const r = await startPipeline(book.id, { withIllustrations, withCover }); setJobId(r.jobId); })}>
              <Play className="h-4 w-4" /> Lancer la production
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await queueLayout(book.id, false); setJobId(r.jobId); })}>Assembler les pages seulement</Button>
            {book.status !== "READY" && book.status !== "EXPORTED" && (
              <Button variant="success" disabled={pending || activities.length === 0 || activities.some((a) => a.status !== "VALIDATED")} title={activities.some((a) => a.status !== "VALIDATED") ? "Toutes les activités doivent être validées" : undefined} onClick={() => start(async () => { try { await markBookReady(book.id); } catch (e) { alert(e instanceof Error ? e.message : String(e)); } })}>Marquer le livre prêt</Button>
            )}
          </div>
        </div>
        {jobId && <JobProgress jobId={jobId} onDone={() => { setJobId(null); router.refresh(); }} />}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-bold mb-3">Progression par activité</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Activité</th><th>Fiche</th><th>Illustrations</th><th>Contrôles</th><th>Statut</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {activities.map((a) => {
                const fin = a.illustrations.find((i) => i.kind === "FINAL");
                const steps = a.illustrations.filter((i) => i.kind === "STEP");
                const acc = a.illustrations.filter((i) => i.status === "ACCEPTED").length;
                const demo = a.illustrations.some((i) => i.isDemo);
                return (
                  <tr key={a.id}>
                    <td className="py-1.5 font-semibold"><a href={`/activities/${a.id}`} className="hover:underline">{a.title}</a></td>
                    <td>{a.hasContent ? <span className="text-emerald-700">rédigée</span> : <span className="text-slate-400">à rédiger</span>}</td>
                    <td className="text-xs">{fin ? `finale ${fin.status === "ACCEPTED" ? "✓" : fin.status === "REJECTED" ? "✗" : "?"}` : "—"} · {steps.length} étape(s) · {acc} acceptée(s){demo ? " · démo" : ""}</td>
                    <td className="text-xs">{a.issues.blockers ? <span className="text-red-700">{a.issues.blockers} blocage</span> : null} {a.issues.errors ? <span className="text-red-600">{a.issues.errors} err.</span> : null} {a.issues.warnings ? <span className="text-amber-700">{a.issues.warnings} avert.</span> : null}{!a.issues.blockers && !a.issues.errors && !a.issues.warnings && a.hasContent ? <span className="text-emerald-700">OK</span> : null}</td>
                    <td><StatusBadge kind="activity" status={a.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold mb-3">Journal des tâches</h3>
        <ul className="space-y-2 text-sm">
          {jobs.map((j) => (
            <li key={j.id} className="border-b border-slate-100 pb-2">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{labelFor(j.type)}</span><StatusBadge kind="job" status={j.status} /></div>
              <div className="text-xs text-slate-500">{j.step ?? ""} · {formatDate(j.createdAt)} · {formatUsd(j.costUsd)}</div>
              {j.error && <div className="text-xs text-red-700 mt-1 line-clamp-3">{j.error}</div>}
              {j.status !== "COMPLETED" && j.id !== jobId && <button className="text-xs text-blue-700 hover:underline cursor-pointer" onClick={() => setJobId(j.id)}>Suivre</button>}
            </li>
          ))}
          {jobs.length === 0 && <li className="text-slate-500">Aucune tâche.</li>}
        </ul>
      </div>
    </div>
  );
}
