"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { JobProgress } from "@/components/job-progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityForm } from "./activity-form";
import { IllustrationPanel, type IllustrationView } from "./illustration-panel";
import { VisualReferenceForm } from "./visual-reference-form";
import { generateActivity, illustrateActivity, recheckActivity, resolveIssue, restoreActivityVersion, setActivityStatus } from "@/app/actions/activities";
import { requestExport } from "@/app/actions/books";
import { formatDate } from "@/lib/utils";
import type { ActivityContent, VisualReferenceSheet } from "@/lib/schemas/activity";

export interface ActivityMeta { id: string; title: string; status: string; ageRange: string; safetyBlocked: boolean; safetyNotes: string | null; concept: Record<string, unknown> | null; bookId?: string }
export interface IssueRow { id: string; severity: string; code: string; message: string }

export function ActivityWorkspace(props: {
  activity: ActivityMeta;
  content: ActivityContent | null;
  versions: { id: string; number: number; note: string | null; source: string; createdAt: string; current: boolean }[];
  visualRef: VisualReferenceSheet | null;
  illustrations: IllustrationView[];
  issues: IssueRow[];
  exports: { id: string; status: string; assetId: string | null; pageCount: number | null; createdAt: string; error: string | null }[];
  activeJobId: string | null;
  settings: { imageProvider: string; stepIllustrations: boolean };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobId, setJobId] = useState<string | null>(props.activeJobId);
  const a = props.activity;
  const blockers = props.issues.filter((i) => i.severity === "BLOCKER");
  const errors = props.issues.filter((i) => i.severity === "ERROR");
  const warnings = props.issues.filter((i) => i.severity === "WARNING");
  const infos = props.issues.filter((i) => i.severity === "INFO");
  const sevClass: Record<string, string> = { BLOCKER: "bg-red-100 text-red-900 border-red-300", ERROR: "bg-red-50 text-red-800 border-red-200", WARNING: "bg-amber-50 text-amber-900 border-amber-200", INFO: "bg-slate-50 text-slate-700 border-slate-200" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || Boolean(jobId)} onClick={() => start(async () => { const r = await generateActivity(a.id); setJobId(r.jobId); })}>{props.content ? "Re-rédiger la fiche (nouvelle version)" : "Rédiger la fiche avec l'IA"}</Button>
        <Button size="sm" variant="secondary" disabled={pending || Boolean(jobId) || !props.content} onClick={() => start(async () => { const r = await illustrateActivity(a.id); setJobId(r.jobId); })}>Générer les illustrations manquantes</Button>
        <Button size="sm" variant="secondary" disabled={pending || !props.content} onClick={() => start(async () => { await requestExport({ kind: "ACTIVITY", activityId: a.id, bookId: a.bookId }); router.refresh(); })}>Exporter en PDF</Button>
        <div className="ml-auto flex items-center gap-2">
          {a.status !== "VALIDATED" ? (
            <Button size="sm" variant="success" disabled={pending || !props.content || errors.length > 0} title={errors.length ? "Corrigez d'abord les erreurs" : blockers.length ? "Valider lève le blocage sécurité : vous attestez avoir examiné les risques" : undefined} onClick={() => { if (blockers.length === 0 || confirm(`Cette activité est bloquée pour ${blockers.length} raison(s) de sécurité. En validant, vous attestez avoir examiné les risques. Continuer ?`)) start(() => setActivityStatus(a.id, "VALIDATED")); }}>
              Valider l'activité
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => setActivityStatus(a.id, "REVIEW"))}>Remettre en révision</Button>
          )}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm("Archiver cette activité ?")) start(() => setActivityStatus(a.id, "ARCHIVED")); }}>Archiver</Button>
        </div>
      </div>
      {jobId && <JobProgress jobId={jobId} onDone={() => { setJobId(null); router.refresh(); }} />}
      {a.safetyBlocked && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-bold">Activité bloquée en attente d'une validation humaine (sécurité)</div>
          <pre className="whitespace-pre-wrap font-sans text-xs mt-1">{a.safetyNotes}</pre>
          <p className="text-xs mt-2">Le système signale les risques mais ne certifie jamais qu'une expérience est sûre : la décision finale revient à l'éditeur.</p>
        </div>
      )}

      <Tabs defaultValue={props.content ? "content" : "concept"}>
        <TabsList>
          <TabsTrigger value="content">Fiche</TabsTrigger>
          <TabsTrigger value="illustrations">Illustrations ({props.illustrations.filter((i) => i.isCurrent).length})</TabsTrigger>
          <TabsTrigger value="reference">Référence visuelle</TabsTrigger>
          <TabsTrigger value="quality">Contrôles ({props.issues.length})</TabsTrigger>
          <TabsTrigger value="history">Historique ({props.versions.length})</TabsTrigger>
          {!props.content && <TabsTrigger value="concept">Concept</TabsTrigger>}
        </TabsList>

        <TabsContent value="content">
          {props.content ? <ActivityForm activityId={a.id} initial={props.content} /> : <ConceptView concept={a.concept} />}
        </TabsContent>
        <TabsContent value="concept"><ConceptView concept={a.concept} /></TabsContent>
        <TabsContent value="illustrations">
          <IllustrationPanel activityId={a.id} content={props.content} illustrations={props.illustrations} onJob={setJobId} imageProvider={props.settings.imageProvider} />
        </TabsContent>
        <TabsContent value="reference">
          <VisualReferenceForm activityId={a.id} initial={props.visualRef} stepCount={props.content?.steps.length ?? 0} />
        </TabsContent>
        <TabsContent value="quality">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => recheckActivity(a.id))}>Relancer les contrôles</Button>
              <span className="text-xs text-slate-500">{blockers.length} blocage(s) · {errors.length} erreur(s) · {warnings.length} avertissement(s) · {infos.length} info(s)</span>
            </div>
            {props.issues.length === 0 && <p className="text-sm text-emerald-700 rounded-lg border border-emerald-200 bg-emerald-50 p-4">Aucun problème détecté par les contrôles automatiques. La relecture humaine reste nécessaire.</p>}
            <ul className="space-y-2">
              {props.issues.map((i) => (
                <li key={i.id} className={`rounded-lg border p-3 text-sm flex items-start justify-between gap-3 ${sevClass[i.severity]}`}>
                  <div><span className="font-bold text-xs uppercase mr-2">{i.severity}</span><span className="text-xs text-slate-500 mr-2">{i.code}</span>{i.message}</div>
                  {i.severity !== "BLOCKER" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await resolveIssue(i.id); router.refresh(); })}>Ignorer</Button>}
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
        <TabsContent value="history">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-bold mb-2">Versions de la fiche</h3>
              <ul className="divide-y divide-slate-100 text-sm">
                {props.versions.map((v) => (
                  <li key={v.id} className="py-2 flex items-center justify-between gap-2">
                    <div><span className="font-semibold">v{v.number}</span> <span className="text-xs text-slate-500">{v.source} · {formatDate(v.createdAt)}</span>{v.note && <div className="text-xs text-slate-500">{v.note}</div>}</div>
                    {v.current ? <span className="text-xs text-emerald-700 font-semibold">courante</span> : <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => restoreActivityVersion(a.id, v.id))}>Restaurer</Button>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-bold mb-2">Exports PDF de l'activité</h3>
              {props.exports.length === 0 && <p className="text-sm text-slate-500">Aucun export.</p>}
              <ul className="divide-y divide-slate-100 text-sm">
                {props.exports.map((e) => (
                  <li key={e.id} className="py-2 flex items-center justify-between gap-2">
                    <div><StatusBadge kind="export" status={e.status} /> <span className="text-xs text-slate-500">{formatDate(e.createdAt)} {e.pageCount ? `· ${e.pageCount} p.` : ""}</span>{e.error && <div className="text-xs text-red-700">{e.error}</div>}</div>
                    {e.assetId && <a className="text-blue-700 hover:underline text-xs" href={`/api/assets/${e.assetId}`} target="_blank">Télécharger</a>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConceptView({ concept }: { concept: Record<string, unknown> | null }) {
  if (!concept) return <p className="text-sm text-slate-500">Aucun concept enregistré.</p>;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm space-y-2">
      <p className="text-slate-500">La fiche complète n'a pas encore été rédigée. Concept de départ :</p>
      {Object.entries(concept).map(([k, v]) => (
        <div key={k}><span className="font-semibold">{k}</span> : {Array.isArray(v) ? v.join(", ") : String(v)}</div>
      ))}
    </div>
  );
}
